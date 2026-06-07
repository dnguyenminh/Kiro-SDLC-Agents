# Deployment Guide (DPG)

## kiro-ts — KSA-236: tool_use_id mismatch causes 400 on ReAct tool continuation

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-236 |
| Title | kiro-ts: tool_use_id mismatch causes 400 on ReAct tool continuation |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |
| Related TDD | TDD-v2-KSA-236.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-14 | DevOps Agent | Initiate document — auto-generated from TDD and project context |

---

## Sign-Off

| Name | Role | Signature and date |
|------|------|--------------------|
| | Dev Lead | ☐ Approved for deployment |
| | QA Lead | ☐ Testing completed |
| | Ops Lead | ☐ Infrastructure ready |

---

## 1. Overview

### 1.1 Feature Summary

This deployment addresses a critical bug fix in the kiro-ts Anthropic converter module where `tool_use_id` values become mismatched between streaming responses and internal conversation history. The mismatch causes all ReAct tool continuation requests to fail with HTTP 400 Bad Request errors, breaking the Chat Panel tool-calling loop.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| `src/anthropic/converter.ts` | Modified | ID passthrough fix — uses `block.id` instead of generating new ID |
| `src/anthropic/handlers.ts` | Modified | Added mismatch detection + descriptive error response |
| `src/anthropic/types.ts` | Modified | Updated TypeScript interfaces for tool_use_id consistency |
| `src/history/conversation.ts` | Modified | Added `findToolUse()` + `getAllToolUseIds()` methods |
| Database | None | No database changes — in-memory only |
| Configuration | None | No new configuration required |

### 1.3 Target Environments

| Environment | URL | Deploy Order | Approval Required |
|-------------|-----|-------------|-------------------|
| DEV | http://localhost:3000 | 1st | No |
| SIT | https://kiro-sit.internal | 2nd | No |
| UAT | https://kiro-uat.internal | 3rd | QA Sign-off |
| PROD | https://kiro.internal | 4th | PM + Dev Lead Sign-off |

---

## 2. Prerequisites

### 2.1 Infrastructure

| Requirement | Status | Notes |
|-------------|--------|-------|
| Node.js runtime available | Ready | Node.js 20.x LTS required |
| Docker host available | Ready | For containerized deployment |
| Network access to Kiro Q API | Ready | Service must reach backend API |

### 2.2 Software Dependencies

| Dependency | Version | Status |
|-----------|---------|--------|
| Node.js | 20.x LTS | Installed |
| TypeScript | 5.x | Dev dependency (build-time only) |
| npm | 10.x | Installed |
| Docker | 24.x+ | Available |

### 2.3 Access Requirements

| Access | Type | Who Needs It |
|--------|------|-------------|
| Git repository | SSH key | DevOps team |
| Docker registry | Token-based | CI/CD pipeline |
| Deployment server | SSH | DevOps team |

### 2.4 Backup Requirements

- [ ] Previous Docker image tagged and saved (`kiro-ts:previous`)
- [ ] Application configuration backed up
- [ ] No database backup needed (in-memory only)

---

## 3. Pre-Deployment Checklist

| # | Item | Responsible | Status |
|---|------|-------------|--------|
| 1 | Code merged to release branch | Developer | ☐ |
| 2 | All 22 tests passed (15 unit + 7 integration) | Developer | ☐ |
| 3 | TypeScript build succeeds (`npm run build`) | Developer | ☐ |
| 4 | SIT/UAT sign-off obtained | QA + BA | ☐ |
| 5 | No new dependencies added (verified) | Developer | ☐ |
| 6 | Configuration unchanged (verified) | DevOps | ☐ |
| 7 | Previous image tagged as rollback target | DevOps | ☐ |
| 8 | Monitoring/alerting configured | DevOps | ☐ |
| 9 | Rollback plan reviewed | Team | ☐ |
| 10 | Deployment window confirmed | PM | ☐ |

---

## 4. Database Migration

### 4.1 Not Applicable

