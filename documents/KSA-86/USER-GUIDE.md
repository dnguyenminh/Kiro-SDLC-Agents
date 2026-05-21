# KB Web Viewer — User Guide

## Hướng dẫn sử dụng Knowledge Base Web Viewer

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Date | 2025-01-27 |
| Audience | Developers, Tech Leads, KB Administrators |
| Access | http://localhost:3201 |

---

## Mục lục

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Graph Page — Knowledge Graph 3D](#2-graph-page)
3. [Dashboard — Bảng điều khiển sức khỏe KB](#3-dashboard)
4. [Tags — Khám phá phân loại nội dung](#4-tags-page)
5. [Quality — Giám sát chất lượng](#5-quality-page)
6. [Analytics — Phân tích hành vi tìm kiếm](#6-analytics-page)
7. [Quy trình làm việc đề xuất](#7-quy-trình-làm-việc)
8. [Semantic Tool Search & Embedding Models](#8-semantic-tool-search--embedding-models-ksa-102)

---

## 1. Tổng quan hệ thống

### KB Web Viewer là gì?

KB Web Viewer là giao diện web trực quan cho hệ thống Knowledge Base nội bộ. Nó cho phép bạn **nhìn thấy** toàn bộ tri thức đã tích lũy — từ decisions, architecture patterns, error solutions đến procedures — dưới dạng đồ thị, biểu đồ và bảng dữ liệu.

### Tại sao cần Web Viewer?

| Vấn đề | Giải pháp của Viewer |
|--------|---------------------|
| KB có hàng trăm entries nhưng không biết chất lượng ra sao | Dashboard hiển thị health score tổng quan |
| Không biết entries nào đã cũ, cần cập nhật | Due Reviews section cảnh báo entries quá hạn |
| Tìm kiếm bằng text không hiệu quả | Tags page + auto-suggest giúp khám phá theo taxonomy |
| Không biết team đang tìm gì mà KB chưa có | Analytics page hiển thị "content gaps" |
| Entries chất lượng thấp lẫn với entries tốt | Quality page phân loại và highlight entries cần cải thiện |

### Kiến trúc

```
Browser (port 3201) ──→ Python HTTP Server ──→ SQLite Memory DB
     ↑                        ↑
     │ HTML pages             │ API endpoints (/api/kb/*)
     │ (server-rendered)      │ (JSON responses)
     └────────────────────────┘
```

- **Không cần cài đặt thêm** — chạy cùng MCP server
- **Zero dependencies** — vanilla HTML/CSS/JS, không framework
- **Dark theme** — tối ưu cho developer workflow
- **Responsive** — hoạt động trên mọi kích thước màn hình

---

## 2. Graph Page

**URL:** `http://localhost:3201/`

![Graph Page](screenshots/graph.png)

### Đây là gì?

Trang chủ hiển thị **Knowledge Graph 3D** — biểu đồ mạng lưới thể hiện mối quan hệ giữa các entries trong KB. Mỗi node là một entry, mỗi edge là một relationship (related_to, depends_on, supersedes...).

Trang này có **4 tabs** chuyển đổi giữa các chế độ xem:

| Tab | Chức năng |
|-----|-----------|
| 🧠 Graph | Đồ thị 3D quan hệ giữa entries |
| 📋 Sessions | Lịch sử phiên làm việc của agents |
| 🔍 Browser | Duyệt và lọc entries theo tier/type |
| ⚡ Stream | Live stream các operations đang xảy ra |

---

### 2.1 Tab: 🧠 Graph (3D Knowledge Graph)

### Tại sao cần dùng?

- **Phát hiện clusters** — nhóm entries liên quan chặt chẽ sẽ tụ lại gần nhau
- **Tìm orphan nodes** — entries không liên kết với gì → có thể thiếu context hoặc cần bổ sung relationships
- **Hiểu knowledge topology** — biết domain nào có nhiều tri thức, domain nào còn mỏng

### Cách sử dụng

1. Mở browser tại `http://localhost:3201/`
2. Đồ thị 3D tự động render với tất cả entries và relationships
3. **Xoay** — kéo chuột trái để xoay góc nhìn
4. **Zoom** — scroll wheel hoặc middle-click để phóng to/thu nhỏ
5. **Pan** — kéo chuột phải để di chuyển
6. **Click node** — xem chi tiết entry (type, summary, tags)
7. **Search** — gõ vào ô search để highlight entries matching
8. **Jump to** — dropdown chọn module để focus vào cluster cụ thể
9. **Fit** — button ⊞ để zoom fit tất cả nodes vào viewport
10. **Reset** — button ↺ để reset camera về vị trí ban đầu

**Thông tin hiển thị:**
- Tổng số Entries, Edges, Vectors, Tiers
- Legend màu sắc theo type (REQUIREMENT, ARCHITECTURE, CODE_ENTITY, DECISION, ERROR_PATTERN, PROCEDURE, CONTEXT)
- Recent Entries panel bên phải

---

### 2.2 Tab: 📋 Sessions

![Sessions Tab](screenshots/sessions-tab.png)

### Đây là gì?

Hiển thị **lịch sử phiên làm việc** của tất cả MCP clients (agents) đã kết nối với KB. Mỗi session là một lần agent mở kết nối và thực hiện operations.

### Thông tin hiển thị

| Cột | Ý nghĩa |
|-----|---------|
| Agent name | Tên client kết nối (VD: MCP-CLIENT) |
| Status | `active` (đang chạy) hoặc `ended` (đã kết thúc) |
| Time range | Thời gian bắt đầu — kết thúc (hoặc "active") |
| Observations | Số operations đã thực hiện trong session |

### Bộ lọc

- **Agent name** — lọc theo tên agent cụ thể
- **Status** — All / Active / Ended

### Tại sao cần dùng?

- **Audit trail** — biết ai đã truy cập KB, khi nào, làm gì
- **Debug** — session nào có nhiều observations bất thường?
- **Usage tracking** — bao nhiêu sessions active? KB có đang được dùng?

---

### 2.3 Tab: 🔍 Browser

![Browser Tab](screenshots/browser-tab.png)

### Đây là gì?

**Entry browser** — cho phép duyệt tất cả entries trong KB với bộ lọc mạnh mẽ. Đây là cách nhanh nhất để tìm và đọc entries cụ thể.

### Bộ lọc

| Filter | Options | Mục đích |
|--------|---------|----------|
| **Tier** | All / WORKING / EPISODIC / SEMANTIC / PROCEDURAL | Lọc theo mức độ trưởng thành |
| **Type** | All / CONTEXT / DECISION / ERROR_PATTERN / ARCHITECTURE / REQUIREMENT / PROCEDURE / LESSON_LEARNED / CODE_ENTITY / API_DESIGN | Lọc theo loại knowledge |
| **Sort** | Newest / Most accessed / Confidence | Sắp xếp kết quả |
| **Search** | Full-text search | Tìm kiếm nội dung |

### Thông tin mỗi entry

- **Type badge** — loại entry (màu sắc khác nhau)
- **Tier badge** — mức tier hiện tại
- **Summary** — nội dung tóm tắt
- **Metadata** — ID, Access count, Confidence score, Source

### Tại sao cần dùng?

- **Browse by tier** — xem entries SEMANTIC (đã consolidate) vs WORKING (mới tạo)
- **Find by type** — "Tôi cần tất cả DECISION entries" → lọc type = DECISION
- **Sort by confidence** — entries nào đáng tin nhất? Sort by Confidence
- **Sort by access** — entries nào được dùng nhiều nhất? Sort by Most accessed
- **Full-text search** — tìm bất kỳ nội dung nào trong KB

---

### 2.4 Tab: ⚡ Stream (Live Operations)

![Stream Tab](screenshots/stream-tab.png)

### Đây là gì?

**Real-time activity stream** — hiển thị tất cả operations đang xảy ra trên KB ngay lúc này. Giống như log viewer nhưng trực quan hơn.

### Thông tin hiển thị

| Cột | Ý nghĩa |
|-----|---------|
| Timestamp | Thời gian chính xác operation xảy ra |
| Type | TOOL_CALL / INGEST / SEARCH / DELETE / etc. |
| Session | Session ID thực hiện operation |
| Detail | Chi tiết operation (tool name, parameters, duration) |

### Controls

- **⏸ Pause** — tạm dừng stream (không mất data, chỉ dừng hiển thị)
- **↑ Oldest first** — đảo thứ tự (mới nhất/cũ nhất trước)
- **Clear** — xóa stream hiện tại

### Tại sao cần dùng?

- **Debug real-time** — xem agent đang làm gì ngay lúc này
- **Performance monitoring** — mỗi tool call hiển thị duration (ms) → phát hiện slow operations
- **Verify operations** — confirm rằng ingest/search/delete đã thực sự xảy ra
- **Understand agent behavior** — xem sequence of operations agent thực hiện

### Hiệu quả

| Metric | Trước | Sau khi dùng Graph |
|--------|-------|-------------------|
| Thời gian hiểu cấu trúc KB | 30+ phút đọc list | 30 giây nhìn graph |
| Phát hiện entries cô lập | Không thể | Ngay lập tức (orphan nodes) |
| Hiểu dependencies | Phải đọc từng entry | Visual — nhìn edges |

### Hướng dẫn cải thiện từ Graph

| Vấn đề phát hiện | Cách khắc phục |
|-------------------|---------------|
| **Orphan nodes** (nodes không có edge) | Dùng `mem_graph(action="add_edge", source_id=X, target_id=Y, relation="related_to")` để tạo relationships |
| **Cluster quá lớn** (1 nhóm quá nhiều nodes) | Xem xét tách entries thành sub-topics, thêm tags phân loại chi tiết hơn |
| **Cluster quá nhỏ** (2-3 nodes cô lập) | Kiểm tra xem entries có liên quan đến cluster lớn không → add edges |
| **Không thấy domain quan trọng** | KB thiếu content cho domain đó → tạo entries mới bằng `mem_ingest` |

---

## 3. Dashboard

**URL:** `http://localhost:3201/dashboard`

![Dashboard Page](screenshots/dashboard.png)

### Đây là gì?

Bảng điều khiển tổng quan hiển thị **sức khỏe toàn diện** của Knowledge Base. Giống như dashboard của xe hơi — một cái nhìn cho biết mọi thứ có ổn không.

### Các thành phần

#### 3.1 Health Score (Gauge)

**Công thức tính:**
- Tỷ lệ entries có owner
- Tỷ lệ entries được review trong 90 ngày
- Điểm quality trung bình
- Tỷ lệ entries có tags

**Ý nghĩa màu sắc:**
| Màu | Score | Trạng thái |
|-----|-------|-----------|
| 🟢 Xanh | ≥ 70 | Healthy — KB đang tốt |
| 🟡 Vàng | 40-69 | Needs Attention — cần cải thiện |
| 🔴 Đỏ | < 40 | Critical — cần hành động ngay |

#### 3.2 Metrics Cards (4 thẻ)

| Card | Ý nghĩa | Hành động khi cao/thấp |
|------|---------|------------------------|
| **Total Entries** | Tổng số entries trong KB | Nếu quá ít → cần ingest thêm knowledge |
| **Quality Avg** | Điểm chất lượng trung bình (0-100) | Nếu < 50 → nhiều entries cần cải thiện |
| **Stale** | Entries chưa review > 90 ngày | Nếu > 20% total → cần review campaign |
| **Unowned** | Entries không có owner | Nếu > 0 → assign owner để có accountability |

#### 3.3 Recommendations

Danh sách **hành động cụ thể** hệ thống đề xuất, sắp xếp theo priority:

- 🔴 **High priority** (viền đỏ) — Ảnh hưởng trực tiếp đến chất lượng KB
- 🟡 **Medium** (viền vàng) — Nên làm sớm
- 🟢 **Low** (viền xanh) — Nice to have

**Ví dụ recommendations:**
- "Review 12 stale entries (last reviewed > 90 days)"
- "Assign owners to 8 unowned entries"
- "Consider merging 3 duplicate entries"

#### 3.4 Due Reviews

Bảng hiển thị entries **cần được review** — đã quá hạn theo lịch review đã set.

| Cột | Ý nghĩa |
|-----|---------|
| ID | Entry ID (click để xem chi tiết qua MCP tool) |
| Summary | Tóm tắt nội dung entry |
| Last Reviewed | Lần cuối được review |
| Overdue | Số ngày quá hạn (màu vàng = cảnh báo) |

**Tại sao quan trọng?** Tri thức cũ có thể sai. Một entry về "cách deploy" viết 6 tháng trước có thể đã outdated nếu infrastructure thay đổi.

#### 3.5 Trends (7 days)

Hai biểu đồ cột hiển thị xu hướng 7 ngày gần nhất:

- **Search Volume** — Số lượt tìm kiếm/ngày → KB có đang được sử dụng?
- **Ingest Volume** — Số entries mới/ngày → KB có đang được bổ sung?

**Đọc trends:**
| Pattern | Ý nghĩa |
|---------|---------|
| Search tăng, Ingest giảm | Team đang cần knowledge nhưng không ai contribute |
| Search giảm | Team có thể không biết KB tồn tại, hoặc KB không hữu ích |
| Ingest tăng đều | Healthy — team đang actively contribute |

### Tại sao cần Dashboard?

> Bạn không thể cải thiện thứ bạn không đo lường được.

Dashboard biến KB từ "kho chứa bị lãng quên" thành **hệ thống có accountability**:
- Biết ngay KB có healthy không (1 giây nhìn gauge)
- Biết cần làm gì tiếp theo (recommendations)
- Biết entries nào cần attention (due reviews)
- Biết xu hướng sử dụng (trends)

### Hiệu quả

| Không có Dashboard | Có Dashboard |
|-------------------|--------------|
| Không biết KB quality | Biết ngay score 72/100 |
| Entries cũ bị quên | Reminders nhắc review |
| Không biết ai dùng KB | Trends cho thấy usage |
| Reactive (chờ vấn đề xảy ra) | Proactive (thấy vấn đề trước) |

### Hướng dẫn cải thiện từ Dashboard

| Chỉ số | Ngưỡng cảnh báo | Hành động cải thiện |
|--------|-----------------|---------------------|
| **Health Score < 40** | Critical | Chạy `mem_lifecycle(action="detect_stale")` → review tất cả stale entries |
| **Stale > 20%** | Nhiều entries cũ | Dùng `mem_lifecycle(action="due_reviews", days=90)` → lấy danh sách → review từng entry |
| **Unowned > 0** | Thiếu accountability | Dùng `mem_crud(action="get", id=X)` xem entry → assign owner bằng cách edit content thêm `Owner: @name` |
| **Quality Avg < 50** | Content kém | Chuyển sang Quality page → fix low-score entries (xem hướng dẫn bên dưới) |
| **Search trend giảm** | KB không được dùng | Kiểm tra: content có outdated? Promote KB trong team standup |
| **Ingest trend = 0** | Không ai contribute | Tạo habit: mỗi khi giải quyết vấn đề → `mem_ingest` solution vào KB |

**Cải thiện Health Score nhanh nhất:**
1. Assign owners cho unowned entries: `mem_scoring(action="quality_score", entry_id=X)` → xem thiếu gì
2. Review stale entries: `mem_lifecycle(action="mark_reviewed", entry_id=X)`
3. Thêm tags cho entries chưa có: `mem_tags(action="tag", entry_id=X, tags="python,api")`

---

## 4. Tags Page

**URL:** `http://localhost:3201/tags`

![Tags Page](screenshots/tags.png)

### Đây là gì?

Trang khám phá **taxonomy** (hệ thống phân loại) của KB. Hiển thị tất cả tags đang được sử dụng, cấu trúc phân cấp, và cho phép tìm kiếm entries theo tag.

### Các thành phần

#### 4.1 Popular Tags (Tag Cloud)

- **Font size** tỷ lệ với số lần sử dụng — tag dùng nhiều = chữ to hơn
- **Màu sắc** unique cho mỗi tag (generated từ tên tag)
- **Số bên cạnh** = usage count (bao nhiêu entries gắn tag này)
- **Click** vào tag → tự động search entries có tag đó

**Đọc tag cloud:**
- Tags lớn nhất = domain knowledge chính của team
- Tags nhỏ = niche topics hoặc tags mới
- Nếu không thấy tag quan trọng → KB thiếu content cho domain đó

#### 4.2 Tag Taxonomy (Tree View)

Hiển thị **cấu trúc phân cấp** của tags:
- **Parent tags** (in đậm, màu xanh) = categories lớn
- **Child tags** = sub-categories cụ thể
- Click vào bất kỳ tag nào → search entries

**Tại sao cần taxonomy?**
- Giúp organize knowledge theo domain thay vì flat list
- Dễ navigate: "Tôi cần tìm gì về infrastructure?" → mở nhánh infrastructure
- Phát hiện gaps: nhánh nào ít tags = ít knowledge

#### 4.3 Search by Tag (với Auto-suggest)

**Cách hoạt động:**
1. Gõ ≥ 2 ký tự vào ô search
2. Sau 200ms, hệ thống gọi `/api/kb/suggestions` và hiển thị dropdown
3. Click suggestion hoặc nhấn Enter → search entries matching
4. Kết quả hiển thị bên dưới với type badge + summary

**Auto-suggest giúp gì?**
- Không cần nhớ chính xác tên tag
- Khám phá entries liên quan mà bạn chưa biết tồn tại
- Giảm "zero-result searches" — luôn có gợi ý

### Tại sao cần Tags Page?

> Trong một KB có 200+ entries, browsing theo list là bất khả thi. Tags biến chaos thành structure.

| Scenario | Không có Tags | Có Tags Page |
|----------|--------------|--------------|
| "Tìm mọi thứ về Docker" | Search "docker" → miss entries tagged khác | Click tag "docker" → tất cả entries |
| "KB có gì về security?" | Không biết | Nhìn taxonomy → thấy nhánh security |
| "Tag nào phổ biến nhất?" | Không biết | Tag cloud → thấy ngay |
| "Tìm nhưng không nhớ keyword" | Stuck | Auto-suggest gợi ý |

### Hiệu quả

| Metric | Improvement |
|--------|-------------|
| Thời gian tìm entries theo topic | -70% (click tag vs. guess keywords) |
| Discovery rate (tìm thấy entries mới) | +50% (tag cloud reveals hidden content) |
| Zero-result searches | -60% (auto-suggest prevents bad queries) |

### Hướng dẫn cải thiện từ Tags Page

| Vấn đề phát hiện | Cách khắc phục |
|-------------------|---------------|
| **Tag cloud trống** | Entries chưa được gắn tag → Dùng `mem_tags(action="tag", entry_id=X, tags="topic1,topic2")` |
| **Taxonomy không có cấu trúc** | Tạo parent tags: `mem_tags(action="create", tag="development", category="tech")` rồi gắn child tags |
| **Một tag quá lớn** (>50 entries) | Tách thành sub-tags cụ thể hơn. VD: "python" → "python-async", "python-testing", "python-deployment" |
| **Search không ra kết quả** | Entry tồn tại nhưng thiếu tags → gắn thêm tags liên quan |
| **Tags trùng lặp** (python, Python, py) | Chuẩn hóa: chọn 1 tên → untag entries cũ, tag lại bằng tên chuẩn |

**Xây dựng taxonomy tốt:**
1. Xác định 5-7 top-level categories (development, infrastructure, process, security...)
2. Mỗi category có 3-10 child tags
3. Mỗi entry nên có 2-4 tags (1 category + 1-3 specific)
4. Review taxonomy monthly — merge tags ít dùng, tách tags quá lớn

---

## 5. Quality Page

**URL:** `http://localhost:3201/quality`

![Quality Page](screenshots/quality.png)

### Đây là gì?

Trang giám sát **chất lượng nội dung** KB. Cho biết entries nào tốt, entries nào cần cải thiện, và phân bố chất lượng tổng thể.

### Các thành phần

#### 5.1 Quality Overview (4 Stats Cards)

| Card | Ý nghĩa | Target |
|------|---------|--------|
| **Average Score** | Điểm quality trung bình toàn KB | > 60 là tốt |
| **Scored Entries** | Số entries đã được chấm điểm | Nên = Total Entries |
| **High Quality** | Entries có score ≥ 60 | Càng nhiều càng tốt |
| **Low Quality** | Entries có score < 40 | Target: 0 |

#### 5.2 Score Distribution (Bar Chart)

- **Trục X** = score buckets (0-10, 10-20, ..., 90-100)
- **Trục Y** = số entries trong mỗi bucket
- **Màu sắc:**
  - 🔴 Đỏ (0-29) = entries chất lượng kém
  - 🟡 Vàng (30-59) = entries cần cải thiện
  - 🟢 Xanh (60-100) = entries chất lượng tốt

**Đọc distribution:**
| Shape | Ý nghĩa |
|-------|---------|
| Lệch phải (nhiều xanh) | KB quality tốt |
| Lệch trái (nhiều đỏ) | KB cần cleanup campaign |
| Bimodal (2 đỉnh) | Có 2 nhóm: entries cũ kém + entries mới tốt |
| Đều (flat) | Quality không nhất quán — cần standards |

#### 5.3 Low Quality Entries (Table)

| ID | Type | Summary | Score | Bar |
|----|------|---------|-------|-----|
| 42 | CONTEXT | Old deployment notes... | 18 | ██░░ |
| 67 | DECISION | Temporary workaround... | 25 | ███░ |

**Cột giải thích:**
- **ID** — Entry ID, dùng để reference khi cần edit (`mem_crud action=get id=42`)
- **Type** — Loại entry (CONTEXT, DECISION, PROCEDURE, etc.)
- **Summary** — Tóm tắt nội dung (truncated 60 chars)
- **Score** — Điểm quality (0-100)
- **Bar** — Visual indicator màu sắc theo score

**Quality score tính dựa trên:**
- Độ dài content (quá ngắn = low score)
- Có tags không
- Có owner không
- Có được review gần đây không
- Format có structured không (headings, lists)

#### 5.4 Most Cited Entries (Table)

| ID | Summary | Citations |
|----|---------|-----------|
| 15 | API design patterns for KB | 12 |
| 23 | Docker deployment guide | 8 |

Hiển thị entries được **trích dẫn nhiều nhất** — tức là entries mà các entries khác reference đến.

**Tại sao quan trọng?**
- Entries nhiều citations = **knowledge hubs** — nếu chúng sai, nhiều thứ khác cũng sai
- Entries 0 citations = có thể isolated, cần link với context khác
- High-cited + Low-quality = **nguy hiểm** — cần fix ngay

### Tại sao cần Quality Page?

> Một KB với 500 entries nhưng 80% chất lượng kém còn tệ hơn KB 50 entries chất lượng cao. Quality > Quantity.

**Vòng lặp cải thiện:**
1. Nhìn distribution → biết tình trạng chung
2. Xem low-quality table → biết cụ thể entries nào cần fix
3. Fix entries (thêm content, tags, structure)
4. Score tự động tăng → distribution dịch sang phải
5. Repeat weekly

### Hiệu quả

| Không có Quality Page | Có Quality Page |
|----------------------|-----------------|
| Không biết entry nào kém | Sorted list entries cần fix |
| Fix random, không priority | Fix theo score (thấp nhất trước) |
| Không biết progress | Distribution chart cho thấy improvement |
| High-cited entries kém → cascade errors | Identified và prioritized |

### Hướng dẫn cải thiện từ Quality Page

**Cải thiện entry có score thấp — checklist:**

| Yếu tố | Cách cải thiện | Lệnh |
|---------|---------------|------|
| **Content quá ngắn** (<100 chars) | Bổ sung chi tiết: context, steps, examples | `mem_crud(action="get", id=X)` → edit → `mem_ingest` lại |
| **Thiếu tags** | Gắn 2-4 tags phù hợp | `mem_tags(action="tag", entry_id=X, tags="tag1,tag2")` |
| **Thiếu owner** | Assign người chịu trách nhiệm | Edit content thêm metadata owner |
| **Chưa review lâu** | Đọc lại, xác nhận còn đúng | `mem_lifecycle(action="mark_reviewed", entry_id=X)` |
| **Format kém** | Thêm headings, bullet points, code blocks | Restructure content theo template |

**Xử lý Most Cited entries có quality thấp (NGUY HIỂM):**
1. Xem entry: `mem_crud(action="get", id=X)`
2. Kiểm tra content có còn chính xác không
3. Nếu outdated → update content ngay
4. Nếu OK → improve format + thêm tags → score tự tăng
5. Verify: `mem_scoring(action="quality_score", entry_id=X)`

**Target hàng tuần:**
- Fix ít nhất 3-5 low-quality entries
- Mục tiêu: distribution chart dịch sang phải mỗi tuần
- Khi Low Quality count = 0 → KB đạt chuẩn

---

## 6. Analytics Page

**URL:** `http://localhost:3201/analytics`

![Analytics Page](screenshots/analytics.png)

### Đây là gì?

Trang phân tích **hành vi tìm kiếm** — cho biết team đang tìm gì, tìm bao nhiêu, và quan trọng nhất: **tìm gì mà không có kết quả** (content gaps).

### Các thành phần

#### 6.1 Search Volume Trend (Line Chart)

- **Line** = số lượt search mỗi ngày
- **Area fill** (xanh nhạt) = visual emphasis
- **Dots** = data points cụ thể

**Đọc trend:**
| Pattern | Ý nghĩa | Hành động |
|---------|---------|-----------|
| Tăng đều | KB đang được adopt | Tiếp tục maintain quality |
| Giảm đều | Team bỏ dùng KB | Kiểm tra: content outdated? UX kém? |
| Spike đột ngột | Có incident/project mới | Kiểm tra popular queries → bổ sung content |
| Flat ở 0 | Không ai dùng | Cần promote KB trong team |

#### 6.2 Popular Queries (Table)

| Query | Count | Avg Results |
|-------|-------|-------------|
| python setup | 8 | 3.2 |
| api design | 6 | 2.1 |
| docker build | 5 | 4.0 |

**Cột giải thích:**
- **Query** — Từ khóa team hay tìm nhất
- **Count** — Số lần tìm (badge xanh)
- **Avg Results** — Trung bình bao nhiêu kết quả trả về

**Insights từ Popular Queries:**
- Queries có Avg Results cao (>3) → KB cover tốt topic này
- Queries có Avg Results thấp (<1) → KB thiếu content, cần bổ sung
- Queries lặp lại nhiều → Đây là "hot topics" team cần → ưu tiên maintain

#### 6.3 Zero-Result Queries / Content Gaps (Table)

| Query | Count | Status |
|-------|-------|--------|
| grpc config | 5 | ⚠ Gap |
| k8s helm chart | 3 | ⚠ Gap |
| oauth2 flow | 2 | ⚠ Gap |

**Đây là phần quan trọng nhất của Analytics.**

- **Zero-result query** = team tìm nhưng KB không có gì → **content gap**
- **Count** = bao nhiêu lần tìm mà không có kết quả (badge vàng)
- **Status** = luôn là "Gap" — cần tạo content

**Quy trình xử lý gaps:**
1. Xem bảng gaps → sort theo count (nhiều nhất = urgent nhất)
2. Với mỗi gap: tạo entry mới trong KB cover topic đó
3. Sau khi tạo → gap tự biến mất (query sẽ có results)
4. Check lại weekly → gaps mới sẽ xuất hiện

### Tại sao cần Analytics Page?

> Analytics trả lời câu hỏi: "KB của chúng ta có đang phục vụ đúng nhu cầu team không?"

**Nó giải quyết 3 vấn đề:**

1. **Adoption tracking** — Trend chart cho biết KB có được sử dụng không
2. **Content prioritization** — Popular queries cho biết nên maintain content nào
3. **Gap identification** — Zero-results cho biết cần tạo content gì

### Hiệu quả

| Metric | Không có Analytics | Có Analytics |
|--------|-------------------|--------------|
| Biết team cần gì | Đoán | Data-driven (popular queries) |
| Biết KB thiếu gì | Chờ ai đó complain | Proactive (zero-result gaps) |
| Biết KB có được dùng | Không biết | Trend chart real-time |
| Content creation priority | Random | Sorted by demand (count) |

### Hướng dẫn cải thiện từ Analytics Page

**Xử lý Content Gaps (Zero-Result Queries):**

| Bước | Hành động | Lệnh |
|------|-----------|------|
| 1 | Xem gap query | Đọc bảng Zero-Result trên UI |
| 2 | Kiểm tra KB thật sự không có | `mem_search(query="<gap query>")` — nếu có results → vấn đề là search indexing |
| 3 | Nếu thật sự thiếu → tạo entry mới | `mem_ingest(content="...", type="PROCEDURE/CONTEXT/DECISION", tags="relevant,tags")` |
| 4 | Verify gap đã được fill | Search lại → phải có results |

**Cải thiện Search Volume (khi trend giảm):**

| Nguyên nhân | Giải pháp |
|-------------|-----------|
| Team không biết KB tồn tại | Demo trong team meeting, thêm link vào README |
| Content outdated → team mất tin tưởng | Chạy review campaign (xem Dashboard Due Reviews) |
| Search không ra kết quả → team bỏ cuộc | Fix content gaps (bảng Zero-Result) |
| UX khó dùng | Cải thiện tags taxonomy → dễ browse hơn |

**Tối ưu Popular Queries:**
- Query có Avg Results < 1 → tương tự gap, cần tạo content
- Query có Avg Results > 10 → quá nhiều results, cần tags cụ thể hơn để filter
- Query lặp lại hàng ngày → pin entry quan trọng nhất lên top (boost via citations)

---

## 7. Quy trình làm việc đề xuất

### 7.1 Daily Check (2 phút)

1. Mở **Dashboard** → nhìn Health Score
2. Nếu có recommendations đỏ → xử lý ngay
3. Glance **Due Reviews** → nếu có entries overdue > 30 ngày → schedule review

### 7.2 Weekly Review (15 phút)

1. **Analytics** → check zero-result gaps
   - Có gaps mới? → Tạo entries cover topics đó
2. **Quality** → check low-quality table
   - Pick 3-5 entries score thấp nhất → improve content
3. **Tags** → browse taxonomy
   - Có tags mới cần organize? → Tạo parent categories

### 7.3 Monthly Audit (30 phút)

1. **Dashboard** → compare Health Score với tháng trước
2. **Quality** → distribution chart dịch sang phải chưa?
3. **Analytics** → search volume trend tăng hay giảm?
4. **Graph** → có orphan clusters mới không?
5. Document findings → ingest vào KB dưới dạng CONTEXT entry

### 7.4 Content Gap Sprint (khi cần)

Khi zero-result gaps > 10 entries:
1. Export danh sách gaps từ Analytics
2. Assign mỗi gap cho 1 team member
3. Deadline: 1 tuần tạo entries cover gaps
4. Verify: gaps biến mất khỏi Analytics

---

## 8. Semantic Tool Search & Embedding Models (KSA-102)

### Đây là gì?

Hệ thống **tìm kiếm tool thông minh** cho `find_tools`. Thay vì chỉ match exact keywords, hệ thống hiểu ngữ nghĩa query và tự học từ kết quả trước đó.

### Tại sao cần?

| Vấn đề | Giải pháp |
|--------|-----------|
| Query "search jira issues" không match tool tên "jira_search" | Embedding search hiểu ngữ nghĩa tương đồng |
| Mỗi lần tìm lại phải chờ embedding (~50ms) | Adaptive Cache tự học — lần sau instant (0ms) |
| Model English-only không hiểu tiếng Việt | Model Manager cho phép download multilingual model |

### Cách hoạt động (5-Tier Search)

```
find_tools("tìm kiếm jira")
    │
    ├─ Tier 1: Registry (tokenized match) ──→ Hit? Return ngay (0ms)
    │
    ├─ Tier 2: Adaptive Cache (fuzzy 80%) ──→ Hit? Return ngay (0ms)
    │
    ├─ Tier 3: Embedding Search (ONNX) ────→ Hit? Return + Cache (50-100ms)
    │
    ├─ Tier 4: Delegate to nested servers ──→ Hit? Return
    │
    └─ Tier 5: KB fallback ─────────────────→ Hit? Return
```

**Self-learning:** Mỗi lần Tier 3 (embedding) tìm được kết quả → tự động cache lại. Lần sau cùng query → Tier 2 hit ngay (0ms). Hệ thống càng dùng càng nhanh.

### Model Manager — Quản lý Embedding Models

**Tool:** `mem_model_manager`

#### Xem models có sẵn

```
mem_model_manager(action="list")
```

| Model | Size | Languages | Mô tả |
|-------|------|-----------|--------|
| `all-MiniLM-L6-v2` | 90MB | English | Default, nhanh, tốt cho tool names tiếng Anh |
| `paraphrase-multilingual-MiniLM-L12-v2` | 470MB | 50+ (vi, zh, ja, ko...) | Hỗ trợ đa ngôn ngữ |

#### Kiểm tra model hiện tại

```
mem_model_manager(action="status")
```

Response:
```json
{
  "active_model": "all-MiniLM-L6-v2",
  "model_path": "~/.code-intel/models/all-MiniLM-L6-v2",
  "dimensions": 384,
  "languages": ["en"]
}
```

#### Download multilingual model

```
mem_model_manager(action="download", model_name="paraphrase-multilingual-MiniLM-L12-v2")
```

Download chạy background — không block. Sau khi xong, switch sang model mới:

```
mem_model_manager(action="switch", model_name="paraphrase-multilingual-MiniLM-L12-v2")
```

> ⚠️ Switch model sẽ xóa toàn bộ token cache (vì embeddings thay đổi). Cache sẽ tự rebuild khi dùng.

### Adaptive Token Cache

**File:** `{workspace}/.code-intel/token-cache.json`

Cache tự động:
- **Persist** — survive server restart
- **LRU eviction** — max 10,000 entries, xóa entries ít dùng nhất
- **Invalidation** — khi tool registry thay đổi, cache entries cũ bị xóa
- **Debounced write** — ghi file tối đa 1 lần / 5 giây (không spam disk)

### Multilingual Hint

Khi bạn search bằng tiếng Việt/Trung/Nhật... mà model hiện tại là English-only:
- Hệ thống tự động hiển thị tip: "💡 Download multilingual model for better support"
- Chỉ hiện **1 lần per session** (không spam)
- Không bắt buộc — bạn quyết định có download hay không

### Storage Paths

| Loại | Path | Scope |
|------|------|-------|
| Models | `~/.code-intel/models/` | Global (shared across workspaces) |
| Registry | `~/.code-intel/models/registry.json` | Global |
| Token Cache | `{workspace}/.code-intel/token-cache.json` | Per-workspace |

### Hiệu quả

| Metric | Không có KSA-102 | Có KSA-102 |
|--------|-----------------|------------|
| Query "search jira" → tool "jira_search" | ❌ Miss | ✅ Hit (embedding) |
| Lần 2 cùng query | ❌ Miss lại | ✅ Cache hit (0ms) |
| Query tiếng Việt | ❌ Không hiểu | ✅ Multilingual model |
| Thời gian tìm tool | Phụ thuộc exact match | < 100ms worst case |

### Hướng dẫn cải thiện

| Vấn đề | Giải pháp |
|--------|-----------|
| find_tools không tìm được tool | Kiểm tra `mem_model_manager(action="status")` — model có active? |
| Query tiếng Việt không ra kết quả | Download + switch sang multilingual model |
| Cache quá lớn (>5MB) | Tự động LRU eviction — không cần can thiệp |
| Muốn reset cache | Xóa file `.code-intel/token-cache.json` |
| Model download fail | Kiểm tra network, retry: `mem_model_manager(action="download", ...)` |

---

## Tổng kết

| Page | Trả lời câu hỏi | Frequency |
|------|-----------------|-----------|
| **Graph** | "KB structure trông như thế nào?" | Monthly |
| **Dashboard** | "KB có healthy không? Cần làm gì?" | Daily |
| **Tags** | "Tìm entries theo topic?" | On-demand |
| **Quality** | "Entries nào cần cải thiện?" | Weekly |
| **Analytics** | "Team cần gì mà KB chưa có?" | Weekly |
| **Embedding/Models** | "find_tools không tìm được? Model nào đang dùng?" | On-demand |

> 💡 **Nguyên tắc vàng:** Dành 5 phút/ngày trên Dashboard + 15 phút/tuần trên Quality & Analytics = KB luôn healthy, team luôn tìm được thứ họ cần.
