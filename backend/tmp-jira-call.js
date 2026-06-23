const http = require('http');

function makeRequest(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port: 3059,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => { resolve(responseData); });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // Initialize
  const initRes = await makeRequest({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2024-11-05",capabilities:{},clientInfo:{name:"sm",version:"1.0"}}});
  console.log("INIT:", initRes);
  
  // List tools
  const listRes = await makeRequest({jsonrpc:"2.0",id:2,method:"tools/list",params:{}});
  console.log("LIST:", listRes);
}
main().catch(console.error);
