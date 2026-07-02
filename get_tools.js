async function check() {
  try {
    const r = await fetch('http://localhost:48721/mcp/tools/list');
    const d = await r.json();
    console.log("Tổng số tool:", d.tools.length);
    console.log("Danh sách:", d.tools.map(t=>t.name).join(', '));
  } catch (e) {
    console.error("Lỗi:", e.message);
  }
}
check();
