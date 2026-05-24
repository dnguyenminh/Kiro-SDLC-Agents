Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName Microsoft.VisualBasic

$outDir = "C:\projects\kiro\FEC_CR_Builder\documents\KSA-120\screenshots"

# Focus by title
try { [Microsoft.VisualBasic.Interaction]::AppActivate("[Extension Development Host] test-workspace - Kiro") } catch {
    Write-Output "Focus failed, trying PID..."
    try { [Microsoft.VisualBasic.Interaction]::AppActivate(45556) } catch {}
}
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
