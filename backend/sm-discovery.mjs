async function discover(query) {
  const res = await fetch('http://localhost:48721/mcp/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool_name: 'find_tools',
      arguments: { query, top_k: 5, threshold: 0.4 }
    })
  });
  const data = await res.json();
  if (data.isError) return [];
  const parsed = JSON.parse(data.content[0].text);
  return parsed.tools.map(t => t.name);
}

async function main() {
  const t1 = await discover("get issue details from project tracker");
  const t2 = await discover("search knowledge base semantic");
  const t3 = await discover("convert markdown to docx word document");
  
  console.log("Project tracker tools:", t1);
  console.log("KB tools:", t2);
  console.log("Document export tools:", t3);
}

main();
