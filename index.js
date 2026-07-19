const { transformSync, buildSync } = require('esbuild');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const readline = require('readline');
const { spawn } = require('child_process');

const defaultOptions = {
    target: 'es2020',
    platform: 'node',
    sourcemap: 'inline',
    loader: 'ts',
    outdir: 'dist',
    bundle: false,
    minify: false
};

function debug(filePath, options = {}) {
    const fullPath = path.resolve(filePath);
    
    if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found: ${fullPath}`);
    }

    const { code, map } = compileFile(fullPath, { ...options, sourcemap: 'inline' });
    const tempFile = path.join(require('os').tmpdir(), `tsdk-debug-${Date.now()}.js`);
    
    fs.writeFileSync(tempFile, code);
    
    const debuggerArgs = [
        '--inspect-brk=0.0.0.0:9229',
        tempFile
    ];
    
    const child = spawn(process.execPath, debuggerArgs, {
        stdio: ['inherit', 'inherit', 'inherit']
    });
    
    child.on('close', (code) => {
        fs.unlinkSync(tempFile);
        process.exit(code);
    });
    
    child.on('error', (error) => {
        fs.unlinkSync(tempFile);
        throw error;
    });
    
    console.log(`[tsdk] Debugging: ${fullPath}`);
    console.log('[tsdk] Debugger listening on port 9229');
    console.log('[tsdk] Open chrome://inspect to connect');
    
    return child;
}

function format(filePath, options = {}) {
    const fullPath = path.resolve(filePath);
    
    if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found: ${fullPath}`);
    }
    
    const code = fs.readFileSync(fullPath, 'utf8');
    const prettier = require('prettier');
    
    const config = options.prettierConfig || {
        parser: 'typescript',
        semi: true,
        singleQuote: true,
        tabWidth: 2,
        printWidth: 80,
        trailingComma: 'es5'
    };
    
    try {
        const formatted = prettier.format(code, config);
        fs.writeFileSync(fullPath, formatted);
        console.log(`[tsdk] Formatted: ${fullPath}`);
        return formatted;
    } catch (error) {
        throw new Error(`Formatting error: ${error.message}`);
    }
}

function formatProject(projectDir, options = {}) {
    const dir = path.resolve(projectDir);
    
    if (!fs.existsSync(dir)) {
        throw new Error(`Directory not found: ${dir}`);
    }
    
    const files = [];
    const walk = (currentDir) => {
        const entries = fs.readdirSync(currentDir);
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                if (entry !== 'node_modules' && !entry.startsWith('.')) {
                    walk(fullPath);
                }
            } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
                files.push(fullPath);
            }
        }
    };
    
    walk(dir);
    
    for (const file of files) {
        try {
            format(file, options);
        } catch (error) {
            console.error(`[tsdk] Failed to format ${file}: ${error.message}`);
        }
    }
    
    console.log(`[tsdk] Formatted ${files.length} files`);
    return files.length;
}

function runTests(testGlob, options = {}) {
    const glob = require('glob');
    const files = glob.sync(testGlob);
    
    if (files.length === 0) {
        console.log('[tsdk] No test files found');
        return { passed: 0, failed: 0, total: 0 };
    }
    
    let passed = 0;
    let failed = 0;
    
    console.log(`[tsdk] Running ${files.length} test files...\n`);
    
    for (const file of files) {
        try {
            run(file, options);
            passed++;
            console.log(`✓ ${file}`);
        } catch (error) {
            failed++;
            console.log(`✗ ${file}`);
            console.error(`  Error: ${error.message}`);
        }
    }
    
    console.log(`\n[tsdk] Test Results: ${passed} passed, ${failed} failed, ${files.length} total`);
    
    return { passed, failed, total: files.length };
}

