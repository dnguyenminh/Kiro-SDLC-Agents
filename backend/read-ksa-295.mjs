async function main() {
  try {
    const res = await fetch('http://localhost:48721/mcp/tools/list', {
      method: 'GET',
    });
    const result = await res.json();
    console.log(JSON.stringify(result.tools.map(t => t.name), null, 2));
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}
main();
