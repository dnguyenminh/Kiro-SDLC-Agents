Thảo luận về app https://github.com/rohitg00/agentmemory
-------------------------------------------

**`rohitg00/agentmemory`** là một công cụ (dưới dạng một MCP Server hoặc standalone server) giải quyết một trong những nỗi đau lớn nhất khi lập trình với AI: **Mất ngữ cảnh (Context Loss) giữa các phiên làm việc (sessions).**

Khi bạn dùng các AI Coding Agent như Claude Code, Cursor, Gemini CLI hay các client hỗ trợ MCP (Model Context Protocol), mỗi khi bạn tắt terminal hoặc mở một session mới, AI sẽ quên sạch những gì đã thảo luận trước đó. `agentmemory` sinh ra để làm một **"trí nhớ dài hạn"** đồng nhất cho tất cả các AI này.

Dưới đây là chi tiết kiến trúc và cách hoạt động của công cụ này:

---

## 1. Bài toán thực tế mà nó giải quyết

Thông thường, để AI nhớ cấu trúc dự án, bạn phải dùng các file như `CLAUDE.md` hoặc `.cursorrules`. Tuy nhiên, cách này có 2 nhược điểm:

* Giới hạn dung lượng (thường bị quá tải nếu vượt quá 200 dòng).
* Bạn phải tự cập nhật thủ công khi dự án thay đổi.

**Kịch bản với `agentmemory`:**

* **Session 1:** Bạn yêu cầu AI cài đặt cấu hình JWT Auth bằng thư viện `jose` trong file `src/middleware/auth.ts`.
* **Session 2 (Ngày hôm sau):** Bạn mở một session mới và bảo AI: *"Viết thêm logic Rate Limiting cho API"*.
* **Kết quả:** AI tự động biết hệ thống đang dùng `jose` chứ không phải `jsonwebtoken`, biết file auth nằm ở đâu và cấu trúc test case của bạn ra sao để viết code đồng bộ. **Bạn hoàn toàn không cần giải thích lại.**

---

## 2. Các tính năng cốt lõi ấn tượng

* **Hệ thống lưu trữ 4 tầng (4-tier consolidation):** Trí nhớ của AI được quản lý khoa học theo cơ chế: `Working (Trí nhớ làm việc)` $\rightarrow$ `Episodic (Theo trải nghiệm/sự kiện)` $\rightarrow$ `Semantic (Khái niệm/ngữ nghĩa)` $\rightarrow$ `Procedural (Quy trình/thói quen)`. Nó tự biết cô đọng thông tin quan trọng và tự xóa (auto-forget) những thứ rác.
* **Tìm kiếm lai kết hợp (Hybrid Search):** Sử dụng thuật toán Fusion (RRF) kết hợp giữa **BM25** (tìm kiếm từ khóa chính xác), **Vector Search** (tìm kiếm theo ý nghĩa ngữ nghĩa) và **Knowledge Graph** (đồ thị tri thức để kết nối các thực thể liên quan).
* **Siêu tiết kiệm Token (Token Efficiency):** Thay vì nhét toàn bộ lịch sử chat vào context window (gây tốn tiền và làm AI bị loãng thông tin), `agentmemory` chỉ tìm và "bơm" đúng những đoạn bộ nhớ thực sự liên quan vào session hiện tại. Giúp tiết kiệm tới **92% lượng token** (trung bình chỉ tốn ~1,900 tokens/session).
* **Session Replay (Xem lại phiên làm việc):** Tích hợp sẵn một UI Viewer trực quan (mặc định ở port `3113`). Bạn có thể tua đi, tua lại, xem chính xác từng câu lệnh, công cụ (tool calls), và kết quả trả về của AI giống như một cuốn băng video.
* **Không phụ thuộc DB ngoài:** Chạy trực tiếp qua một file binary tĩnh duy nhất (được build dựa trên `iii-engine`), sử dụng SQLite nội bộ cực kỳ gọn nhẹ và bảo mật (Local-first).

---

## 3. Kiến trúc hoạt động

1. **Auto-capture (Tự động ghi lại):** Nó chạy ngầm và sử dụng các hook để bắt trọn mọi hành động của AI (sửa file, chạy test, log lỗi, câu lệnh gọi tool).
2. **Knowledge Graph & Vector Sync:** Dữ liệu được phân tích, tạo vector embedding và đưa vào đồ thị quan hệ cá nhân hóa cho dự án của bạn.
3. **Context Injection:** Khi bạn mở một Session mới ở bất kỳ công cụ nào (Cursor hay Claude Code...), thông qua giao thức MCP, `agentmemory` sẽ kiểm tra câu hỏi của bạn và tự động cung cấp phần bộ nhớ tương thích nhất vào prompt ngầm của AI.

---

## 4. Cách tích hợp tổng quan

Vì project này hoạt động như một **MCP Server**, bạn chỉ cần cấu hình nó một lần duy nhất trong file config của các IDE/Client (ví dụ file `claude_desktop_config.json` hoặc config của Cursor) tại mục `mcpServers`:

```json
{
  "mcpServers": {
    "agentmemory": {
      "command": "agentmemory",
      "args": ["start"]
    }
  }
}

```

Sau khi thêm cấu hình này, tất cả các Agent có chung cấu hình sẽ dùng chung một "bộ não" (Shared memory). Kiến thức mà một con Bot học được từ session trước sẽ ngay lập tức khả dụng cho các con Bot khác ở session sau.

