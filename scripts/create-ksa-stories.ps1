function Call-Jira($toolName, $arguments) {
    $h = @{"Accept"="application/json, text/event-stream"}
    $ib = @{jsonrpc="2.0";id=1;method="initialize";params=@{protocolVersion="2024-11-05";capabilities=@{};clientInfo=@{name="sm";version="1.0"}}} | ConvertTo-Json -Depth 5
    $ir = Invoke-WebRequest -Uri "http://localhost:3023/mcp" -Method Post -ContentType "application/json" -Headers $h -Body $ib -TimeoutSec 10
    $s = ($ir.Headers["mcp-session-id"])[0]
    $h2 = @{"Accept"="application/json, text/event-stream";"mcp-session-id"=$s}
    $cb = @{jsonrpc="2.0";id=2;method="tools/call";params=@{name=$toolName;arguments=$arguments}} | ConvertTo-Json -Depth 10
    $r = Invoke-WebRequest -Uri "http://localhost:3023/mcp" -Method Post -ContentType "application/json" -Headers $h2 -Body $cb -TimeoutSec 30
    return $r.Content
}

$epicKey = "KSA-192"

# Story 1
$desc1 = "Tach SM agent prompt (~500+ lines) thanh modular steering files: sm-agent.md (chi chua role + principles < 100 lines), steering/sdlc-pipeline.md (workflow logic chinh), steering/sdlc-phases/phase-1-requirements.md (chi tiet Phase 1), steering/sdlc-phases/phase-2-specification.md (chi tiet Phase 2), ... (moi phase 1 file). Muc tieu: giam context load, de maintain, de extend. Acceptance Criteria: 1) SM agent prompt < 100 lines (role + principles only) 2) Moi phase co steering file rieng 3) SM van hoat dong dung pipeline sau khi tach 4) Khong regression tren existing workflows"

Write-Host "Creating Story 1..."
$r1 = Call-Jira "jira_create_issue" @{
    project_key="KSA"
    summary="Modular SM Agent - Tach prompt thanh steering files"
    issue_type="Task"
    description=$desc1
    priority="Medium"
    labels="architecture,agent-upgrade,harness-inspired"
}
Write-Host $r1

if ($r1 -match '"key":\s*"(KSA-\d+)"') { $story1Key = $matches[1]; Write-Host "Story 1: $story1Key" }
Start-Sleep -Seconds 2

# Story 2
$desc2 = "Implement Fan-out/Fan-in pattern cho cac phases co the chay song song: QA (STP/STC) + SA (TDD) chay parallel sau khi FSD hoan thanh, Security review + Code review chay parallel, Giam total pipeline time bang cach tan dung independent phases. Inspired by Harness Fan-out/Fan-in architecture pattern. Acceptance Criteria: 1) QA va SA phases chay parallel (khong sequential) 2) Pipeline time giam it nhat 30% cho full pipeline 3) Ket qua quality khong giam so voi sequential 4) Error handling khi 1 parallel branch fail"

Write-Host "Creating Story 2..."
$r2 = Call-Jira "jira_create_issue" @{
    project_key="KSA"
    summary="Parallel Execution - Fan-out pattern cho independent phases"
    issue_type="Task"
    description=$desc2
    priority="Medium"
    labels="architecture,agent-upgrade,harness-inspired"
}
Write-Host $r2

if ($r2 -match '"key":\s*"(KSA-\d+)"') { $story2Key = $matches[1]; Write-Host "Story 2: $story2Key" }
Start-Sleep -Seconds 2

# Story 3
$desc3 = "Them logic cho SM agent de chon architecture pattern phu hop dua tren ticket complexity: Simple ticket (bug fix, typo) -> Minimal pipeline (skip BRD, chi TDD + DEV), Medium ticket (feature) -> Standard pipeline (BRD -> FSD -> TDD -> DEV -> QA), Complex ticket (epic-level) -> Full pipeline + parallel + feedback loops. SM tu phan tich ticket description/labels de quyet dinh pattern. 6 patterns reference: Pipeline, Fan-out/Fan-in, Expert Pool, Producer-Reviewer, Supervisor, Hierarchical Delegation. Acceptance Criteria: 1) SM tu detect ticket complexity (simple/medium/complex) 2) Simple tickets skip unnecessary phases 3) Complex tickets enable parallel execution 4) User co the override pattern selection"

Write-Host "Creating Story 3..."
$r3 = Call-Jira "jira_create_issue" @{
    project_key="KSA"
    summary="Architecture Pattern Selection - Dynamic pipeline cho SM"
    issue_type="Task"
    description=$desc3
    priority="Medium"
    labels="architecture,agent-upgrade,harness-inspired"
}
Write-Host $r3

if ($r3 -match '"key":\s*"(KSA-\d+)"') { $story3Key = $matches[1]; Write-Host "Story 3: $story3Key" }
Start-Sleep -Seconds 2

# Story 4
$desc4 = "Implement 3-layer loading system cho agent instructions: Layer 1 (Always) Agent role + principles (~100 words) luon trong context, Layer 2 (On trigger) Phase-specific instructions load khi phase bat dau, Layer 3 (On demand) Reference docs templates load khi can chi tiet. Giam context window usage, tang token efficiency. Inspired by Harness Progressive Disclosure pattern (Metadata -> SKILL.md -> references/). Acceptance Criteria: 1) Agent context load giam >=50% so voi hien tai 2) Steering files co proper inclusion fileMatch hoac inclusion manual 3) Khong mat thong tin tat ca instructions van accessible khi can 4) Performance khong giam (agent van biet load dung file dung luc)"

Write-Host "Creating Story 4..."
$r4 = Call-Jira "jira_create_issue" @{
    project_key="KSA"
    summary="Progressive Disclosure - Conditional loading cho agent prompts"
    issue_type="Task"
    description=$desc4
    priority="Medium"
    labels="architecture,agent-upgrade,harness-inspired"
}
Write-Host $r4

if ($r4 -match '"key":\s*"(KSA-\d+)"') { $story4Key = $matches[1]; Write-Host "Story 4: $story4Key" }
Start-Sleep -Seconds 2

# Link all stories to Epic
Write-Host "`nLinking stories to Epic $epicKey..."

foreach ($storyKey in @($story1Key, $story2Key, $story3Key, $story4Key)) {
    if ($storyKey) {
        Write-Host "Linking $storyKey to $epicKey..."
        $lr = Call-Jira "jira_link_to_epic" @{
            issue_key=$storyKey
            epic_key=$epicKey
        }
        Write-Host $lr
        Start-Sleep -Seconds 1
    }
}

Write-Host "`n=== DONE ==="
Write-Host "Epic: $epicKey"
Write-Host "Story 1: $story1Key"
Write-Host "Story 2: $story2Key"
Write-Host "Story 3: $story3Key"
Write-Host "Story 4: $story4Key"
