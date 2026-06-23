const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\ASUS\\.antigravity-ide\\extensions\\dnguyenminh.kiro-sdlc-agents-2.0.0\\out\\extension.js', 'utf8');

let modified = content;

// Replace outputChannel.appendLine to also write to our debug log!
modified = modified.replace(
  /this\.outputChannel\.appendLine\((.*?)\)/g,
  'this.outputChannel.appendLine($1); require("fs").appendFileSync("C:\\\\Users\\\\ASUS\\\\kiro_debug.log", $1 + "\\n")'
);

fs.writeFileSync('C:\\Users\\ASUS\\.antigravity-ide\\extensions\\dnguyenminh.kiro-sdlc-agents-2.0.0\\out\\extension.js', modified);
console.log('Modified extension.js to mirror outputChannel to kiro_debug.log');