Tóm lại, đây là một thư viện hardcore, tối ưu rất sâu về mặt kỹ thuật lưu trữ và truy vấn dành riêng cho các lập trình viên đang muốn xây dựng hoặc tối ưu quy trình làm việc tự động hóa với AI Agent một cách nghiêm túc.

-----------------------------


Để xây dựng được một hệ thống "trí nhớ dài hạn" thông minh và không bị rác dữ liệu, `agentmemory` không đơn thuần là ghi lại toàn bộ nhật ký trò chuyện (chat log) thô. Thay vào đó, thông qua giao thức MCP, nó chủ động **lắng nghe, phân tích cấu trúc và phân loại 4 nhóm hành vi core** của AI Agent để đưa vào Vector DB và Đồ thị tri thức (Knowledge Graph):

---

## 1. Hành vi Tương tác và Ý định (Intent & Interaction)

Đây là tầng bắt nguồn từ cuộc hội thoại giữa bạn và AI, giúp xác định *lý do* tại sao một đoạn code được viết.

* **Yêu cầu của người dùng (User Prompts):** Mục tiêu cốt lõi của bạn (ví dụ: *"Hãy tối ưu hóa câu lệnh SQL này"*, *"Viết unit test cho hàm auth"*). Nó lưu lại ý định này để làm anchor (neo) cho các đoạn code sinh ra sau đó.
* **Suy nghĩ nội bộ của Agent (Agent Reasoning/Chain-of-Thought):** Các bước lập luận ngầm của AI trước khi đưa ra quyết định (ví dụ: *"Để giải quyết lỗi NullPointer này, mình cần kiểm tra xem config đã được load chưa..."*). Ghi lại phần này giúp AI khóa được luồng tư duy cũ khi bạn quay lại hỏi tiếp.

---

## 2. Hành vi Thao tác Hệ thống Tệp (File System Operations)

Mỗi khi Agent dùng các tool MCP để can thiệp vào mã nguồn của bạn, `agentmemory` sẽ snapshot lại sự thay đổi:

* **Đọc tệp (File Reading):** Agent đã xem những file nào để lấy ngữ cảnh? Hệ thống sẽ lưu liên kết giữa các file đó (ví dụ: file `UserRoute` phụ thuộc vào file `UserService`).
* **Sửa đổi/Tạo mới tệp (File Mutations):** Chi tiết các đoạn code được thêm, sửa, hoặc xóa (Diffs).
* **Tầm ảnh hưởng của code (Impact Analysis):** Thay vì lưu cả file 2000 dòng, nó bóc tách các **khái niệm mã nguồn** (như tên Hàm, Tên Class, Tên Component mới được định nghĩa) để đưa vào Vector DB dưới dạng ngữ nghĩa (Semantic Memory).

---

## 3. Hành vi Thực thi Lệnh và Môi trường (Runtime Execution)

AI Agent thường sẽ chạy các lệnh terminal để kiểm tra code của chính nó. Các hành vi này cung cấp phản hồi thực tế (Feedback Loop) cực kỳ quan trọng:

* **Lệnh thực thi (Execution Commands):** Các lệnh Agent tự gọi như `npm run test`, `gradle w bootRun`, `docker-compose up`.
* **Kết quả Runtime (Stdout & Stderr):**
* Nếu **Test Pass/Success:** Nó lưu lại trạng thái này như một "quy trình đúng" (Procedural Memory).
* Nếu **Gặp Lỗi (Stack traces, Compiler Errors):** Đây là dữ liệu vàng. Nó lưu lại vết lỗi để Agent nhớ rằng *"Giải pháp A đã từng bị lỗi B ở file X"*, từ đó không lặp lại sai lầm cũ trong tương lai.



---

## 4. Hành vi Sử dụng Công cụ (Tool Call Lifecycle)

Bản thân các AI Agent hoạt động bằng cách gọi liên tục các Tool (gọi là Tool Chaining). `agentmemory` ghi nhận:

* **Danh sách Tool được gọi:** Định danh chính xác Tool nào vừa chạy (`fetch_webpage`, `execute_command`, `search_grep`).
* **Tham số đầu vào (Arguments) & Kết quả trả về (Outputs):** Giúp tạo ra một chuỗi mắt xích (Episodic Memory) theo thời gian, cho phép hệ thống dựng lại toàn bộ kịch bản (Session Replay) trên giao diện UI Viewer.

---

## Cơ chế "Lọc Cát Tìm Vàng" trước khi đưa vào Vector DB

Để tránh việc Vector DB bị phình to bởi mã nguồn thô hoặc log terminal dài hàng vạn dòng (gây nhiễu khi tìm kiếm), `agentmemory` sử dụng một bộ lọc thông minh (Consolidation Pipeline):

1. **Chunking & Định dạng lại:** Toàn bộ 4 nhóm hành vi trên được gom lại thành các "Sự kiện" (Events).
2. **Trích xuất thực thể (Entity Extraction):** Nó dùng một mô hình nhỏ chạy ngầm (hoặc heuristic quy tắc) để bóc tách: *Ai làm? Làm trên file nào? Công nghệ gì? Kết quả ra sao?*
3. **Đưa vào Vector DB:** Chỉ những thông tin đã được cô đọng, giàu tính ngữ nghĩa mới được biến đổi thành Vector Embedding để lưu trữ.
4. **Tạo quan hệ trên Graph:** Ví dụ, thực thể `Hàm loginJWT` (lưu ở Vector DB) sẽ được nối một đường link tới thực thể `File auth.ts` trên Đồ thị tri thức, giúp AI khi tìm kiếm về JWT sẽ tự động "dắt dây" ra được file liên quan.