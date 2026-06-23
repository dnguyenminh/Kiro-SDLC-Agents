const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\ASUS\\.antigravity-ide\\extensions\\dnguyenminh.kiro-sdlc-agents-2.0.0\\out\\extension.js', 'utf8');
const modified = content.replace(
  'this.outputChannel.appendLine(`[MCP-InProcess] Failed to start: ${l}`),c}}',
  'this.outputChannel.appendLine(`[MCP-InProcess] Failed to start: ${l}`); require("fs").appendFileSync("C:\\\\Users\\\\ASUS\\\\kiro_debug.log", "ERROR: " + (c.stack || c) + "\\n"); throw c}}'
);
fs.writeFileSync('C:\\Users\\ASUS\\.antigravity-ide\\extensions\\dnguyenminh.kiro-sdlc-agents-2.0.0\\out\\extension.js', modified);
console.log('Modified extension.js to write errors to debug log');