This deployment has **NO database changes**. The fix is entirely in-memory logic within the Anthropic converter module. No migration scripts, rollback scripts, or data changes are required.

---

## 5. Application Deployment

### 5.1 Deployment Flow

![Deployment Flow](diagrams/deployment-flow.png)

### 5.2 Build Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Clean install dependencies | `npm ci` | Exit code 0, `node_modules/` created |
| 2 | Run all tests | `npm run test` | 22 tests pass (15 unit + 7 integration) |
| 3 | Build TypeScript | `npm run build` | `dist/` directory created, no errors |

### 5.3 Docker Build & Push

```bash
# Build Docker image with specific version tag
docker build -t kiro-ts:v1.x.x-patch .
docker tag kiro-ts:v1.x.x-patch registry.internal/kiro-ts:v1.x.x-patch

# Push to registry
docker push registry.internal/kiro-ts:v1.x.x-patch
```

### 5.4 Deployment Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Tag current image as rollback | `docker tag kiro-ts:current kiro-ts:rollback` | Image tagged |
| 2 | Pull new image | `docker pull registry.internal/kiro-ts:v1.x.x-patch` | Image pulled successfully |
| 3 | Stop existing container | `docker stop kiro-ts && docker rm kiro-ts` | Container stopped |
| 4 | Start new container | See command below | Container running |
| 5 | Wait for startup | `sleep 10` | Service initializing |
| 6 | Health check | `curl -s http://localhost:3000/health` | `{"status":"ok"}` |

### 5.5 Docker Run Command

```bash
docker run -d --name kiro-ts \
  --restart=unless-stopped \
  -p 3000:3000 \
  -e KIRO_Q_API_URL=${KIRO_Q_API_URL} \
  -e PORT=3000 \
  -e LOG_LEVEL=${LOG_LEVEL} \
  registry.internal/kiro-ts:v1.x.x-patch
```

---

## 6. Configuration Changes

### 6.1 Environment Variables (No Changes)

This deployment introduces **no new environment variables**. Existing variables remain unchanged:

| Variable | Description | DEV | SIT | UAT | PROD |
|----------|-------------|-----|-----|-----|------|
| KIRO_Q_API_URL | Backend API endpoint | http://localhost:8080 | https://q-sit.internal | https://q-uat.internal | `${PROD_API_URL}` |
| PORT | Service port | 3000 | 3000 | 3000 | 3000 |
| LOG_LEVEL | Logging verbosity | trace | debug | info | info |

### 6.2 Application Properties Changes

No changes to application properties.

### 6.3 Feature Flags

No feature flags required for this deployment. The fix is always active once deployed.

---

## 7. Post-Deployment Verification

### 7.1 Health Checks

| Check | Endpoint/Command | Expected Result | Timeout |
|-------|-----------------|-----------------|---------|
| Application health | `GET /health` | 200 OK, `{"status":"ok","uptime":...}` | 30s |
| Service responsiveness | `GET /health` (3 consecutive) | All return 200 within 500ms | 10s |

### 7.2 Smoke Tests

| # | Scenario | Steps | Expected Result |
|---|----------|-------|-----------------|
| 1 | Basic chat (no tools) | Send plain text message via `/chat/completions` | SSE stream with text response, no errors |
| 2 | Tool calling (ReAct loop) | Send message triggering tool_use | `tool_use_id` in stream matches ID from continuation request |
| 3 | Multi-tool response | Trigger response with 2+ tool_use blocks | Each `tool_use_id` unique and consistent across stream/history |
| 4 | Tool continuation | Send toolResult with matching toolUseId | No 400 error, continuation succeeds |
| 5 | Mismatch diagnostic | Send toolResult with wrong toolUseId | 400 with descriptive error including available IDs |

### 7.3 Log Verification

| Log Entry | Level | Expected | Location |
|-----------|-------|----------|----------|
| Service started | INFO | Within 10s of container start | stdout |
| `tool_use_id passthrough` | TRACE | On every tool_use response (if LOG_LEVEL=trace) | stdout |
| No ERROR/FATAL entries | — | Zero error-level logs after clean startup | stdout |

