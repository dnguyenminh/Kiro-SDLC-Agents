/**
 * Port conflict bug fix tests — ViewerServer port release on shutdown.
 *
 * Bug: When MCP server is reconnected, old instance doesn't release the HTTP
 * viewer port, causing "port already in use" error.
 *
 * Fix: ViewerServer.stop() calls server.close() which releases the port.
 * cleanup() in index.ts calls _viewerServer.stop() on stdin close + SIGTERM/SIGINT.
 *
 * Run: node --experimental-specifier-resolution=node dist/test-port-conflict.js
 * (after: npx tsc)
 */

import * as net from 'net';
import * as http from 'http';
import { ViewerServer } from './http/viewer-server.js';

let passed = 0;
let failed = 0;

function findFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
  });
}

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.once('connect', () => { client.destroy(); resolve(true); });
    client.once('error', () => { client.destroy(); resolve(false); });
    client.connect(port, '127.0.0.1');
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testStopReleasesPort(): Promise<void> {
  const port = await findFreePort();
  const server = new ViewerServer(port, '.');
  server.start();
  await sleep(300);

  const bound = await isPortInUse(port);
  if (!bound) { failed++; console.error('  FAIL: port not bound after start'); return; }

  server.stop();
  await sleep(300);

  const free = !(await isPortInUse(port));
  if (!free) { failed++; console.error('  FAIL: port not released after stop'); return; }

  passed++;
  console.log('  PASS: test_stop_releases_port');
}

async function testReconnectSamePort(): Promise<void> {
  const port = await findFreePort();

  // First instance
  const server1 = new ViewerServer(port, '.');
  server1.start();
  await sleep(300);

  if (!(await isPortInUse(port))) { failed++; console.error('  FAIL: server1 not bound'); return; }

  // Simulate stdin close → cleanup
  server1.stop();
  await sleep(300);

  if (await isPortInUse(port)) { failed++; console.error('  FAIL: port not released after stop'); return; }

  // Second instance on same port — should succeed
  const server2 = new ViewerServer(port, '.');
  try {
    server2.start();
    await sleep(300);
    if (!(await isPortInUse(port))) { failed++; console.error('  FAIL: server2 not bound'); return; }
    server2.stop();
    await sleep(300);
  } catch (e) {
    failed++;
    console.error(`  FAIL: second instance threw: ${e}`);
    return;
  }

  passed++;
  console.log('  PASS: test_reconnect_same_port');
}

async function testStopIdempotent(): Promise<void> {
  const port = await findFreePort();
  const server = new ViewerServer(port, '.');
  server.start();
  await sleep(300);

  try {
    server.stop();
    server.stop(); // Should not throw
    server.stop(); // Should not throw
  } catch (e) {
    failed++;
    console.error(`  FAIL: multiple stop() threw: ${e}`);
    return;
  }

  passed++;
  console.log('  PASS: test_stop_idempotent');
}

async function testStopWithoutStart(): Promise<void> {
  const port = await findFreePort();
  const server = new ViewerServer(port, '.');

  try {
    server.stop(); // Should not throw — server is null
  } catch (e) {
    failed++;
    console.error(`  FAIL: stop() without start() threw: ${e}`);
    return;
  }

  passed++;
  console.log('  PASS: test_stop_without_start');
}

async function main(): Promise<void> {
  console.log('Running Node.js port conflict tests...');
  await testStopReleasesPort();
  await testReconnectSamePort();
  await testStopIdempotent();
  await testStopWithoutStart();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
