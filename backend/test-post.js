import http from 'http';

const payload = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list',
  params: {}
});

const req = http.request('http://localhost:3061/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Body: ${data}`);
  });
});

req.on('error', (err) => console.error(err));
req.write(payload);
req.end();
