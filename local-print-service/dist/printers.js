import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileP = promisify(execFile);
/**
 * List installed Windows printers via PowerShell Get-Printer.
 *
 * Requires PowerShell 4.0+ (built into Windows 8 / Server 2012 and newer).
 * Returns an empty array if the host has no printers configured.
 */
export async function listPrinters() {
    const cmd = "Get-Printer | Select-Object Name,DriverName,PortName,Shared,Default | ConvertTo-Json -Compress";
    const { stdout } = await execFileP("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", cmd], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    const trimmed = stdout.trim();
    if (!trimmed)
        return [];
    const parsed = JSON.parse(trimmed);
    // ConvertTo-Json emits a bare object when only one printer is installed.
    return Array.isArray(parsed) ? parsed : [parsed];
}
//# sourceMappingURL=printers.js.map