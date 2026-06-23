import http from 'http';

const endpoints = [
  'http://localhost:3061/mcp?sessionId=test'
];

async function checkEndpoint(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ url, status: res.statusCode, contentType: res.headers['content-type'], body: data });
      });
    }).on('error', (err) => {
      resolve({ url, error: err.message });
    });
  });
}

async function main() {
  console.log('Testing Atlassian endpoints on port 3061...');
  for (const url of endpoints) {
    const result = await checkEndpoint(url);
    console.log(JSON.stringify(result));
  }
}

main();
