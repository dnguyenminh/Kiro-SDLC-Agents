1. Mặt TỐT: Tại sao KB giúp bạn tiết kiệm và tối ưu hơn?
Bản chất của KB là thay thế cơ chế "nhồi nhét mọi thứ vào context" bằng cơ chế "chỉ lấy đúng thứ cần thiết khi được hỏi".

Cắt nhỏ lịch sử dự án: Thay vì bắt Agent đọc lại toàn bộ 50 câu hội thoại hoặc 20 file code cũ ở turn trước, hệ thống sẽ lưu các thông tin đó vào một Vector Database dưới dạng các đoạn ngắn (chunks). Khi Agent cần thông tin gì, nó chỉ truy vấn và bốc ra đúng 1-2 đoạn liên quan nhất (ví dụ mất tầm 1,000 tokens thay vì nuốt cả cụm 50,000 tokens).

Giải quyết vấn đề đã làm xong: Khi Agent A hoàn thành việc thiết kế một Module Database, nó viết một bản tóm tắt ngắn gọn và đẩy vào KB. Agent B khi cần viết code logic chỉ cần gọi KB để lấy schema đó, hoàn toàn ngắt kết nối với đống lịch sử thảo luận dài ngoằng dính liền với quá trình tạo ra Database của Agent A.

2. Mặt XẤU: "Hố đen" đốt token xuất hiện khi nào?
Nếu bạn cấu hình hệ thống theo kiểu "mì ăn liền" (Naive RAG), chi phí token sẽ bùng nổ vì các lý do sau:

Lỗi "RAG mù quáng" (Blind Retrieval Inflation)
Mỗi khi một Agent trong hệ thống ACP/MCP suy nghĩ (bước Thought), nếu hệ thống tự động kích hoạt tìm kiếm KB và nhồi kết quả vào prompt một cách vô điều kiện, bạn sẽ gặp tình trạng:

Mỗi turn chat, KB trả về Top 5 kết quả tương đồng nhất (khoảng 3,000 - 5,000 tokens).

Nếu hệ thống có 4 Agent thảo luận qua lại 5 vòng, lượng token phát sinh từ việc "lặp đi lặp lại đống kết quả tìm kiếm" này sẽ nhân lên theo cấp số nhân.

Vòng lặp phản hồi vô tận (Retrieval Feedback Loop)
Agent A tìm kiếm thông tin từ KB ➔ Viết ra kết quả sai hoặc thiếu ➔ Lưu ngược lại vào KB ➔ Agent B lại tìm kiếm trúng đoạn thông tin lỗi đó và tiếp tục xử lý. Điều này làm kéo dài số lượt gọi (turns) của Agent lên gấp đôi, gấp ba để sửa sai, gián tiếp làm hóa đơn token tăng vọt.

3. Chiến lược cấu trúc KB chuẩn để tối ưu hóa chi phí
Để KB thực sự phát huy hiệu quả hỗ trợ bộ nhớ mà vẫn tiết kiệm tiền, bạn nên triển khai theo mô hình phân cấp cụ thể:

[Hệ thống Multi-Agent]
       │
       ├──► Bộ nhớ ngắn hạn (Mem0 / Episodic Memory) ──► Lưu ngữ cảnh 3-5 turn gần nhất
       │
       └──► Bộ nhớ dài hạn (Semantic KB / Vector DB) ──► Chỉ truy vấn khi có lệnh tường minh
Giải pháp cụ thể:
Chỉ truy vấn khi có yêu cầu tường minh (Explicit Tool Call): Không cho phép Agent tự động nhận dữ liệu từ KB ở mọi turn. KB phải được đóng gói thành một ACP/MCP Tool (ví dụ: search_project_knowledge(query)). Agent chỉ gọi tool này khi bản thân nó nhận ra mình đang thiếu thông tin để làm việc.

Sử dụng giải pháp Memory chuyên dụng cho Agent: Thay vì dùng RAG truyền thống dựa trên độ tương đồng văn bản thuần túy (Vector Search), hãy dùng các thư viện quản lý bộ nhớ thông minh cho Agent như Mem0 hoặc Letta. Các công cụ này tự động chắt lọc hội thoại, chỉ lưu lại các sự kiện cốt lõi (ví dụ: "User muốn đổi DB sang PostgreSQL") và tự động cập nhật hoặc ghi đè khi thông tin thay đổi, giúp dung lượng KB luôn tinh gọn.

Tách biệt KB theo Domain của từng Agent: Đừng bắt tất cả Agent dùng chung một bể kiến thức khổng lồ.

Agent chuyên viết Test chỉ cần kết nối với KB chứa tài liệu cấu hình Testing framework.

Agent chuyên Dev chỉ cần kết nối với KB chứa API Specs và quy chuẩn viết code của dự án.

Tóm lại: Dùng KB làm bộ nhớ là giải pháp RẤT TỐT và là bắt buộc nếu dự án lớn, nhưng với điều kiện bạn phải quản lý chặt chẽ khi nào Agent được phép đọc KB và dữ liệu đưa vào KB phải được cô đọng (Summarized), chứ không được ném toàn bộ log hay source code thô vào đó.