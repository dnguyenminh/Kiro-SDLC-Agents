Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Launch Kiro IDE
$kiroPath = "C:\Users\ASUS\AppData\Local\Programs\Kiro\Kiro.exe"
$workspace = "C:\projects\kiro\FEC_CR_Builder\kiro-sdlc-agents\src\test\e2e\test-workspace"

Write-Output "Launching Kiro IDE..."
Start-Process -FilePath $kiroPath -ArgumentList $workspace

# Wait for Kiro to load
Write-Output "Waiting 15s for Kiro to load..."
Start-Sleep -Seconds 15

# Bring Kiro to foreground
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@

$kiroProc = Get-Process -Name "Kiro" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($kiroProc) {
    [Win32]::SetForegroundWindow($kiroProc.MainWindowHandle) | Out-Null
    Write-Output "Kiro focused (PID: $($kiroProc.Id))"
    Start-Sleep -Seconds 2
} else {
    Write-Output "WARNING: Kiro process not found"
}

# Take screenshot
$outDir = "C:\projects\kiro\FEC_CR_Builder\documents\KSA-120\screenshots"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$graphics.Dispose()

$filePath = Join-Path $outDir "e2e-kiro-ide-loaded.png"
$bmp.Save($filePath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Output "Screenshot saved: $filePath"
