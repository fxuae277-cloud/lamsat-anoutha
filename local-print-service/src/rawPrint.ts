import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const execFileP = promisify(execFile);

// ─── Phase 1: text printing via Out-Printer ────────────────────────────────

/**
 * Print plain text to a named Windows printer via PowerShell Out-Printer.
 *
 * Phase 1 helper — keeps /print/test working. Goes through the Windows print
 * spooler as a graphics document. Do NOT use for thermal receipts; that path
 * is `printRawBytes` below.
 */
export async function printText(
  printerName: string,
  text: string
): Promise<void> {
  if (!printerName?.trim()) throw new Error("printerName is required");
  if (typeof text !== "string") throw new Error("text must be a string");

  const tmpFile = join(tmpdir(), `lamsa-print-${randomUUID()}.txt`);
  const utf16 = Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from(text, "utf16le"),
  ]);
  await writeFile(tmpFile, utf16);

  try {
    const psName = `'${printerName.replace(/'/g, "''")}'`;
    const psPath = `'${tmpFile.replace(/'/g, "''")}'`;
    const cmd = `Get-Content -Path ${psPath} -Encoding Unicode -Raw | Out-Printer -Name ${psName}`;

    await execFileP(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", cmd],
      { windowsHide: true }
    );
  } finally {
    unlink(tmpFile).catch(() => {});
  }
}

// ─── Phase 2: raw bytes printing via winspool.drv (RawPrinterHelper) ───────

/**
 * Inline C# helper invoked through PowerShell `Add-Type`. Uses winspool.drv
 * P/Invoke to send raw bytes to a Windows printer queue with the RAW
 * datatype — bypassing the GDI/spooler rendering path so that ESC/POS
 * bytes reach the thermal printer untouched.
 *
 * This is the canonical Microsoft RawPrinterHelper pattern adapted for our
 * single-call use (file → printer). Errors include the Win32 error code so
 * driver/queue issues surface clearly in the service log.
 */
const RAW_PRINTER_HELPER_CS = `
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DOCINFOW {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode, ExactSpelling=true)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPWStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode, ExactSpelling=true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOW di);

    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static void SendFileToPrinter(string printerName, string filePath) {
        byte[] bytes = File.ReadAllBytes(filePath);
        IntPtr hPrinter = IntPtr.Zero;

        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
            throw new Exception("OpenPrinter failed for '" + printerName + "': Win32=" + Marshal.GetLastWin32Error());
        }

        try {
            DOCINFOW di = new DOCINFOW();
            di.pDocName = "Lamsa Receipt";
            di.pDataType = "RAW";

            if (!StartDocPrinter(hPrinter, 1, di)) {
                throw new Exception("StartDocPrinter failed: Win32=" + Marshal.GetLastWin32Error());
            }
            try {
                if (!StartPagePrinter(hPrinter)) {
                    throw new Exception("StartPagePrinter failed: Win32=" + Marshal.GetLastWin32Error());
                }
                try {
                    int written = 0;
                    IntPtr unmanaged = Marshal.AllocCoTaskMem(bytes.Length);
                    try {
                        Marshal.Copy(bytes, 0, unmanaged, bytes.Length);
                        if (!WritePrinter(hPrinter, unmanaged, bytes.Length, out written)) {
                            throw new Exception("WritePrinter failed: Win32=" + Marshal.GetLastWin32Error());
                        }
                    } finally {
                        Marshal.FreeCoTaskMem(unmanaged);
                    }
                } finally {
                    EndPagePrinter(hPrinter);
                }
            } finally {
                EndDocPrinter(hPrinter);
            }
        } finally {
            ClosePrinter(hPrinter);
        }
    }
}
`;

function psSingleQuote(s: string): string {
  return "'" + s.replace(/'/g, "''") + "'";
}

/**
 * Send a raw byte buffer to the named Windows printer with the RAW datatype.
 *
 * Bytes are written to a temp file (so we don't worry about CLI-arg size or
 * encoding), then a PowerShell process loads the inline C# helper and pipes
 * the file straight into the printer queue. This is what carries ESC/POS
 * commands intact to the thermal printer.
 */
export async function printRawBytes(
  printerName: string,
  bytes: Buffer
): Promise<void> {
  if (!printerName?.trim()) throw new Error("printerName is required");
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    throw new Error("bytes must be a non-empty Buffer");
  }

  const tmpFile = join(tmpdir(), `lamsa-raw-${randomUUID()}.bin`);
  await writeFile(tmpFile, bytes);

  // Heredoc with @'...'@ so $ and backticks in the C# code stay literal.
  const psScript =
    `$ErrorActionPreference = 'Stop'\n` +
    `$cs = @'\n` +
    RAW_PRINTER_HELPER_CS +
    `\n'@\n` +
    `Add-Type -TypeDefinition $cs -Language CSharp -ErrorAction Stop\n` +
    `[RawPrinterHelper]::SendFileToPrinter(${psSingleQuote(printerName)}, ${psSingleQuote(tmpFile)})\n`;

  // -EncodedCommand expects UTF-16LE base64. This sidesteps every quoting
  // landmine when piping multi-line scripts into powershell.exe.
  const encoded = Buffer.from(psScript, "utf16le").toString("base64");

  try {
    await execFileP(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
      { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }
    );
  } finally {
    unlink(tmpFile).catch(() => {});
  }
}
