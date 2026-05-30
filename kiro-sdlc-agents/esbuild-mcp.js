/**
 * esbuild config for bundling mcp-server into a single file.
 * Native addons (better-sqlite3, onnxruntime-node) are externalized
 * since they contain .node binary files that can't be bundled.
 */
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const production = process.argv.includes('--production');

async function main() {
  // Bundle http-entry.js (which spawns index.js as child)
  // We need to bundle BOTH entry points since http-entry spawns index.js

  // Step 1: Bundle index.js (the stdio MCP server)
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, 'mcp-server/index.js')],
    bundle: true,
    outfile: path.resolve(__dirname, 'mcp-server-bundle/index.js'),
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    sourcemap: false,
    minify: production,
    treeShaking: true,
    external: [
      'better-sqlite3',
      'onnxruntime-node',
      'onnxruntime-common',
    ],
    // Resolve from mcp-server/node_modules
    nodePaths: [path.resolve(__dirname, 'mcp-server/node_modules')],
    banner: {
      js: '#!/usr/bin/env node\n"use strict";',
    },
  });

  // Step 2: Bundle http-entry.js (the HTTP wrapper)
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, 'mcp-server/http-entry.js')],
    bundle: true,
    outfile: path.resolve(__dirname, 'mcp-server-bundle/http-entry.js'),
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    sourcemap: false,
    minify: production,
    treeShaking: true,
    external: [
      'better-sqlite3',
      'onnxruntime-node',
      'onnxruntime-common',
    ],
    nodePaths: [path.resolve(__dirname, 'mcp-server/node_modules')],
    banner: {
      js: '#!/usr/bin/env node\n"use strict";',
    },
  });

  // Step 3: Copy viewer static files (HTML/CSS/JS for KB browser)
  const viewerSrc = path.resolve(__dirname, 'mcp-server/viewer');
  const viewerDst = path.resolve(__dirname, 'mcp-server-bundle/viewer');
  if (fs.existsSync(viewerSrc)) {
    copyDir(viewerSrc, viewerDst);
  }

  // Step 4: Copy parser grammars (WASM files needed at runtime)
  const grammarsSrc = path.resolve(__dirname, 'mcp-server/parsers/grammars');
  const grammarsDst = path.resolve(__dirname, 'mcp-server-bundle/parsers/grammars');
  if (fs.existsSync(grammarsSrc)) {
    copyDir(grammarsSrc, grammarsDst);
  }

  // Step 5: Copy grammar-config.json if exists
  const grammarConfig = path.resolve(__dirname, 'mcp-server/parsers/grammar-config.json');
  const grammarConfigDst = path.resolve(__dirname, 'mcp-server-bundle/parsers/grammar-config.json');
  if (fs.existsSync(grammarConfig)) {
    fs.mkdirSync(path.dirname(grammarConfigDst), { recursive: true });
    fs.copyFileSync(grammarConfig, grammarConfigDst);
  }

  console.log('[esbuild-mcp] Bundle complete -> mcp-server-bundle/');

  // Report sizes
  const httpSize = fs.statSync(path.resolve(__dirname, 'mcp-server-bundle/http-entry.js')).size;
  const indexSize = fs.statSync(path.resolve(__dirname, 'mcp-server-bundle/index.js')).size;
  console.log(`  http-entry.js: ${(httpSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  index.js:      ${(indexSize / 1024 / 1024).toFixed(2)} MB`);
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
