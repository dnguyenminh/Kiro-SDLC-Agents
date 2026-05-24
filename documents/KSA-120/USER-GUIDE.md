# User Guide (UG)

## Kiro SDLC Agents Extension v2.0 — Hướng dẫn sử dụng

---

## Thông tin tài liệu

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-120 |
| Title | Bundle MCP NodeJS Server + Native VS Code Webview KB Panels |
| Author | BA Agent |
| Reviewer | SM Agent |
| Version | 1.0 |
| Date | 2025-05-23 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-120.docx |
| Related FSD | FSD-v1-KSA-120.docx |
| Related TDD | TDD-v1-KSA-120.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-05-23 | BA Agent | Initial User Guide — zero-config focus |
| 1.1 | 2025-05-24 | BA Agent | Updated for HTTP transport, port 9180, Stop/Start/Change Port commands |

---

## Mục lục

1. [Giới thiệu](#1-giới-thiệu)
2. [Cài đặt & Bắt đầu](#2-cài-đặt--bắt-đầu)
3. [Sidebar — Thanh điều hướng bên trái](#3-sidebar--thanh-điều-hướng-bên-trái)
4. [KB Dashboard — Bảng điều khiển](#4-kb-dashboard--bảng-điều-khiển)
5. [KB Graph — Đồ thị tri thức 3D](#5-kb-graph--đồ-thị-tri-thức-3d)
6. [KB Tags — Khám phá theo chủ đề](#6-kb-tags--khám-phá-theo-chủ-đề)
7. [KB Quality — Giám sát chất lượng](#7-kb-quality--giám-sát-chất-lượng)
8. [KB Analytics — Phân tích sử dụng](#8-kb-analytics--phân-tích-sử-dụng)
9. [Quản lý MCP Server](#9-quản-lý-mcp-server)
10. [Xử lý sự cố](#10-xử-lý-sự-cố)
11. [Câu hỏi thường gặp (FAQ)](#11-câu-hỏi-thường-gặp-faq)

---

## 1. Giới thiệu

### Extension này là gì?

**Kiro SDLC Agents** là extension cho VS Code (và Kiro IDE) giúp bạn:

- 🧠 **Quản lý tri thức** — Lưu trữ và tìm kiếm kiến thức dự án (decisions, patterns, procedures...)
- 📊 **Trực quan hóa** — Xem tri thức dưới dạng đồ thị, biểu đồ, bảng
- 🤖 **Hỗ trợ AI agents** — Cung cấp context cho các AI agents trong quá trình phát triển
- 🔍 **Phân tích code** — Index và tìm kiếm symbols trong codebase

### Có gì mới ở v2.0?

| Trước (v1.x) | Sau (v2.0) |
|---------------|------------|
| Phải cài MCP server riêng (npx/uvx/java) | ✅ **Tự động** — không cần cài gì thêm |
| Phải config mcp.json thủ công | ✅ **Tự động** — extension tự tạo config |
| Xem KB qua trình duyệt web (port 3201) | ✅ **Ngay trong VS Code** — 5 panels native |
| Không có sidebar | ✅ **Sidebar** — truy cập nhanh mọi tính năng |

### Ai nên đọc hướng dẫn này?

- **Developer** mới bắt đầu dùng extension
- **Tech Lead** muốn theo dõi sức khỏe KB của team
- **Bất kỳ ai** muốn tận dụng Knowledge Base trong dự án

### Điều kiện tiên quyết

| Yêu cầu | Chi tiết |
|----------|----------|
| VS Code hoặc Kiro IDE | Phiên bản 1.85 trở lên |
| Hệ điều hành | Windows 10+ (x64), macOS 12+ (Apple Silicon), Linux (x64) |

> 💡 **Không cần cài thêm gì khác.** Extension đã bao gồm mọi thứ cần thiết.

---

## 2. Cài đặt & Bắt đầu

### 2.1 Cài đặt (1 bước duy nhất)

1. Mở VS Code / Kiro IDE
2. Vào **Extensions** (Ctrl+Shift+X)
3. Tìm **"Kiro SDLC Agents"**
4. Nhấn **Install**

**Xong.** Không có bước 5.

### 2.2 Điều gì xảy ra sau khi cài?

Extension tự động thực hiện mọi thứ cho bạn:

```
✅ Cài extension
    ↓ (tự động)
✅ MCP Server khởi động
    ↓ (tự động)
✅ Config mcp.json được tạo
    ↓ (tự động)
✅ Sidebar icon xuất hiện
    ↓
🎉 Sẵn sàng sử dụng!
```

### 2.3 Xác nhận hoạt động

Sau khi cài, bạn sẽ thấy:

| Dấu hiệu | Vị trí | Ý nghĩa |
|-----------|--------|----------|
| Icon Kiro SDLC (mới) | Thanh Activity Bar (bên trái) | Extension đã active |
| ✅ "Running (port XXXX)" | Status bar (dưới cùng) | MCP Server đang chạy trên port 9180 (mặc định) |
| Thông báo | Góc phải dưới | "MCP Server started successfully" |

> ⚠️ **Nếu không thấy icon Kiro SDLC?** Thử đóng và mở lại VS Code. Extension cần workspace folder mở để activate.

### 2.4 Lần đầu mở workspace mới

Khi bạn mở một workspace (thư mục dự án) lần đầu:

1. Extension tự tạo thư mục `.code-intel/` (chứa database)
2. Extension tự tạo file `.kiro/settings/mcp.json` (config cho AI agents)
3. MCP Server tự khởi động

**Bạn không cần làm gì cả.** Mọi thứ diễn ra trong vòng 5 giây.

---

## 3. Sidebar — Thanh điều hướng bên trái

![Sidebar](screenshots/sidebar.png)

### 3.1 Mở Sidebar

Nhấn vào icon **Kiro SDLC** ở thanh Activity Bar (cột icon bên trái VS Code).

### 3.2 Cấu trúc Sidebar

```
Kiro SDLC
├── ✅ Running (Port 9180)     ← Trạng thái + port hiện tại
├── Knowledge Base
│   ├── 📊 Dashboard      ← Tổng quan sức khỏe KB
│   ├── 🕸️ Graph          ← Đồ thị tri thức 3D
│   ├── 🏷️ Tags           ← Khám phá theo chủ đề
│   ├── ⭐ Quality         ← Giám sát chất lượng
│   └── 📈 Analytics      ← Phân tích sử dụng
├── MCP Server
│   ├── Status: Running ✅  ← Trạng thái server
│   ├── 🔄 Restart Server  ← Khởi động lại nếu cần
│   ├── ⏹️ Stop Server     ← Dừng server
│   ├── ▶️ Start Server    ← Khởi động (khi đã dừng)
│   └── ⚙️ Change Port... ← Đổi port (mở input box)
└── Quick Actions
    ├── 💉 Inject All Agents
    ├── 📋 Show Status
    └── 🔍 Index Workspace
```

### 3.3 Cách sử dụng

- **Click** vào bất kỳ mục nào → mở panel hoặc thực hiện lệnh tương ứng
- **Status** tự động cập nhật khi server thay đổi trạng thái
- Sidebar luôn hiển thị — không cần nhớ tên lệnh

---

## 4. KB Dashboard — Bảng điều khiển

### Mở Dashboard

- **Cách 1:** Click **📊 Dashboard** trong Sidebar
- **Cách 2:** Ctrl+Shift+P → gõ "Kiro SDLC: Open KB Dashboard"

### Dashboard hiển thị gì?

Dashboard là "bảng đồng hồ" cho Knowledge Base — một cái nhìn cho biết mọi thứ có ổn không.

![Dashboard Panel](screenshots/dashboard.png)


#### 4.1 Health Score (Điểm sức khỏe)

Vòng tròn lớn ở góc trên — hiển thị điểm từ 0 đến 100:

| Màu | Điểm | Ý nghĩa |
|-----|-------|----------|
| 🟢 Xanh | 70-100 | KB đang khỏe mạnh |
| 🟡 Vàng | 40-69 | Cần chú ý — một số entries cần cải thiện |
| 🔴 Đỏ | 0-39 | Cần hành động ngay |

#### 4.2 Biểu đồ phân bố

- **Pie chart (hình tròn)** — Phân bố entries theo loại (Decision, Architecture, Procedure...)
- **Bar chart (cột ngang)** — Phân bố theo tier (Working, Episodic, Semantic, Procedural)
- **Trend chart (đường)** — Số entries mới trong 30 ngày qua

#### 4.3 Hoạt động gần đây

Danh sách 10 entries mới nhất được thêm vào KB. Click vào entry để xem chi tiết.

#### 4.4 Entries cần review

Hiển thị entries đã lâu chưa được kiểm tra lại. Tri thức cũ có thể đã lỗi thời.

### Tự động làm mới

Dashboard tự động cập nhật mỗi **60 giây**. Bạn cũng có thể nhấn nút **🔄 Refresh** để cập nhật ngay.

### Khi nào nên xem Dashboard?

| Tình huống | Hành động |
|-----------|-----------|
| Bắt đầu ngày làm việc | Glance 30 giây — KB có ổn không? |
| Sau khi thêm nhiều entries | Kiểm tra Health Score có tăng không |
| Cuối tuần | Review entries overdue |

---

## 5. KB Graph — Đồ thị tri thức 3D

### Mở Graph

- **Cách 1:** Click **🕸️ Graph** trong Sidebar
- **Cách 2:** Ctrl+Shift+P → gõ "Kiro SDLC: Open KB Graph"

![Graph Panel](screenshots/graph.png)

### Graph là gì?

Đồ thị 3D hiển thị **mối quan hệ** giữa các entries trong KB:
- Mỗi **chấm tròn (node)** = một entry
- Mỗi **đường nối (edge)** = một mối quan hệ (liên quan, phụ thuộc, trích dẫn...)
- **Màu sắc** = loại entry (xanh = Decision, đỏ = Error Pattern, tím = Architecture...)
- **Kích thước** = mức độ quan trọng (được trích dẫn nhiều = to hơn)

### Cách tương tác

| Thao tác | Cách làm | Kết quả |
|----------|----------|---------|
| Xoay | Kéo chuột trái | Xoay góc nhìn 3D |
| Phóng to/thu nhỏ | Scroll wheel | Zoom in/out |
| Di chuyển | Kéo chuột phải | Pan camera |
| Xem chi tiết | Click vào node | Panel chi tiết hiện ra bên phải |
| Tìm kiếm | Gõ vào ô Search | Highlight nodes matching |
| Lọc theo loại | Dropdown "Type Filter" | Chỉ hiển thị loại đã chọn |
| Lọc theo tier | Dropdown "Tier Filter" | Chỉ hiển thị tier đã chọn |

### Đọc Graph — Bạn cần biết gì?

| Nhìn thấy | Ý nghĩa |
|-----------|----------|
| Cụm nodes dày đặc | Nhóm tri thức liên quan chặt chẽ |
| Node cô lập (không có edge) | Entry chưa được liên kết — có thể thiếu context |
| Node rất to | Entry quan trọng — được nhiều entries khác trích dẫn |
| Vùng trống | Domain chưa có tri thức — cần bổ sung |

### Chuyển đổi 2D/3D

Nếu máy bạn chạy chậm với 3D, nhấn nút **2D** để chuyển sang chế độ phẳng (nhẹ hơn).

### Thông tin hiển thị

Góc dưới trái hiển thị: **"N nodes, M edges"** — tổng số entries và mối quan hệ đang hiển thị.

> 💡 **Hiệu suất:** Graph hoạt động mượt mà nhất với ≤500 entries. Nếu KB lớn hơn, hãy dùng bộ lọc Type/Tier để thu hẹp hiển thị.

---

## 6. KB Tags — Khám phá theo chủ đề

### Mở Tags

- **Cách 1:** Click **🏷️ Tags** trong Sidebar
- **Cách 2:** Ctrl+Shift+P → gõ "Kiro SDLC: Open KB Tags"

![Tags Panel](screenshots/tags.png)

### Tags panel có gì?

Hai chế độ xem (chuyển đổi bằng tab):

#### 6.1 Tag Cloud (Đám mây từ khóa)

- Hiển thị tất cả tags đang được sử dụng
- **Chữ to** = tag được dùng nhiều (nhiều entries gắn tag này)
- **Chữ nhỏ** = tag ít dùng
- **Click** vào tag → hiển thị tất cả entries có tag đó

#### 6.2 Taxonomy Tree (Cây phân loại)

- Hiển thị tags theo cấu trúc phân cấp (cha-con)
- Ví dụ: `development` → `python`, `kotlin`, `typescript`
- Click vào nhánh để mở rộng/thu gọn

### Tìm kiếm theo tag

1. Gõ vào ô **Search** ở trên cùng
2. Hệ thống gợi ý tags matching
3. Click tag → xem danh sách entries

### Tạo tag mới

1. Nhấn nút **+ Create Tag**
2. Nhập tên tag (ví dụ: "docker")
3. Chọn category (tùy chọn, ví dụ: "infrastructure")
4. Nhấn **Create**

### Khi nào dùng Tags?

| Bạn muốn... | Hành động |
|-------------|-----------|
| Tìm mọi thứ về "docker" | Click tag "docker" |
| Xem KB có gì về security | Mở taxonomy → nhánh "security" |
| Biết topic nào phổ biến nhất | Nhìn tag cloud — chữ to nhất |

---

## 7. KB Quality — Giám sát chất lượng

### Mở Quality

- **Cách 1:** Click **⭐ Quality** trong Sidebar
- **Cách 2:** Ctrl+Shift+P → gõ "Kiro SDLC: Open KB Quality"

![Quality Panel](screenshots/quality.png)

### Quality panel hiển thị gì?

#### 7.1 Biểu đồ phân bố chất lượng (Histogram)

- Trục ngang: điểm quality (0-100)
- Trục dọc: số entries
- Màu: 🔴 (0-29) kém | 🟡 (30-59) trung bình | 🟢 (60-100) tốt

**Mục tiêu:** Biểu đồ nên lệch sang phải (nhiều xanh, ít đỏ).

#### 7.2 Bảng entries chất lượng thấp

Danh sách entries có điểm < 40, sắp xếp từ thấp nhất:

| Cột | Ý nghĩa |
|-----|---------|
| ID | Mã entry |
| Type | Loại (Decision, Procedure...) |
| Summary | Tóm tắt nội dung |
| Score | Điểm chất lượng |

**Click** vào entry → xem chi tiết và gợi ý cải thiện.

#### 7.3 Biểu đồ độ tin cậy (Confidence)

Hiển thị mức độ tin cậy của entries — entries có confidence thấp có thể chứa thông tin chưa được xác minh.

#### 7.4 Hành động hàng loạt

Chọn nhiều entries → thực hiện:
- **Archive** — Lưu trữ (ẩn khỏi kết quả tìm kiếm)
- **Delete** — Xóa vĩnh viễn
- **Mark for Review** — Đánh dấu cần kiểm tra lại

> ⚠️ Hệ thống sẽ hỏi xác nhận trước khi xóa.

### Điểm quality tính dựa trên gì?

- Độ dài nội dung (quá ngắn = điểm thấp)
- Có tags hay không
- Có được review gần đây không
- Format có rõ ràng không (headings, lists)

---

## 8. KB Analytics — Phân tích sử dụng

### Mở Analytics

- **Cách 1:** Click **📈 Analytics** trong Sidebar
- **Cách 2:** Ctrl+Shift+P → gõ "Kiro SDLC: Open KB Analytics"

![Analytics Panel](screenshots/analytics.png)

### Analytics hiển thị gì?

#### 8.1 Search Volume (Lượng tìm kiếm)

Biểu đồ đường hiển thị số lượt tìm kiếm mỗi ngày trong 30 ngày qua.

| Pattern | Ý nghĩa |
|---------|----------|
| Tăng đều | KB đang được sử dụng tốt |
| Giảm | Team có thể không biết KB tồn tại |
| Spike đột ngột | Có sự kiện/project mới — team đang cần knowledge |

#### 8.2 Popular Queries (Tìm kiếm phổ biến)

Top 20 từ khóa được tìm nhiều nhất. Giúp bạn biết team đang quan tâm gì.

#### 8.3 Zero-Result Queries (Lỗ hổng nội dung) ⚠️

**Đây là phần quan trọng nhất.**

Hiển thị những gì team tìm kiếm nhưng **KB không có kết quả** — tức là KB đang thiếu nội dung cho topic đó.

| Ví dụ | Ý nghĩa |
|-------|----------|
| "grpc config" (5 lần) | 5 người tìm "grpc config" mà không thấy gì → cần tạo entry |
| "oauth2 flow" (3 lần) | 3 người cần biết về oauth2 → KB thiếu |

**Hành động:** Click vào gap → tạo entry mới để lấp lỗ hổng.

#### 8.4 Most Cited (Được trích dẫn nhiều)

Entries quan trọng nhất — được nhiều entries khác reference đến.

#### 8.5 Recommendations (Đề xuất)

Hệ thống tự động đề xuất entries nên tạo dựa trên gaps và patterns. Click **"Create"** để tạo ngay.

### Chọn khoảng thời gian

Dropdown góc trên phải: **7 ngày / 30 ngày / 90 ngày / Tất cả**

---

## 9. Quản lý MCP Server

### MCP Server là gì?

MCP Server là "bộ não" chạy ngầm phía sau — nó quản lý database tri thức và cung cấp 32 công cụ cho AI agents. Server giao tiếp qua **HTTP** (localhost) với extension. Bạn **không cần quan tâm** đến nó trong hầu hết trường hợp.

### Port Server

- Mặc định: port **9180** (cố định, ổn định qua các lần restart)
- Tùy chỉnh: cấu hình trong file `.kiro/settings/mcp.json`
- Nếu port đã bị chiếm → hiển thị lỗi (KHÔNG tự chuyển sang port khác)
- Đổi port nhanh: Ctrl+Shift+P → "Kiro SDLC: Change MCP Port..."

### Dừng / Khởi động Server

- **Dừng server:** Ctrl+Shift+P → "Kiro SDLC: Stop MCP Server" hoặc click ⏹️ trong Sidebar
- **Khởi động lại:** Ctrl+Shift+P → "Kiro SDLC: Start MCP Server" hoặc click ▶️ trong Sidebar
- Khi server dừng, các panels sẽ hiển thị "Server disconnected"
- Server sẽ tự khởi động lại khi bạn mở panel hoặc AI agent cần dùng

### Theo dõi cấu hình (Auto-Monitor)

Extension **tự động theo dõi** file `.kiro/settings/mcp.json`:

| Tình huống | Extension làm gì |
|-----------|-------------------|
| Bạn thay đổi port hoặc config server | ✅ Tự động restart server theo config mới |
| Config bị sai (JSON lỗi, thiếu field) | ⚠️ Icon Kiro SDLC trên Activity Bar hiện **dấu cảnh báo** |
| Server `code-intelligence` bị xóa khỏi file | ⚠️ Icon Kiro SDLC hiện cảnh báo — KB không hoạt động |

**Khi thấy dấu cảnh báo ⚠️ trên icon:**
- Kiểm tra file `.kiro/settings/mcp.json` — có thể bạn vô tình xóa hoặc sửa sai
- Sửa lại config → extension tự động phát hiện và restart server
- Hoặc dùng lệnh "Kiro SDLC: Restart MCP Server" để extension tự tạo lại config mặc định

### Trạng thái Server

Xem trong Sidebar mục **MCP Server → Status**:

| Trạng thái | Icon | Ý nghĩa |
|-----------|------|----------|
| Running | ✅ | Bình thường — mọi thứ hoạt động |
| Starting | ⏳ | Đang khởi động (chờ 3-5 giây) |
| Crashed | ⚠️ | Gặp lỗi — đang tự khởi động lại |
| Stopped | ❌ | Đã dừng — cần khởi động lại thủ công |
| Config Error | ⚠️ (trên icon Kiro SDLC) | Config mcp.json sai hoặc bị xóa — KB không hoạt động |

### Khi nào cần khởi động lại?

Hầu hết thời gian, bạn **không cần làm gì**. Server tự khởi động lại nếu gặp lỗi (tối đa 3 lần).

Chỉ cần khởi động lại thủ công khi:
- Status hiển thị ❌ Stopped
- Panels hiển thị "Server unavailable"
- Bạn thấy dữ liệu không cập nhật

### Cách khởi động lại

- **Cách 1:** Click **🔄 Restart Server** trong Sidebar
- **Cách 2:** Ctrl+Shift+P → gõ "Kiro SDLC: Restart MCP Server"

Quá trình mất khoảng 5-10 giây. Sau khi xong, tất cả panels tự động kết nối lại.

### Server logs

Nếu cần xem chi tiết (cho developer/admin):
- Menu **View → Output** → chọn **"Kiro SDLC: MCP Server"** từ dropdown

---

## 10. Xử lý sự cố

### 10.1 Bảng xử lý nhanh

| Vấn đề | Nguyên nhân | Giải pháp |
|--------|-------------|-----------|
| Không thấy icon Kiro SDLC trong sidebar | Extension chưa activate | Mở một thư mục dự án (File → Open Folder) |
| Panel hiển thị "Server disconnected" | MCP Server bị crash | Chờ 5-10 giây (tự restart) hoặc click "Retry" |
| Panel hiển thị "Failed to load data" | Lỗi tạm thời | Nhấn nút Refresh trong panel |
| Graph trống (không có nodes) | KB chưa có entries | Sử dụng AI agents để tạo entries, hoặc dùng `mem_ingest` |
| Dashboard Health Score = 0 | KB mới, chưa có dữ liệu | Bình thường — score sẽ tăng khi thêm entries |
| Extension không hoạt động | VS Code quá cũ | Cập nhật VS Code lên phiên bản 1.85+ |
| "Node.js 20+ required" | VS Code quá cũ (Node.js đi kèm VS Code) | Cập nhật VS Code lên phiên bản mới nhất (Node.js 20+ đi kèm) |
| "MCP server bundle not found" | Extension bị hỏng | Gỡ và cài lại extension |
| Server crashed 3 lần liên tiếp | Lỗi nghiêm trọng | Xem Output panel → báo lỗi cho team |
| Port conflict (server không start) | Port 9180 đã bị chiếm | Đổi port: Ctrl+Shift+P → "Kiro SDLC: Change MCP Port..." hoặc sửa `.kiro/settings/mcp.json` |
| Icon Kiro SDLC có dấu ⚠️ cảnh báo | Config mcp.json sai hoặc thiếu server | Kiểm tra `.kiro/settings/mcp.json` — sửa lại hoặc restart để tạo config mới |

### 10.2 Server tự khởi động lại

Khi server gặp lỗi, extension tự động xử lý:

```
Lần 1: Chờ 5 giây → khởi động lại
Lần 2: Chờ 15 giây → khởi động lại
Lần 3: Chờ 30 giây → khởi động lại
Sau 3 lần: Dừng → hiển thị thông báo lỗi
```

Nếu sau 3 lần vẫn lỗi → bạn cần khởi động lại thủ công (xem mục 9).

### 10.3 Panels mất kết nối

Khi server crash trong lúc panel đang mở:

1. Panel hiển thị overlay: **"Server disconnected. Reconnecting..."**
2. Chờ server tự restart (5-30 giây)
3. Panel tự động kết nối lại và refresh dữ liệu
4. Nếu không tự kết nối → nhấn nút **"Retry"** trong panel

### 10.4 Reset hoàn toàn

Nếu mọi thứ đều không hoạt động:

1. Ctrl+Shift+P → "Kiro SDLC: Stop MCP Server"
2. Xóa thư mục `.code-intel/` trong workspace (sẽ mất dữ liệu KB)
3. Ctrl+Shift+P → "Kiro SDLC: Restart MCP Server"
4. Extension sẽ tạo lại database mới

> ⚠️ **Cảnh báo:** Xóa `.code-intel/` sẽ xóa toàn bộ Knowledge Base. Chỉ làm khi thật sự cần thiết.

---

## 11. Câu hỏi thường gặp (FAQ)

### Q: Tôi có cần cài đặt gì thêm không?

**Không.** Extension v2.0 đã bao gồm mọi thứ. Chỉ cần Install từ Marketplace là xong.

### Q: Extension có ảnh hưởng đến hiệu suất VS Code không?

**Rất ít.** MCP Server chạy trong process riêng biệt — nếu nó gặp vấn đề, VS Code vẫn hoạt động bình thường. Panels chỉ tốn tài nguyên khi đang mở.

### Q: Dữ liệu KB lưu ở đâu?

Trong thư mục `{workspace}/.code-intel/index.db`. Dữ liệu hoàn toàn **local** — không gửi đi đâu cả.

### Q: Tôi đang dùng MCP server Python/Kotlin, có bị ảnh hưởng không?

**Không.** Extension sẽ hỏi bạn trước khi thay đổi config. Nếu bạn chọn "No", extension giữ nguyên config hiện tại của bạn.

### Q: Có thể dùng nhiều panels cùng lúc không?

**Có.** Mỗi panel là một tab riêng trong VS Code. Bạn có thể mở Dashboard, Graph, Tags... cùng lúc và sắp xếp theo ý muốn. Lưu ý: mỗi loại panel chỉ có 1 instance — nếu bạn mở lại panel đã mở, nó sẽ hiện panel cũ (không tạo mới).

### Q: Tôi đang dùng v1.x, upgrade lên v2.0 có mất gì không?

**Không.** Tất cả tính năng cũ (inject agents, steering, hooks, templates, update, status) giữ nguyên 100%. v2.0 chỉ thêm mới — không thay đổi hay xóa gì cũ.

### Q: KB trống, bắt đầu từ đâu?

1. Sử dụng AI agents (BA, SA, DEV...) — chúng tự động lưu tri thức vào KB
2. Hoặc dùng lệnh `Kiro SDLC: Index Workspace` để index code hiện có
3. Hoặc dùng tool `mem_ingest` trong chat để thêm entries thủ công

### Q: Extension có hoạt động offline không?

**Có.** Mọi thứ chạy local. Không cần internet sau khi cài đặt.

### Q: Làm sao để cập nhật extension?

VS Code tự động cập nhật extensions. Hoặc vào Extensions → tìm "Kiro SDLC Agents" → nhấn Update nếu có.

### Q: Tôi muốn dừng MCP Server để tiết kiệm tài nguyên?

Ctrl+Shift+P → "Kiro SDLC: Stop MCP Server" hoặc click ⏹️ Stop Server trong Sidebar. Để khởi động lại: "Kiro SDLC: Start MCP Server" hoặc click ▶️ Start Server.

### Q: File `.kiro/settings/mcp.json` là gì?

Đó là file config cho AI agents biết cách kết nối với MCP Server (qua HTTP). Extension tự tạo và quản lý — bạn **không cần chỉnh sửa** trừ khi muốn đổi port server.

Ví dụ cấu hình port:
```json
{
  "mcpServers": {
    "code-intelligence": {
      "port": 9180
    }
  }
}
```
Mặc định port là **9180**. Nếu muốn đổi, sửa giá trị `port` hoặc dùng lệnh "Kiro SDLC: Change MCP Port...".

---

## Phụ lục

### A. Danh sách lệnh (Commands)

| Lệnh | Phím tắt | Mô tả |
|------|----------|--------|
| Kiro SDLC: Open KB Dashboard | — | Mở bảng điều khiển |
| Kiro SDLC: Open KB Graph | — | Mở đồ thị tri thức 3D |
| Kiro SDLC: Open KB Tags | — | Mở panel tags |
| Kiro SDLC: Open KB Quality | — | Mở panel chất lượng |
| Kiro SDLC: Open KB Analytics | — | Mở panel phân tích |
| Kiro SDLC: Restart MCP Server | — | Khởi động lại server |
| Kiro SDLC: Stop MCP Server | — | Dừng server |
| Kiro SDLC: Start MCP Server | — | Khởi động server (khi đã dừng) |
| Kiro SDLC: Change MCP Port... | — | Đổi port server (mở input box) |
| Kiro SDLC: Inject All Agents | — | Inject tất cả agents vào workspace |
| Kiro SDLC: Inject (Select Components) | — | Chọn components để inject |
| Kiro SDLC: Update Agents (Keep Customizations) | — | Cập nhật giữ customizations |
| Kiro SDLC: Show Status | — | Hiển thị trạng thái components |
| Kiro SDLC: Index Workspace | — | Index code + documents |
| Kiro SDLC: Download Embedding Model | — | Tải model embedding |

### B. Cấu trúc thư mục tự động tạo

```
{workspace}/
├── .code-intel/              ← Database và models (tự động tạo)
│   ├── index.db              ← Knowledge Base database
│   ├── models/               ← Embedding models
│   └── orchestration.json    ← Server config
├── .kiro/
│   └── settings/
│       └── mcp.json          ← MCP config (tự động tạo)
└── ... (code của bạn)
```

### C. Glossary (Thuật ngữ)

| Thuật ngữ | Giải thích đơn giản |
|-----------|---------------------|
| MCP Server | Chương trình chạy ngầm quản lý tri thức, giao tiếp qua HTTP |
| KB (Knowledge Base) | Kho tri thức — nơi lưu decisions, patterns, procedures |
| Entry | Một mục tri thức trong KB |
| Node | Một chấm tròn trên đồ thị (= 1 entry) |
| Edge | Đường nối giữa 2 nodes (= mối quan hệ) |
| Tag | Nhãn gắn cho entry để phân loại |
| Tier | Mức độ trưởng thành của entry (Working → Semantic → Procedural) |
| Webview Panel | Cửa sổ hiển thị nội dung trong VS Code |
| Sidebar | Thanh bên trái VS Code với các icon |
| Activity Bar | Cột icon dọc bên trái cùng của VS Code |

### D. Tài liệu liên quan

| Tài liệu | Vị trí |
|-----------|--------|
| BRD | documents/KSA-120/BRD.md |
| FSD | documents/KSA-120/FSD.md |
| TDD | documents/KSA-120/TDD.md |
| STP (Test Plan) | documents/KSA-120/STP.md |
| STC (Test Cases) | documents/KSA-120/STC.md |
