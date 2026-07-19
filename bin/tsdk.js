#!/usr/bin/env node

const { compileFile, run, requireTs } = require('../index.js');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);

if (args.length === 0) {
    console.log(`
tsdk-cli - TypeScript Development Kit

Usage:
  tsdk <file> [args...]       Run a TypeScript file
  tsdk -e <code>              Evaluate TypeScript code
  tsdk -v, --version          Show version
  tsdk -h, --help             Show this help

Examples:
  tsdk app.ts
  tsdk server.ts --port 3000
  tsdk -e "console.log('Hello TypeScript!')"
    `);
    process.exit(0);
}

const version = require('../package.json').version;

if (args[0] === '-v' || args[0] === '--version') {
    console.log(`tsdk-cli v${version}`);
    process.exit(0);
}

if (args[0] === '-h' || args[0] === '--help') {
    console.log(`
tsdk-cli - TypeScript Development Kit

Usage:
  tsdk <file> [args...]       Run a TypeScript file
  tsdk -e <code>              Evaluate TypeScript code
  tsdk -v, --version          Show version
  tsdk -h, --help             Show this help

Examples:
  tsdk app.ts
  tsdk server.ts --port 3000
  tsdk -e "console.log('Hello TypeScript!')"
    `);
    process.exit(0);
}

if (args[0] === '-e') {
    const code = args[1];
    if (!code) {
        console.error('Error: No code provided with -e option');
        process.exit(1);
    }
    
    try {
        const { compile } = require('../index.js');
        const { code: compiled } = compile(code, { loader: 'ts' });
        eval(compiled);
        process.exit(0);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

const filePath = args[0];
const fileArgs = args.slice(1);

const ext = path.extname(filePath).toLowerCase();

if (!ext || (ext !== '.ts' && ext !== '.tsx')) {
    console.error(`Error: Unsupported file type ${ext}. Only .ts and .tsx files are supported.`);
    process.exit(1);
}

const fullPath = path.resolve(filePath);

if (!fs.existsSync(fullPath)) {
    console.error(`Error: File not found: ${fullPath}`);
    process.exit(1);
}

process.argv = [process.argv[0], process.argv[1], ...fileArgs];

try {
    requireTs(fullPath);
} catch (error) {
    console.error(`Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
}
