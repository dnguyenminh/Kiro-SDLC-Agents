Để trả lời ngắn gọn: **Không thể nhúng trực tiếp `iii-engine` (chạy native trong JVM) vào ứng dụng Java bằng cách import thư viện (như một file `.jar`), nhưng bạn HOÀN TOÀN có thể tích hợp và điều khiển nó từ một ứng dụng Java rất dễ dàng.**

Bản chất `iii-engine` được viết bằng **Rust / TypeScript** (được đóng gói thành một ứng dụng thực thi native hoặc chạy qua Node.js để tối ưu hóa hiệu năng tính toán Vector và tương tác với các extension C của SQLite). Do đó, nó không có phiên bản thuần Java (Pure Java package).

Tuy nhiên, với vai trò là một kỹ sư phần mềm, bạn có 3 giải pháp cực kỳ sạch sẽ và chuẩn kiến trúc để "nhúng" hoặc giao tiếp với `iii-engine` từ ứng dụng Java (ví dụ như một ứng dụng Spring Boot):

---

## 1. Giải pháp 1: Giao tiếp qua giao thức MCP (Khuyến khích)

Vì `iii-engine` và `agentmemory` tuân thủ nghiêm ngặt giao thức **Model Context Protocol (MCP)** do Anthropic khởi xướng, cách chuẩn nhất là biến ứng dụng Java của bạn thành một **MCP Client**.

Hiện tại đã có thư viện **MCP Java SDK** chính thức (hoặc các dự án như LangChain4j, Spring AI đã hỗ trợ MCP).

* Ứng dụng Java của bạn sẽ khởi chạy `iii-engine` như một sub-process.
* Giao tiếp với nó qua luồng Stdin/Stdout hoặc thông qua SSE (Server-Sent Events) bằng các lệnh JSON-RPC tiêu chuẩn của MCP.

---

## 2. Giải pháp 2: Gọi trực tiếp qua CLI (ProcessBuilder)

Nếu bạn chỉ muốn dùng `iii-engine` để index dữ liệu hoặc truy vấn nhanh từ Java app mà không muốn triển khai toàn bộ giao thức MCP phức tạp, bạn có thể tương tác với file Binary của engine thông qua `java.lang.ProcessBuilder`.

```java
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;

public class IiiEngineClient {
    public String queryMemory(String prompt) {
        try {
            List<String> command = new ArrayList<>();
            command.add("agentmemory"); // Hoặc đường dẫn tới iii-engine binary
            command.add("query");
            command.add("--text");
            command.add(prompt);

            ProcessBuilder processBuilder = new ProcessBuilder(command);
            Process process = processBuilder.start();

            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            StringBuilder output = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }

            int exitCode = process.waitFor();
            if (exitCode == 0) {
                return output.toString(); // Trả về JSON kết quả tìm kiếm từ Vector/Graph
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }
}

```

---

## 3. Giải pháp 3: Tự xây dựng một "iii-engine" bằng Java thuần (Pure Java)

Nếu kiến trúc dự án bắt buộc **100% phải chạy trong JVM** (nhúng hoàn toàn, không gọi process ngoài, không cài Node.js/Rust binary), bạn hoàn toàn có thể tự clone lại tư tưởng của `iii-engine` bằng hệ sinh thái Java hiện đại, vì các mảnh ghép của nó đều đã có giải pháp thay thế rất mạnh mẽ trong Java:

* **Tầng Vector DB nhúng:** Sử dụng **SQLite** thông qua JDBC kết hợp extension `sqlite-vec` (nạp qua thư viện JNI), hoặc sử dụng thư viện Vector thuần Java cực mạnh là **Lucene 9+** (đã hỗ trợ Hierarchical Navigable Small World - HNSW vector search rất nhanh).
* **Tầng Embedding Local:** Sử dụng thư viện **DJL (Deep Java Library)** của Amazon hoặc **LangChain4j**. Cả hai đều hỗ trợ nạp trực tiếp file ONNX của mô hình `all-MiniLM-L6-v2` và chạy trực tiếp trên RAM của Java App thông qua ONNX Runtime (chạy hoàn toàn offline).
* **Tầng Đồ thị (Graph):** Tận dụng các thư viện đồ thị nhúng bộ nhớ trong Java như **JGrapht** để liên kết các thực thể.

**Tóm lại:** Nếu bạn đang làm một project Java và muốn tận dụng trí nhớ của `iii-engine`, giải pháp tối ưu nhất là dùng **Spring AI / LangChain4j kết hợp với MCP** để điều khiển nó như một service chạy song song, thay vì cố gắng build lại nó bằng Java.