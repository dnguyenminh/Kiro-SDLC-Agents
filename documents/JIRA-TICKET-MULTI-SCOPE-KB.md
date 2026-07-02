# Jira Ticket — Multi-Scope Knowledge Base

## Ticket Details

| Field | Value |
|-------|-------|
| **Project** | KSA |
| **Type** | Story |
| **Summary** | Multi-Scope KB — 3-level scope isolation (USER/PROJECT/SHARED) với auto-promotion service |
| **Priority** | High |
| **Labels** | kb, scope, multi-tenant, promotion |
| **Epic Link** | (nếu có Epic KB/Memory) |

---

## Description

### Mục tiêu

Implement hệ thống scope isolation cho Knowledge Base với 3 cấp độ visibility:
- **USER** — private, chỉ owner thấy
- **PROJECT** — team-level, tất cả members trong project thấy
- **SHARED** — company-wide, mọi người đều thấy

### Thiết kế tổng quan

#### 1. Data Model

Mỗi KB entry có 2 trường mới:
- `scope` (TEXT NOT NULL DEFAULT 'USER') — enum: USER | PROJECT | SHARED
- `user_id` (TEXT DEFAULT NULL) — identifies entry owner cho USER-scope isolation

#### 2. Scope Visibility Rules

Khi user search/list KB entries:
- **Thấy**: Tất cả entries có scope = PROJECT hoặc SHARED
- **Thấy**: Entries có scope = USER **VÀ** user_id = current user
- **KHÔNG thấy**: Entries scope = USER của user khác

SQL clause: `(scope IN ('PROJECT', 'SHARED') OR (scope = 'USER' AND user_id = ?))`

#### 3. Scope Transitions

**promoteEntry()**: USER → PROJECT → SHARED (chỉ 1 bước mỗi lần)
- USER → PROJECT: qua auto-scan hoặc admin approve
- PROJECT → SHARED: **LUÔN** yêu cầu admin approve

**demoteEntry()**: SHARED → PROJECT → USER (chỉ 1 bước mỗi lần)

#### 4. ScopePromotionService (Option D — Hybrid)

**4.1. Ingestion (trực tiếp)**
- Agent ingest entry → default scope = USER
- Agent có thể explicit set scope = PROJECT khi ingest (nếu biết entry có giá trị team-wide)

**4.2. Background Scan — Auto-detect high-value USER entries**

Scan criteria (cần đạt ≥ 2/4 tiêu chí):
| # | Criterion | Threshold | Score Weight |
|---|-----------|-----------|-------------|
| 1 | Citations (cross-agent usage) | ≥ 2 | 30 |
| 2 | Access count | ≥ 5 | 25 |
| 3 | Quality score | ≥ 70 | 25 |
| 4 | Cross-agent citations (distinct agents) | ≥ 2 | 20 |

Điều kiện bổ sung: entry phải ≥ 24h tuổi (không promote transient working memory)

**4.3. Auto-queue → kb_promotion_queue**

Entries đạt criteria → tạo record PENDING trong `kb_promotion_queue`:
- Admin approve → promote scope USER → PROJECT
- Admin reject → entry vẫn giữ nguyên scope

**⚠️ THAY ĐỔI THIẾT KẾ: KHÔNG có 7-day cooldown khi reject.**
- Entry bị reject vẫn có thể được re-scan và re-queue ngay lần scan tiếp theo
- Lý do: admin có thể miss entry, không nên penalize entry chỉ vì 1 lần reject
- Implementation: KHÔNG set `cooldown_until` khi reject, hoặc set = NULL

**4.4. PROJECT → SHARED: LUÔN manual approve**
- User/agent request promote PROJECT → SHARED qua `requestSharedPromotion()`
- Admin phải review và approve

#### 5. Tool mới: mem_promote

| Action | Description | Input |
|--------|-------------|-------|
| `scan` | Chạy background scan, tìm candidates | `{ action: "scan" }` |
| `list` | List pending promotions cho admin review | `{ action: "list", limit?: number }` |
| `approve` | Admin approve pending promotion | `{ action: "approve", entry_id: number, comment: string }` |
| `reject` | Admin reject pending promotion | `{ action: "reject", entry_id: number, comment: string }` |
| `request_shared` | Request promote PROJECT → SHARED | `{ action: "request_shared", entry_id: number, reason: string }` |

#### 6. Changes to existing tools

- **mem_search**: Filter results theo scope clause (user chỉ thấy own USER + PROJECT + SHARED)
- **mem_crud**: 
  - `list` action: filter theo scope
  - `get` action: verify user có quyền xem entry
- **mem_ingest**: Accept optional `scope` param (default: USER), `user_id` auto-set từ context

### Acceptance Criteria

- [ ] KB entries có field `scope` (USER/PROJECT/SHARED) và `user_id`
- [ ] mem_search trả về đúng entries theo scope visibility rules
- [ ] mem_crud list/get filter đúng theo scope
- [ ] mem_ingest default scope=USER, có thể explicit scope=PROJECT
- [ ] promoteEntry() chỉ cho phép 1-step promotion (USER→PROJECT, PROJECT→SHARED)
- [ ] demoteEntry() chỉ cho phép 1-step demotion (SHARED→PROJECT, PROJECT→USER)
- [ ] ScopePromotionService scan đúng criteria (≥2/4)
- [ ] Entries đạt criteria được queue vào kb_promotion_queue (PENDING)
- [ ] Admin approve → entry scope updated
- [ ] Admin reject → KHÔNG có cooldown — entry eligible cho lần scan tiếp theo
- [ ] PROJECT → SHARED: LUÔN yêu cầu manual approve
- [ ] mem_promote tool hoạt động đúng 5 actions
- [ ] Migration script thêm columns scope + user_id + indexes

### Technical Notes

- Database: SQLite (better-sqlite3), thêm columns vào `knowledge_entries`
- New table: `kb_promotion_queue`
- Indexes: `idx_ke_scope`, `idx_ke_user_id`, `idx_ke_scope_user`
- ScopeContext interface: `{ userId: string, projectId?: string }`
- Config: PromotionConfig với thresholds tunable

### Out of Scope

- Multi-project isolation (mỗi project riêng DB) — future
- Role-based access control (RBAC) — future
- Audit trail cho scope changes (đã có basic audit log)
