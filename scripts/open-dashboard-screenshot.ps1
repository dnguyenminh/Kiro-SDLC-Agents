Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName Microsoft.VisualBasic

$outDir = "C:\projects\kiro\FEC_CR_Builder\documents\KSA-120\screenshots"

# Focus Kiro
try { [Microsoft.VisualBasic.Interaction]::AppActivate("test-workspace - Kiro") } catch {}
Start-Sleep -Seconds 1

# Switch to English keyboard (Win+Space or Alt+Shift)
[System.Windows.Forms.SendKeys]::SendWait("%+")
Start-Sleep -Milliseconds 500

# Open command palette
[System.Windows.Forms.SendKeys]::SendWait("^+p")
Start-Sleep -Seconds 2

# Screenshot command palette
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$graphics.Dispose()
$filePath = Join-Path $outDir "e2e-01-command-palette.png"
$bmp.Save($filePath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "Screenshot 1: $filePath"

# Type command
[System.Windows.Forms.SendKeys]::SendWait("KB Dashboard")
Start-Sleep -Seconds 2

# Screenshot showing command found
$bmp2 = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$graphics2 = [System.Drawing.Graphics]::FromImage($bmp2)
$graphics2.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$graphics2.Dispose()
$filePath2 = Join-Path $outDir "e2e-02-command-found.png"
$bmp2.Save($filePath2, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp2.Dispose()
Write-Output "Screenshot 2: $filePath2"

# Execute
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Seconds 4

# Screenshot panel
$bmp3 = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$graphics3 = [System.Drawing.Graphics]::FromImage($bmp3)
$graphics3.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$graphics3.Dispose()
$filePath3 = Join-Path $outDir "e2e-03-kb-dashboard.png"
$bmp3.Save($filePath3, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp3.Dispose()
Write-Output "Screenshot 3: $filePath3"
