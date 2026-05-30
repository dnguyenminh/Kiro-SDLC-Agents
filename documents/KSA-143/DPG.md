# Deployment Guide (DPG)

## MCP Code Intelligence — KSA-143: KB Graph — Level of Detail (LOD) / Semantic Zoom

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-143 |
| Title | KB Graph LOD — Deployment Guide |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2026-05-29 |
| Status | Final |
| Related TDD | TDD-v2-KSA-143.docx |

---

## 1. Deployment Overview

### 1.1 Summary

LOD/Semantic Zoom is a **client-side only** feature. Deployment consists of:
- Copying new JS files to `shared/viewer/`
- Minor API route changes in 3 servers (NodeJS, Python, Kotlin)
- No infrastructure changes, no new services, no migrations

### 1.2 Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| LOD breaks existing graph rendering | Low | Medium | Feature flag `lodEnabled` (default true), UI toggle |
| Performance regression on large graphs | Low | Low | Budget enforcement (max 100 visible nodes) |
| API param breaks existing clients | Very Low | Low | `lod` param is optional, backward compatible |

### 1.3 Rollback Strategy

Disable LOD via feature flag (`lodEnabled: false` in config) or UI toggle. No data changes to revert.

---

## 2. Prerequisites

### 2.1 Pre-Deployment Checklist

| # | Item | Status |
|---|------|--------|
| 1 | All tests pass (`npm test`, `pytest`, `./gradlew test`) | Required |
| 2 | Code reviewed and merged to release branch | Required |
| 3 | No new dependencies required | Confirmed |
| 4 | No database migrations needed | Confirmed |
| 5 | No infrastructure changes needed | Confirmed |
| 6 | Feature flag documented | Confirmed (`lodEnabled`) |

### 2.2 Environment Requirements

| Component | Requirement |
|-----------|-------------|
| Node.js | >= 18.x (existing) |
| Python | >= 3.10 (existing) |
| Kotlin/JVM | >= 17 (existing) |
| Browser | ES2020 support (Chrome 80+, Firefox 78+, Edge 80+) |

---

## 3. Deployment Steps

### 3.1 Step 1 — Pull Latest Code

```bash
git checkout KSA-143
git pull origin KSA-143
```

### 3.2 Step 2 — Verify New Files Exist

```bash
# New LOD modules
ls shared/viewer/lod-manager.js
ls shared/viewer/lod-clustering.js
ls shared/viewer/lod-animation.js
```

### 3.3 Step 3 — Build NodeJS Server

```bash
cd mcp-code-intelligence-nodejs
npm install   # No new deps, but ensures lock consistency
npm run build
```

### 3.4 Step 4 — Build Kotlin Server

```bash
cd mcp-code-intelligence-kotlin
./gradlew build
# shared/ is copied at build time automatically
```

### 3.5 Step 5 — Python Server (No Build Step)

```bash
cd mcp-code-intelligence-python
# Python has no build step — just verify file exists
python -c "from mcp_code_intel.http.api_routes import app; print('OK')"
```

### 3.6 Step 6 — Restart Services

```bash
# NodeJS
pm2 restart mcp-code-intel-node  # or: systemctl restart mcp-node

# Python
pm2 restart mcp-code-intel-python  # or: systemctl restart mcp-python

# Kotlin
systemctl restart mcp-kotlin  # or: java -jar build/libs/mcp-code-intel.jar
```

### 3.7 Step 7 — VS Code Extension

The VS Code extension loads `shared/viewer/` from the installed extension path. Users get the update on next extension update (marketplace publish) or manual reload.

---

## 4. Post-Deployment Verification

### 4.1 Sanity Tests

| # | Test | Expected Result | Pass |
|---|------|-----------------|------|
| 1 | Open KB Graph with > 100 nodes | Clusters visible, LOD active | |
| 2 | Zoom into a cluster | Cluster expands with animation | |
| 3 | Zoom out from expanded cluster | Cluster collapses back | |
| 4 | Toggle LOD off via UI | All nodes render directly | |
| 5 | API call `?lod=true` | Response includes `totalNodes`, `totalEdges` | |
| 6 | API call without `lod` param | Response unchanged (backward compat) | |
| 7 | Graph with < 100 nodes | LOD not activated (direct render) | |

### 4.2 Performance Verification

```bash
# NodeJS API response time (should be < 500ms for 5000 nodes)
curl -w "%{time_total}" "http://localhost:3000/api/graph/data?limit=5000&lod=true"

# Verify totalNodes in response
curl -s "http://localhost:3000/api/graph/data?lod=true" | jq '.totalNodes'
```

### 4.3 Rollback Verification

If issues found:
1. Set `lodEnabled: false` in config — LOD disabled, graph renders normally
2. Or: revert to previous commit on `shared/viewer/graph.js`

---

## 5. Configuration

### 5.1 Feature Flag

| Config Key | Default | Description |
|-----------|---------|-------------|
| `lodEnabled` | `true` | Enable/disable LOD globally |

### 5.2 LOD Parameters (Client-Side)

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `maxVisibleNodes` | 100 | 50-500 | Node budget |
| `expandThreshold` | 50 | 20-100 | Distance to expand (world units) |
| `collapseThreshold` | 70 | auto | Distance to collapse (1.4x expand) |
| `animationDuration` | 400 | 200-1000 | Animation time (ms) |

---

## 6. Monitoring and Alerts

### 6.1 Client-Side Monitoring

- Browser console warnings for LOD errors (LOD-001 through LOD-004)
- `performance.mark('lod-clustering-start/end')` for timing
- No server-side metrics needed

### 6.2 Known Limitations

- LOD only activates for graphs with > 100 nodes
- WebGL context loss requires page reload
- Clustering may take up to 2s for 5000+ nodes (one-time on load)

---

## 7. Rollback Plan

### 7.1 Quick Rollback (No Redeploy)

```javascript
// In browser console or config:
window.lodInstance?.setConfig({ lodEnabled: false });
```

### 7.2 Full Rollback (Redeploy)

```bash
git revert HEAD  # Revert LOD commit
npm run build    # Rebuild
pm2 restart all  # Restart services
```

### 7.3 Rollback Decision Matrix

| Symptom | Action |
|---------|--------|
| Graph does not render at all | Full rollback |
| LOD animations janky | Disable via config, investigate |
| API errors on `lod=true` | Disable client-side, fix backend |
| Performance worse than before | Disable via config, profile |

---

## Appendix: Affected Files Summary

| # | File | Change Type | Server |
|---|------|-------------|--------|
| 1 | `shared/viewer/lod-manager.js` | NEW | All |
| 2 | `shared/viewer/lod-clustering.js` | NEW | All |
| 3 | `shared/viewer/lod-animation.js` | NEW | All |
| 4 | `shared/viewer/graph.js` | MODIFIED | All |
| 5 | `shared/viewer/index.html` | MODIFIED | All |
| 6 | `src/http/api-routes.ts` | MODIFIED | NodeJS |
| 7 | `src/mcp_code_intel/http/api_routes.py` | MODIFIED | Python |
| 8 | `src/main/kotlin/.../MemoryApiRoutes.kt` | MODIFIED | Kotlin |