### 7.4 Monitoring Dashboard

- [ ] Application metrics visible in dashboard
- [ ] Error rate = 0% (no 400/500 responses)
- [ ] Response time within normal range (< 200ms for health, < 30s for chat)
- [ ] No unexpected alerts triggered
- [ ] Tool continuation success rate = 100%

---

## 8. Rollback Plan

### 8.1 Rollback Flow

![Rollback Flow](diagrams/rollback-flow.png)

### 8.2 Rollback Decision Criteria

| Condition | Action |
|-----------|--------|
| Health check fails after deploy | Immediate rollback |
| Error rate increases > 5% | Immediate rollback |
| Smoke test (tool calling) fails | Immediate rollback |
| Performance degradation > 50% | Immediate rollback |
| Minor non-critical issue | Assess hotfix — no immediate rollback |

### 8.3 Rollback Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Stop new container | `docker stop kiro-ts && docker rm kiro-ts` | Container removed |
| 2 | Start rollback image | `docker run -d --name kiro-ts --restart=unless-stopped -p 3000:3000 -e KIRO_Q_API_URL=${KIRO_Q_API_URL} -e PORT=3000 -e LOG_LEVEL=${LOG_LEVEL} kiro-ts:rollback` | Container running |
| 3 | Wait for startup | `sleep 10` | Service initializing |
| 4 | Verify health | `curl -s http://localhost:3000/health` | `{"status":"ok"}` |
| 5 | Verify basic functionality | Send test chat request | Response received (tool loop will still be broken, but service is stable) |

### 8.4 Rollback Time Estimate

| Action | Estimated Time |
|--------|---------------|
| Stop new container | 10 seconds |
| Start rollback container | 15 seconds |
| Health verification | 30 seconds |
| **Total** | **~1 minute** |

### 8.5 Post-Rollback Notes

- No database rollback needed (no DB changes)
- No configuration rollback needed (no config changes)
- In-memory conversation history is cleared on restart (expected behavior)
- After rollback, tool_use_id mismatch bug will reappear (known limitation until fix is redeployed)

---

## 9. Environment-Specific Notes

### 9.1 DEV

- Deploy immediately after build passes
- LOG_LEVEL=trace for full diagnostic output
- Verify tool_use_id passthrough in trace logs

### 9.2 SIT

- Deploy after DEV verification complete
- LOG_LEVEL=debug for integration testing
- QA team runs full ReAct loop test scenarios

### 9.3 UAT

- Deploy after SIT sign-off
- LOG_LEVEL=info (production-like)
- Business stakeholders verify Chat Panel tool calling works end-to-end

### 9.4 PROD

- **Deployment Window:** Business hours (low-impact service restart)
- **Approval Required From:** Dev Lead + PM
- **Communication Plan:** Notify team in #kiro-releases channel before/after
- **On-Call Contact:** kiro-ts team on-call rotation
- **Note:** Since this is an in-memory fix with no DB or config changes, risk is minimal. Rollback takes ~1 minute.

---

## 10. Appendix

### Contacts

| Role | Name | Contact |
|------|------|---------|
| Reporter | Duc Nguyen Minh | Jira ticket reporter |
| DevOps | DevOps Agent | Automated |
| Dev Lead | kiro-ts Team | Team channel |

### Related Tickets

| Ticket | Summary | Relationship |
|--------|---------|-------------|
| KSA-236 | tool_use_id mismatch causes 400 on ReAct tool continuation | Main ticket |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Deployment Flow | [deployment-flow.png](diagrams/deployment-flow.png) | [deployment-flow.drawio](diagrams/deployment-flow.drawio) |
| 2 | Rollback Flow | [rollback-flow.png](diagrams/rollback-flow.png) | [rollback-flow.drawio](diagrams/rollback-flow.drawio) |
