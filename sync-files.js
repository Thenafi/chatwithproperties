// Script to sync separate files into worker.js
const fs = require("fs");
const path = require("path");

// Read the separate files
const indexHtml = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const stylesCSS = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
const loginHtml = fs.readFileSync(path.join(__dirname, "login.html"), "utf8");

// Read worker.js
let workerContent = fs.readFileSync(path.join(__dirname, "worker.js"), "utf8");

// Function to escape backticks and backslashes for template literals
function escapeForTemplate(str) {
  return str.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

// Replace the file contents in worker.js
// Find and replace index.html
workerContent = workerContent.replace(
  /(case\s+"index\.html":\s*return\s*`)[\s\S]*?(`;\s*case\s+"login\.html":)/,
  `$1${escapeForTemplate(indexHtml)}$2`
);

// Find and replace login.html
workerContent = workerContent.replace(
  /(case\s+"login\.html":\s*return\s*`)[\s\S]*?(`;\s*case\s+"app\.js":)/,
  `$1${escapeForTemplate(loginHtml)}$2`
);

// Find and replace app.js
workerContent = workerContent.replace(
  /(case\s+"app\.js":\s*return\s*`)[\s\S]*?(`;\s*case\s+"styles\.css":)/,
  `$1${escapeForTemplate(appJs)}$2`
);

// Find and replace styles.css
workerContent = workerContent.replace(
  /(case\s+"styles\.css":\s*return\s*`)[\s\S]*?(`;\s*default:)/,
  `$1${escapeForTemplate(stylesCSS)}$2`
);

// Write the updated worker.js
fs.writeFileSync(path.join(__dirname, "worker.js"), workerContent, "utf8");

console.log("✅ Successfully synced all files into worker.js");
console.log("📝 Files synced: index.html, login.html, app.js, styles.css");
