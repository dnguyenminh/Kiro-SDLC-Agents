Nếu bạn quyết định dùng trực tiếp với **Node.js**, bạn đang đi **đúng trục công nghệ gốc (Native Stack)** của dự án này. Bản chất `agentmemory` và lớp lõi `iii-engine` được phân phối qua npm và xây dựng bằng TypeScript/Node.js để tối ưu hóa việc tích hợp với các AI Agent SDK hiện đại.

Khi chạy trực tiếp trong môi trường Node.js, bạn không cần phải migrate hay cài đặt các sub-process phức tạp. Bạn có hai cách tiếp cận chính:

---

## 1. Cách 1: Import trực tiếp thư viện vào Code Node.js / TypeScript

Bạn có thể cài đặt package và sử dụng API của nó như một module thông thường trong ứng dụng Node.js.

### Bước 1: Cài đặt qua npm

```bash
npm install @rohitg00/agentmemory
# Hoặc phiên bản core engine nếu bạn muốn tự build layer riêng
npm install iii-engine

```

### Bước 2: Khởi tạo và sử dụng trong Mã nguồn

Bạn có thể gọi trực tiếp các hàm khởi tạo bộ nhớ, thêm ngữ cảnh hoặc truy vấn tìm kiếm lai (Hybrid Search) ngay trong luồng code điều khiển Agent của mình:

```typescript
import { AgentMemory } from '@rohitg00/agentmemory';

async function initAgent() {
  // Khởi tạo bộ nhớ dài hạn, tự động cấu hình SQLite và Vector Model nhúng
  const memory = new AgentMemory({
    persistencePath: './.agent_memory',
    embedder: 'local' // Sử dụng all-MiniLM-L6-v2 chạy offline qua ONNX Runtime
  });

  await memory.initialize();

  // 1. Hành vi: Lưu lại một sự kiện/đoạn code vừa xử lý
  await memory.storeEpisode({
    content: "Đã cấu hình JWT Authentication bằng thư viện 'jose' trong file src/auth.ts",
    metadata: {
      file: "src/auth.ts",
      type: "mutation",
      status: "success"
    }
  });

  // 2. Hành vi: Truy vấn ngữ cảnh khi sang một session mới
  const queryResult = await memory.query({
    text: "Làm sao để viết hàm kiểm tra token?",
    limit: 3
  });

  console.log("Ngữ cảnh tìm kiếm lai (Vector + Graph):", queryResult);
}

initAgent();

```

---

## 2. Cách 2: Triển khai Node.js App như một MCP Client / Server

Vì Node.js hỗ trợ giao thức MCP (Model Context Protocol) tốt nhất thông qua SDK chính thức của Anthropic (`@modelcontextprotocol/sdk`), bạn có thể biến ứng dụng Node.js của mình thành một trạm trung chuyển tri thức.

Nếu bạn đang viết một con Bot tự động hóa (ví dụ: tích hợp vào Slack, Discord hoặc hệ thống CI/CD nội bộ bằng Node.js), ứng dụng của bạn sẽ kết nối tới `agentmemory` thông qua kết nối IPC (In-Process Communication) hoặc WebSocket một cách mượt mà:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "npx",
  args: ["-y", "@rohitg00/agentmemory", "start"]
});

const mcpClient = new Client({ name: "my-nodejs-agent", version: "1.0.0" });
await mcpClient.connect(transport);

// Bây giờ Node.js app của bạn có thể gọi tất cả các tool của agentmemory
const memories = await mcpClient.callTool({
  name: "query_memory",
  arguments: { query: "Cấu trúc database dự án này ra sao?" }
});

```

---

## Các lợi thế tuyệt đối khi dùng Node.js với Project này

### 🚀 Tương thích hoàn hảo với ONNX Runtime (Local Embedding)

Trong môi trường Node.js, `iii-engine` tận dụng thư viện `@xenova/transformers` (hoặc ONNX Runtime Web/Node). Thư viện này cho phép Node.js chạy file nhúng mã nguồn C++ để xử lý model `all-MiniLM-L6-v2` với tốc độ cực nhanh, không thua kém gì Python và không gặp các lỗi xung đột bộ nhớ (Memory Allocation) như khi chạy qua JNI của Java.

### 🔄 Đồng bộ hóa không đồng bộ (Asynchronous Event Loop)

Cơ chế `async/await` và Event Loop của Node.js cực kỳ phù hợp cho việc lắng nghe các hành vi (file mutation, terminal logs). Khi Agent của bạn đang viết code, Node.js có thể đẩy việc tính toán Vector và cập nhật Đồ thị tri thức (Knowledge Graph) vào hàng đợi background, giúp Agent không bị khựng lại đợi DB phản hồi.

### 🛠 Hệ sinh thái Agentic Tooling dồi dào

Hầu hết các framework xây dựng AI Agent thế hệ mới mà các lập trình viên thường dùng (như LangChain.js, Vercel AI SDK, hoặc LlamaIndex.TS) đều được viết bằng TypeScript/Node.js. Việc dùng chung Node.js giúp bạn dễ dàng bọc (wrap) `agentmemory` làm tầng lưu trữ (Memory Layer) cho các framework này mà không cần tốn công chuyển đổi kiểu dữ liệu.