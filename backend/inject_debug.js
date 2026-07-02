const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\ASUS\\.antigravity-ide\\extensions\\dnguyenminh.kiro-sdlc-agents-2.0.0\\out\\extension.js', 'utf8');
const modified = content.replace(
  'this.outputChannel.appendLine(`[MCP-InProcess] Server running in-process on port ${this._port} (PID: ${process.pid})`),this.updateMcpJson()',
  'this.outputChannel.appendLine(`[MCP-InProcess] Server running in-process on port ${this._port} (PID: ${process.pid})`),this.updateMcpJson(); require("fs").appendFileSync("C:\\\\Users\\\\ASUS\\\\kiro_debug.log", "SERVER STARTED ON " + this._port + "\\n");'
);
fs.writeFileSync('C:\\Users\\ASUS\\.antigravity-ide\\extensions\\dnguyenminh.kiro-sdlc-agents-2.0.0\\out\\extension.js', modified);
console.log('Modified extension.js to write debug logs');