function initTemplate(templateName, projectName = 'tsdk-project') {
    const projectDir = path.resolve(projectName);
    
    if (fs.existsSync(projectDir)) {
        throw new Error(`Directory already exists: ${projectDir}`);
    }
    
    const templates = {
        'basic': () => {
            fs.mkdirSync(projectDir, { recursive: true });
            fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
            
            const tsconfigContent = `{
    "compilerOptions": {
        "target": "ES2020",
        "module": "commonjs",
        "outDir": "./dist",
        "rootDir": "./src",
        "strict": true,
        "esModuleInterop": true
    },
    "include": ["src/**/*"]
}
`;
            
            const packageJsonContent = `{
    "name": "${projectName}",
    "version": "1.0.0",
    "scripts": {
        "start": "tsdk run src/index.ts",
        "watch": "tsdk watch src/index.ts",
        "build": "tsdk build"
    },
    "devDependencies": {
        "tsdk-cli": "^5.1.0"
    }
}
`;
            
            const indexTsContent = `console.log('Hello from tsdk-cli!');

function greet(name: string): string {
    return \`Hello, \${name}!\`;
}

const message = greet('World');
console.log(message);
`;
            
            fs.writeFileSync(path.join(projectDir, 'tsconfig.json'), tsconfigContent);
            fs.writeFileSync(path.join(projectDir, 'package.json'), packageJsonContent);
            fs.writeFileSync(path.join(projectDir, 'src/index.ts'), indexTsContent);
            
            return { files: ['tsconfig.json', 'package.json', 'src/index.ts'] };
        },
        
        'node-api': () => {
            fs.mkdirSync(projectDir, { recursive: true });
            fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
            
            const tsconfigContent = `{
    "compilerOptions": {
        "target": "ES2020",
        "module": "commonjs",
        "outDir": "./dist",
        "rootDir": "./src",
        "strict": true,
        "esModuleInterop": true
    },
    "include": ["src/**/*"]
}
`;
            
            const packageJsonContent = `{
    "name": "${projectName}",
    "version": "1.0.0",
    "scripts": {
        "start": "tsdk run src/index.ts",
        "watch": "tsdk watch src/index.ts",
        "build": "tsdk build"
    },
    "dependencies": {
        "express": "^4.18.0"
    },
    "devDependencies": {
        "@types/express": "^4.17.0",
        "tsdk-cli": "^5.1.0"
    }
}
`;
            
            const indexTsContent = `import express, { Request, Response } from 'express';

const app = express();
const port = 3000;

app.get('/', (req: Request, res: Response) => {
    res.send('Hello from tsdk-cli Node API!');
});

app.get('/api/users', (req: Request, res: Response) => {
    res.json([
        { id: 1, name: 'John Doe' },
        { id: 2, name: 'Jane Smith' }
    ]);
});

app.listen(port, () => {
    console.log(\`Server running on http://localhost:\${port}\`);
});
`;
            
            fs.writeFileSync(path.join(projectDir, 'tsconfig.json'), tsconfigContent);
            fs.writeFileSync(path.join(projectDir, 'package.json'), packageJsonContent);
            fs.writeFileSync(path.join(projectDir, 'src/index.ts'), indexTsContent);
            
            return { files: ['tsconfig.json', 'package.json', 'src/index.ts'] };
        },
        
        'cli-tool': () => {
            fs.mkdirSync(projectDir, { recursive: true });
            fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
            
            const tsconfigContent = `{
    "compilerOptions": {
        "target": "ES2020",
        "module": "commonjs",
        "outDir": "./dist",
        "rootDir": "./src",
        "strict": true,
        "esModuleInterop": true
    },
    "include": ["src/**/*"]
}
`;
            
            const packageJsonContent = `{
    "name": "${projectName}",
    "version": "1.0.0",
    "bin": {
        "${projectName}": "./dist/index.js"
    },
    "scripts": {
        "start": "tsdk run src/index.ts",
        "watch": "tsdk watch src/index.ts",
        "build": "tsdk build",
        "link": "npm link"
    },
    "devDependencies": {
        "tsdk-cli": "^5.1.0"
    }
}
`;
            
            const indexTsContent = `#!/usr/bin/env node

const args = process.argv.slice(2);

console.log(\`${projectName} CLI Tool\`);
console.log('Arguments:', args);

if (args.includes('--help')) {
    console.log(\`
Usage: ${projectName} [options]

Options:
  --help      Show this help message
  --version   Show version
  --hello     Say hello
    \`);
}

if (args.includes('--hello')) {
    console.log('Hello from CLI tool!');
}
`;
            
            fs.writeFileSync(path.join(projectDir, 'tsconfig.json'), tsconfigContent);
            fs.writeFileSync(path.join(projectDir, 'package.json'), packageJsonContent);
            fs.writeFileSync(path.join(projectDir, 'src/index.ts'), indexTsContent);
            
            return { files: ['tsconfig.json', 'package.json', 'src/index.ts'] };
        }
    };
    
    if (!templates[templateName]) {
        throw new Error(`Unknown template: ${templateName}. Available templates: ${Object.keys(templates).join(', ')}`);
    }
    
    const result = templates[templateName]();
    console.log(`Project created: ${projectDir}`);
    console.log('Files created:', result.files.join(', '));
    console.log('\nRun: cd', projectName, '&& npm install');
    
    return projectDir;
}

function compile(code, options = {}) {
    const mergedOptions = { ...defaultOptions, ...options };
    
    try {
        const result = transformSync(code, {
            target: mergedOptions.target,
            platform: mergedOptions.platform,
            sourcemap: mergedOptions.sourcemap,
            loader: mergedOptions.loader
        });
        
        return {
            code: result.code,
            map: result.map
        };
    } catch (error) {
        throw new Error(`Compilation error: ${error.message}`);
    }
}

