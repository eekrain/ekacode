#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const corePkg = path.resolve(__dirname, "../..");
const testsDir = path.resolve(corePkg, "tests");

const DOMAINS = [
  "spec",
  "config",
  "chat",
  "agent",
  "session",
  "workspace",
  "tools",
  "instance",
  "skill",
  "lsp",
  "plugin",
  "security",
  "memory",
  "prompts",
];

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    domain: null,
    dryRun: false,
    apply: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--domain" && args[i + 1]) {
      options.domain = args[i + 1];
      i++;
    } else if (args[i] === "--dry-run") {
      options.dryRun = true;
    } else if (args[i] === "--apply") {
      options.apply = true;
    }
  }

  return options;
}

function getTestFilesForDomain(domain) {
  const domainDir = path.join(testsDir, domain);
  if (!fs.existsSync(domainDir)) {
    return [];
  }

  const files = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith(".test.ts")) {
        files.push(fullPath);
      }
    }
  }
  walk(domainDir);
  return files;
}

function getDestinationPath(sourcePath, domain) {
  const relative = path.relative(path.join(testsDir, domain), sourcePath);
  const destDir = path.join(corePkg, "src", domain, "__tests__");
  return path.join(destDir, relative);
}

function main() {
  const options = parseArgs();

  if (!options.domain) {
    console.error("Usage: node move-domain-tests.mjs --domain <domain> [--dry-run|--apply]");
    console.error(`Available domains: ${DOMAINS.join(", ")}`);
    process.exit(1);
  }

  if (!DOMAINS.includes(options.domain)) {
    console.error(`Invalid domain: ${options.domain}`);
    console.error(`Available domains: ${DOMAINS.join(", ")}`);
    process.exit(1);
  }

  const files = getTestFilesForDomain(options.domain);

  if (files.length === 0) {
    console.log(`No test files found for domain: ${options.domain}`);
    return;
  }

  console.log(`Domain: ${options.domain}`);
  console.log(`Mode: ${options.dryRun ? "DRY RUN" : options.apply ? "APPLY" : "LIST"}`);
  console.log(`Found ${files.length} test file(s)\n`);

  for (const file of files) {
    const dest = getDestinationPath(file, options.domain);
    console.log(`${file}`);
    console.log(`  -> ${dest}`);

    if (options.apply) {
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(file, dest);
      console.log(`  [COPIED]`);
    }
  }

  if (options.apply) {
    console.log(`\n${files.length} file(s) copied.`);
    console.log("Remember to run rewrite-imports.mjs to update import paths.");
  }
}

main();
