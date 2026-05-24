Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName Microsoft.VisualBasic

$kiroExe = "C:\Users\ASUS\AppData\Local\Programs\Kiro\Kiro.exe"
$workspace = "C:\projects\kiro\FEC_CR_Builder\kiro-sdlc-agents\src\test\e2e\test-workspace"
$extPath = "C:\projects\kiro\FEC_CR_Builder\kiro-sdlc-agents"
$outDir = "C:\projects\kiro\FEC_CR_Builder\documents\KSA-120\screenshots"

# Launch Kiro with dev extension (no --disable-extensions)
Start-Process -FilePath $kiroExe -ArgumentList @(
    $workspace,
    "--extensionDevelopmentPath=$extPath"
)

Write-Output "Launched Kiro (dev extension mode)"
Write-Output "Waiting 15s for load..."
Start-Sleep -Seconds 15

# Focus and screenshot
try { [Microsoft.VisualBasic.Interaction]::AppActivate("test-workspace") } catch {}
Start-Sleep -Seconds 2

$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$graphics.Dispose()

$filePath = Join-Path $outDir "e2e-clean-kiro.png"
$bmp.Save($filePath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "Screenshot: $filePath"
