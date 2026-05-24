Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$outDir = "C:\projects\kiro\FEC_CR_Builder\documents\KSA-120\screenshots"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$graphics.Dispose()

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$filePath = Join-Path $outDir "e2e-evidence-$timestamp.png"
$bmp.Save($filePath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Output "Screenshot saved: $filePath"
