"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const net = __importStar(require("net"));
const viewer_server_js_1 = require("./http/viewer-server.js");
let passed = 0;
let failed = 0;
function findFreePort() {
    return new Promise((resolve) => {
        const srv = net.createServer();
        srv.listen(0, '127.0.0.1', () => {
            const port = srv.address().port;
            srv.close(() => resolve(port));
        });
    });
}
function isPortInUse(port) {
    return new Promise((resolve) => {
        const client = new net.Socket();
        client.once('connect', () => { client.destroy(); resolve(true); });
        client.once('error', () => { client.destroy(); resolve(false); });
        client.connect(port, '127.0.0.1');
    });
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function testStopReleasesPort() {
    const port = await findFreePort();
    const server = new viewer_server_js_1.ViewerServer(port, '.');
    server.start();
    await sleep(300);
    const bound = await isPortInUse(port);
    if (!bound) {
        failed++;
        console.error('  FAIL: port not bound after start');
        return;
    }
    server.stop();
    await sleep(300);
    const free = !(await isPortInUse(port));
    if (!free) {
        failed++;
        console.error('  FAIL: port not released after stop');
        return;
    }
    passed++;
    console.log('  PASS: test_stop_releases_port');
}
async function testReconnectSamePort() {
    const port = await findFreePort();
    // First instance
    const server1 = new viewer_server_js_1.ViewerServer(port, '.');
    server1.start();
    await sleep(300);
    if (!(await isPortInUse(port))) {
        failed++;
        console.error('  FAIL: server1 not bound');
        return;
    }
    // Simulate stdin close → cleanup
    server1.stop();
    await sleep(300);
    if (await isPortInUse(port)) {
        failed++;
        console.error('  FAIL: port not released after stop');
        return;
    }
    // Second instance on same port — should succeed
    const server2 = new viewer_server_js_1.ViewerServer(port, '.');
    try {
        server2.start();
        await sleep(300);
        if (!(await isPortInUse(port))) {
            failed++;
            console.error('  FAIL: server2 not bound');
            return;
        }
        server2.stop();
        await sleep(300);
    }
    catch (e) {
        failed++;
        console.error(`  FAIL: second instance threw: ${e}`);
        return;
    }
    passed++;
    console.log('  PASS: test_reconnect_same_port');
}
async function testStopIdempotent() {
    const port = await findFreePort();
    const server = new viewer_server_js_1.ViewerServer(port, '.');
    server.start();
    await sleep(300);
    try {
        server.stop();
        server.stop(); // Should not throw
        server.stop(); // Should not throw
    }
    catch (e) {
        failed++;
        console.error(`  FAIL: multiple stop() threw: ${e}`);
        return;
    }
    passed++;
    console.log('  PASS: test_stop_idempotent');
}
async function testStopWithoutStart() {
    const port = await findFreePort();
    const server = new viewer_server_js_1.ViewerServer(port, '.');
    try {
        server.stop(); // Should not throw — server is null
    }
    catch (e) {
        failed++;
        console.error(`  FAIL: stop() without start() threw: ${e}`);
        return;
    }
    passed++;
    console.log('  PASS: test_stop_without_start');
}
async function main() {
    console.log('Running Node.js port conflict tests...');
    await testStopReleasesPort();
    await testReconnectSamePort();
    await testStopIdempotent();
    await testStopWithoutStart();
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
}
main();
//# sourceMappingURL=test-port-conflict.js.map