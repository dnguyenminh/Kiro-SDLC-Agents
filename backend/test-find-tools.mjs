async function main() {
  console.log('Calling find_tools with query: "search issues"');
  
  try {
    const res = await fetch('http://localhost:48721/mcp/tools/call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tool_name: 'find_tools',
        arguments: {
          query: 'search issues',
          top_k: 3
        }
      })
    });
    
    if (!res.ok) {
      console.error('Error status:', res.status);
      console.error(await res.text());
      return;
    }
    
    const result = await res.json();
    console.log('Result:');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

main();
