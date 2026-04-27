' start-print-service-hidden.vbs
' Launches the Lamsa Local Print Service with NO visible CMD window.
'
' Why VBScript: WScript.Shell.Run with intWindowStyle=0 detaches the child
' process from any console host, so node.exe runs as a true background
' process. No black flash, no taskbar entry, no minimised CMD.
'
' Singleton guard: if another node.exe is already running this exact
' dist\index.js, this launcher exits silently. Prevents two instances
' fighting for port 3030 when the cashier double-clicks the launcher
' (or it gets auto-started twice by Task Scheduler + Startup folder).
'
' Logging: stdout/stderr are appended to logs\print-service.log so
' diagnostics are recoverable without a visible console.

Option Explicit

Dim shell, fso, scriptDir, repoDir, logsDir, logFile, distEntry
Dim cmdLine

Set shell = CreateObject("WScript.Shell")
Set fso   = CreateObject("Scripting.FileSystemObject")

' Resolve paths relative to this script — works no matter where it lives.
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
repoDir   = fso.GetParentFolderName(scriptDir) ' …\lamsat-anoutha
logsDir   = repoDir & "\logs"
logFile   = logsDir & "\print-service.log"
distEntry = scriptDir & "\dist\index.js"

' Ensure logs/ exists (no-op if already there).
If Not fso.FolderExists(logsDir) Then
  fso.CreateFolder(logsDir)
End If

' Bail out early if dist isn't built yet.
If Not fso.FileExists(distEntry) Then
  WScript.Quit 1
End If

' ─── Singleton guard ──────────────────────────────────────────────────
' Detect any existing node.exe whose command line references this exact
' dist\index.js. WMI gives us per-process command lines on Windows.
Dim wmi, procs, p, alreadyRunning, needle
alreadyRunning = False
needle = LCase(distEntry)

On Error Resume Next
Set wmi = GetObject("winmgmts:\\.\root\cimv2")
If Err.Number = 0 Then
  Set procs = wmi.ExecQuery( _
    "SELECT CommandLine FROM Win32_Process WHERE Name='node.exe'")
  For Each p In procs
    If Not IsNull(p.CommandLine) Then
      If InStr(LCase(p.CommandLine), needle) > 0 Then
        alreadyRunning = True
        Exit For
      End If
    End If
  Next
End If
On Error Goto 0

If alreadyRunning Then
  WScript.Quit 0
End If

' ─── Launch hidden ────────────────────────────────────────────────────
' cmd /c wraps node so we can redirect stdout+stderr to a file. The whole
' chain runs hidden (intWindowStyle=0), so no console window flashes.
'   /c    : run command then exit cmd
'   2>>&1 : merge stderr into stdout
'   >>    : append (don't truncate the log on every restart)
cmdLine = "cmd /c node """ & distEntry & """ >> """ & logFile & """ 2>&1"

' Run hidden, do not wait — node keeps running in the background.
shell.Run cmdLine, 0, False

WScript.Quit 0
