#!/usr/bin/env node
/**
 * Post-build script to strip "node:" prefix from require() calls
 *
 * Problem: Vite SSR builds preserve "node:" prefix in bundled dependencies
 * (like pino, sonic-boom, thread-stream). Electron preload scripts run in
 * a sandboxed context where "node:" protocol imports don't work.
 *
 * Solution: Replace require("node:X") with require("X") in the compiled output.
 */

const fs = require("fs");
const path = require("path");

const DIST_DIR = path.join(__dirname, "..", "dist");

/**
 * Strip node: prefix from require() calls in a file
 */
function fixNodePrefixInFile(filePath) {
  let content = fs.readFileSync(filePath, "utf-8");
  const originalContent = content;

  // Replace require("node:X") with require("X")
  // This regex handles: require("node:os"), require('node:path'), etc.
  content = content.replace(/require\s*\(\s*["']node:([^"']+)["']\s*\)/g, 'require("$1")');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, "utf-8");
    console.log(`[fix-node-prefix] Fixed node: prefixes in ${path.basename(filePath)}`);
    return true;
  }

  return false;
}

/**
 * Process all .cjs files in the dist directory
 */
function main() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error(`[fix-node-prefix] Error: Dist directory not found: ${DIST_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(DIST_DIR);
  let fixedCount = 0;

  for (const file of files) {
    if (file.endsWith(".cjs")) {
      const filePath = path.join(DIST_DIR, file);
      if (fixNodePrefixInFile(filePath)) {
        fixedCount++;
      }
    }
  }

  if (fixedCount > 0) {
    console.log(`[fix-node-prefix] Fixed ${fixedCount} file(s)`);
  } else {
    console.log("[fix-node-prefix] No files needed fixing");
  }
}

main();