function compileFile(filePath, options = {}) {
    const fullPath = path.resolve(filePath);
    
    if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found: ${fullPath}`);
    }
    
    const code = fs.readFileSync(fullPath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();
    
    const loader = ext === '.tsx' ? 'tsx' : 'ts';
    
    return compile(code, { ...options, loader });
}

function run(filePath, options = {}) {
    const { code } = compileFile(filePath, options);
    
    const moduleWrapper = `
        const module = { exports: {} };
        const require = (path) => {
            const resolved = require.resolve(path);
            return require(resolved);
        };
        require.resolve = (path) => {
            return require.resolve(path);
        };
        const exports = module.exports;
        ${code}
        return module.exports;
    `;
    
    return new Function('require', 'module', 'exports', '__dirname', '__filename', code)(
        require,
        { exports: {} },
        {},
        path.dirname(path.resolve(filePath)),
        path.resolve(filePath)
    );
}

function requireTs(modulePath) {
    const ext = path.extname(modulePath);
    const filePath = ext ? modulePath : `${modulePath}.ts`;
    const fullPath = path.resolve(filePath);
    
    if (!fs.existsSync(fullPath)) {
        throw new Error(`Module not found: ${fullPath}`);
    }
    
    const { code } = compileFile(fullPath);
    
    const module = { exports: {} };
    const requireFn = (reqPath) => {
        let resolved = reqPath;
        if (!path.isAbsolute(reqPath)) {
            resolved = path.resolve(path.dirname(fullPath), reqPath);
            if (!fs.existsSync(resolved)) {
                resolved += '.js';
            }
            if (!fs.existsSync(resolved)) {
                resolved = require.resolve(reqPath);
            }
        }
        if (resolved.endsWith('.ts') || resolved.endsWith('.tsx')) {
            return requireTs(resolved);
        }
        return require(resolved);
    };
    
    requireFn.resolve = (reqPath) => require.resolve(reqPath);
    
    const dirname = path.dirname(fullPath);
    
    const wrappedCode = code.replace(/export\s+const\s+(\w+)\s*=\s*/g, 'module.exports.$1 = ')
                             .replace(/export\s+function\s+(\w+)/g, 'module.exports.$1 = function $1')
                             .replace(/export\s+default\s+/g, 'module.exports = ')
                             .replace(/export\s+\{\s*([^}]+)\s*\}/g, (match, exports) => {
                                 return exports.split(',').map(e => {
                                     const name = e.trim();
                                     return `module.exports['${name}'] = ${name};`;
                                 }).join('\n');
                             });
    
    new Function('require', 'module', 'exports', '__dirname', '__filename', wrappedCode)(
        requireFn,
        module,
        module.exports,
        dirname,
        fullPath
    );
    
    return module.exports;
}

function compileProject(entryPoints, options = {}) {
    const mergedOptions = { ...defaultOptions, ...options };
    
    try {
        const result = buildSync({
            entryPoints: entryPoints,
            bundle: mergedOptions.bundle,
            minify: mergedOptions.minify,
            sourcemap: mergedOptions.sourcemap,
            target: mergedOptions.target,
            platform: mergedOptions.platform,
            outdir: mergedOptions.outdir,
            loader: {
                '.ts': 'ts',
                '.tsx': 'tsx',
                '.js': 'js'
            }
        });
        
        return {
            success: true,
            errors: result.errors,
            warnings: result.warnings
        };
    } catch (error) {
        return {
            success: false,
            errors: [error.message],
            warnings: []
        };
    }
}

function watch(filePath, options = {}, callback) {
    const fullPath = path.resolve(filePath);
    const dir = fs.statSync(fullPath).isDirectory() ? fullPath : path.dirname(fullPath);
    
    const watcher = chokidar.watch(fullPath, {
        ignored: /node_modules/,
        persistent: true,
        ignoreInitial: true
    });
    
    watcher.on('change', (changedPath) => {
        console.log(`\n[tsdk] File changed: ${changedPath}`);
        try {
            if (typeof callback === 'function') {
                callback(changedPath);
            } else {
                run(changedPath, options);
                console.log('[tsdk] Reloaded successfully');
            }
        } catch (error) {
            console.error(`[tsdk] Error: ${error.message}`);
        }
    });
    
    watcher.on('add', (addedPath) => {
        console.log(`[tsdk] File added: ${addedPath}`);
    });
    
    watcher.on('unlink', (removedPath) => {
        console.log(`[tsdk] File removed: ${removedPath}`);
    });
    
    console.log(`[tsdk] Watching: ${fullPath}`);
    
    return watcher;
}

function startRepl(options = {}) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'tsdk> ',
        historySize: 100
    });
    
    console.log('TypeScript REPL - Type ".exit" to quit, ".help" for commands');
    
    rl.prompt();
    
    rl.on('line', async (input) => {
        const trimmed = input.trim();
        
        if (trimmed === '.exit') {
            rl.close();
            return;
        }
        
        if (trimmed === '.help') {
            console.log('Available commands:');
            console.log('  .exit      - Exit the REPL');
            console.log('  .help      - Show this help');
            console.log('  .clear     - Clear the screen');
            console.log('  .load <file> - Load and execute a TypeScript file');
            rl.prompt();
            return;
        }
        
        if (trimmed === '.clear') {
            console.clear();
            rl.prompt();
            return;
        }
        
        if (trimmed.startsWith('.load ')) {
            const filePath = trimmed.substring(6).trim();
            try {
                const result = run(filePath, options);
                console.log('Loaded:', Object.keys(result));
            } catch (error) {
                console.error('Error:', error.message);
            }
            rl.prompt();
            return;
        }
        
        if (!trimmed) {
            rl.prompt();
            return;
        }
        
        try {
            const compiled = compile(trimmed, { ...options, loader: 'ts' });
            
            const result = new Function('console', 'require', compiled.code)(console, require);
            
            if (result !== undefined) {
                console.log(result);
            }
        } catch (error) {
            console.error('Error:', error.message);
        }
        
        rl.prompt();
    });
    
    rl.on('close', () => {
        console.log('\nGoodbye!');
        process.exit(0);
    });
}

function initProject(projectName = 'tsdk-project') {
    const projectDir = path.resolve(projectName);
    
    if (fs.existsSync(projectDir)) {
        throw new Error(`Directory already exists: ${projectDir}`);
    }
    
    fs.mkdirSync(projectDir, { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
    
    const tsconfigContent = `{
    "compilerOptions": {
        "target": "ES2020",
        "module": "commonjs",
        "outDir": "./dist",
        "rootDir": "./src",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules"]
}
`;
    
    const packageJsonContent = `{
    "name": "${projectName}",
    "version": "1.0.0",
    "description": "A TypeScript project using tsdk-cli",
    "main": "dist/index.js",
    "scripts": {
        "start": "tsdk run src/index.ts",
        "watch": "tsdk watch src/index.ts",
        "build": "tsdk build",
        "repl": "tsdk repl"
    },
    "dependencies": {},
    "devDependencies": {
        "tsdk-cli": "^5.0.0",
        "typescript": "^5.0.0"
    }
}
`;
    
    const indexTsContent = `console.log('Hello from tsdk-cli!');

function greet(name: string): string {
    return \`Hello, \${name}!\`;
}

const message = greet('World');
console.log(message);
`;
    
    const gitignoreContent = `node_modules/
dist/
*.log
`;
    
    fs.writeFileSync(path.join(projectDir, 'tsconfig.json'), tsconfigContent);
    fs.writeFileSync(path.join(projectDir, 'package.json'), packageJsonContent);
    fs.writeFileSync(path.join(projectDir, 'src/index.ts'), indexTsContent);
    fs.writeFileSync(path.join(projectDir, '.gitignore'), gitignoreContent);
    
    console.log(`Project created: ${projectDir}`);
    console.log('Structure:');
    console.log(`  ${projectName}/`);
    console.log(`    src/`);
    console.log(`      index.ts`);
    console.log(`    package.json`);
    console.log(`    tsconfig.json`);
    console.log(`    .gitignore`);
    console.log('\nRun: cd', projectName, '&& npm install');
    
    return projectDir;
}

function loadConfig(configPath = 'tsdk.config.js') {
    const fullPath = path.resolve(configPath);
    
    if (!fs.existsSync(fullPath)) {
        return defaultOptions;
    }
    
    try {
        const config = require(fullPath);
        return { ...defaultOptions, ...config };
    } catch (error) {
        console.warn(`Failed to load config: ${error.message}`);
        return defaultOptions;
    }
}

function bundle(entryPoint, outputPath, options = {}) {
    const mergedOptions = { ...defaultOptions, ...options };
    
    try {
        const result = buildSync({
            entryPoints: [entryPoint],
            bundle: true,
            minify: mergedOptions.minify,
            sourcemap: mergedOptions.sourcemap,
            target: mergedOptions.target,
            platform: mergedOptions.platform,
            outfile: outputPath,
            loader: {
                '.ts': 'ts',
                '.tsx': 'tsx',
                '.js': 'js'
            },
            external: mergedOptions.external || []
        });
        
        return {
            success: true,
            outputPath,
            errors: result.errors,
            warnings: result.warnings
        };
    } catch (error) {
        return {
            success: false,
            outputPath: null,
            errors: [error.message],
            warnings: []
        };
    }
}

module.exports = {
    compile,
    compileFile,
    compileProject,
    run,
    requireTs,
    watch,
    startRepl,
    initProject,
    loadConfig,
    bundle,
    debug,
    format,
    formatProject,
    runTests,
    initTemplate,
    defaultOptions
};