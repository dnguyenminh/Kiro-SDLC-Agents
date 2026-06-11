param(
    [Parameter(Mandatory=$true)][string]$ToolName,
    [Parameter(Mandatory=$true)][string]$Arguments
)

$ErrorActionPreference = "Stop"
$headers = @{"Accept"="application/json, text/event-stream"}
$initBody = @{jsonrpc="2.0";id=1;method="initialize";params=@{protocolVersion="2024-11-05";capabilities=@{};clientInfo=@{name="kiro-sm";version="1.0"}}} | ConvertTo-Json -Depth 5
$initResp = Invoke-WebRequest -Uri "http://localhost:3045/mcp" -Method Post -ContentType "application/json" -Headers $headers -Body $initBody -TimeoutSec 10
$sessionId = ($initResp.Headers["mcp-session-id"])[0]

$headers2 = @{"Accept"="application/json, text/event-stream"; "mcp-session-id"=$sessionId}
$callBody = @{jsonrpc="2.0";id=2;method="tools/call";params=@{name=$ToolName;arguments=($Arguments | ConvertFrom-Json)}} | ConvertTo-Json -Depth 10
$callResp = Invoke-WebRequest -Uri "http://localhost:3045/mcp" -Method Post -ContentType "application/json" -Headers $headers2 -Body $callBody -TimeoutSec 30
# Extract just the data from SSE response
$content = $callResp.Content
if ($content -match "data: (.+)$") {
    $matches[1]
} else {
    $content
}
