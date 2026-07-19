const verbose = process.argv.slice(2).includes('--verbose');

const originalArgv = process.argv;
process.argv = [process.argv[0], process.argv[1]];

const yaggs = require('../index');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        if (verbose) console.log(`\u001b[32m✓ ${name}\u001b[0m`);
    } catch (err) {
        failed++;
        console.log(`\u001b[31m✗ ${name}\u001b[0m`);
        console.log(`  ${err.message}`);
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

function assertDeepEqual(actual, expected, message) {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
        throw new Error(message || `Expected ${expectedStr}, got ${actualStr}`);
    }
}

function assertTruthy(value, message) {
    if (!value) {
        throw new Error(message || `Expected truthy value, got ${value}`);
    }
}

function assertFalsy(value, message) {
    if (value) {
        throw new Error(message || `Expected falsy value, got ${value}`);
    }
}

test('Basic option parsing', () => {
    const parser = yaggs();
    parser.option('name', { type: 'string' });
    
    const result = parser.parse(['--name', 'test']);
    assertEqual(result.name, 'test');
});

test('Short option parsing', () => {
    const parser = yaggs();
    parser.option('name', { type: 'string', alias: 'n' });
    
    const result = parser.parse(['-n', 'test']);
    assertEqual(result.name, 'test');
});

test('Boolean option', () => {
    const parser = yaggs();
    parser.option('verbose', { type: 'boolean', alias: 'v' });
    
    const result = parser.parse(['--verbose']);
    assertEqual(result.verbose, true);
});

test('Multiple short options combined', () => {
    const parser = yaggs();
    parser.option('verbose', { type: 'boolean', alias: 'v' });
    parser.option('force', { type: 'boolean', alias: 'f' });
    
    const result = parser.parse(['-vf']);
    assertEqual(result.verbose, true);
    assertEqual(result.force, true);
});

test('Option with value in short form', () => {
    const parser = yaggs();
    parser.option('name', { type: 'string', alias: 'n' });
    
    const result = parser.parse(['-ntest']);
    assertEqual(result.name, 'test');
});

test('Option with = separator', () => {
    const parser = yaggs();
    parser.option('name', { type: 'string' });
    
    const result = parser.parse(['--name=test']);
    assertEqual(result.name, 'test');
});

test('Array option', () => {
    const parser = yaggs();
    parser.option('files', { type: 'string', array: true, alias: 'f' });
    
    const result = parser.parse(['--files', 'a.txt', 'b.txt', 'c.txt']);
    assertDeepEqual(result.files, ['a.txt', 'b.txt', 'c.txt']);
});

test('Number type conversion', () => {
    const parser = yaggs();
    parser.option('count', { type: 'number' });
    
    const result = parser.parse(['--count', '42']);
    assertEqual(typeof result.count, 'number');
    assertEqual(result.count, 42);
});

test('Integer type conversion', () => {
    const parser = yaggs();
    parser.option('age', { type: 'integer' });
    
    const result = parser.parse(['--age', '25']);
    assertEqual(typeof result.age, 'number');
    assertEqual(result.age, 25);
});

test('Boolean type conversion from string', () => {
    const parser = yaggs();
    parser.option('enabled', { type: 'boolean' });
    
    const result = parser.parse(['--enabled', 'true']);
    assertEqual(result.enabled, true);
});

test('JSON type conversion', () => {
    const parser = yaggs();
    parser.option('config', { type: 'json' });
    
    const result = parser.parse(['--config', '{"foo":"bar"}']);
    assertDeepEqual(result.config, { foo: 'bar' });
});

test('Default values', () => {
    const parser = yaggs();
    parser.option('mode', { type: 'string', default: 'production' });
    
    const result = parser.parse([]);
    assertEqual(result.mode, 'production');
});

test('Default values from function', () => {
    const parser = yaggs();
    parser.option('timestamp', { type: 'number', default: () => Date.now() });
    
    const result = parser.parse([]);
    assertEqual(typeof result.timestamp, 'number');
    assertTruthy(result.timestamp > 0);
});

test('Positional arguments', () => {
    const parser = yaggs();
    parser.positional('file', { type: 'string' });
    
    const result = parser.parse(['myfile.txt']);
    assertEqual(result.file, 'myfile.txt');
});

test('Multiple positional arguments', () => {
    const parser = yaggs();
    parser.positional('source', { type: 'string' });
    parser.positional('destination', { type: 'string' });
    
    const result = parser.parse(['a.txt', 'b.txt']);
    assertEqual(result.source, 'a.txt');
    assertEqual(result.destination, 'b.txt');
});

test('Choices validation', () => {
    const parser = yaggs();
    parser.option('mode', { type: 'string', choices: ['dev', 'prod', 'test'] });
    
    const result = parser.parse(['--mode', 'dev']);
    assertEqual(result.mode, 'dev');
});

test('Min/max validation', () => {
    const parser = yaggs();
    parser.option('port', { type: 'integer', min: 1, max: 65535 });
    
    const result = parser.parse(['--port', '8080']);
    assertEqual(result.port, 8080);
});

test('Custom validation', () => {
    const parser = yaggs();
    parser.option('email', { 
        type: 'string', 
        validate: (val) => val.includes('@') 
    });
    
    const result = parser.parse(['--email', 'test@example.com']);
    assertEqual(result.email, 'test@example.com');
});

test('Command registration', () => {
    const parser = yaggs();
    parser.command('start', {
        description: 'Start the server',
        handler: (argv) => {}
    });
    
    const result = parser.parse(['start']);
    assertEqual(result.command, 'start');
});

test('Commands with options', () => {
    const parser = yaggs();
    parser.command('start', {
        description: 'Start the server',
        builder: (y) => {
            y.option('port', { type: 'integer', default: 3000 });
        },
        handler: (argv) => {}
    });
    
    const result = parser.parse(['start', '--port', '8080']);
    assertEqual(result.command, 'start');
    assertEqual(result.port, 8080);
});

test('Help option', () => {
    const parser = yaggs();
    parser.option('name', { type: 'string' });
    
    let helpShown = false;
    parser.exitProcess(false);
    parser.wrapHelp(() => {
        helpShown = true;
        return '';
    });
    
    try {
        parser.parse(['--help']);
    } catch (e) {}
    
    assertTruthy(helpShown);
});

test('Version option', () => {
    const parser = yaggs({ version: '2.0.0' });
    parser.exitProcess(false);
    
    let versionShown = false;
    const originalLog = console.log;
    console.log = (msg) => {
        if (msg === '2.0.0') versionShown = true;
    };
    
    try {
        parser.parse(['--version']);
    } catch (e) {}
    
    console.log = originalLog;
    assertTruthy(versionShown);
});

test('Middlewares', () => {
    const parser = yaggs();
    parser.option('name', { type: 'string' });
    
    let middlewareCalled = false;
    parser.middleware((argv) => {
        middlewareCalled = true;
        argv.processed = true;
    });
    
    parser.parse(['--name', 'test']);
    assertTruthy(middlewareCalled);
});

test('Defaults method', () => {
    const parser = yaggs();
    parser.option('mode', { type: 'string' });
    
    parser.defaults({ mode: 'default' });
    const result = parser.parse([]);
    assertEqual(result.mode, 'default');
});

test('Parse async', async () => {
    const parser = yaggs();
    parser.option('name', { type: 'string' });
    
    let asyncMiddlewareCalled = false;
    parser.middleware(async (argv) => {
        asyncMiddlewareCalled = true;
        await new Promise(r => setTimeout(r, 10));
    });
    
    await parser.parseAsync(['--name', 'test']);
    assertTruthy(asyncMiddlewareCalled);
});

test('Unknown options are stored', () => {
    const parser = yaggs();
    parser.option('known', { type: 'string' });
    
    const result = parser.parse(['--known', 'value', '--unknown', 'other']);
    assertEqual(result.known, 'value');
    assertEqual(result.unknown, 'other');
});

test('Dash dash separator', () => {
    const parser = yaggs();
    
    const result = parser.parse(['--', '--should-be-arg', 'value']);
    assertDeepEqual(result._, ['--should-be-arg', 'value']);
});

test('Aliases mapping', () => {
    const parser = yaggs();
    parser.option('verbose', { type: 'boolean', alias: ['v', 'verb'] });
    
    const result = parser.parse(['-v']);
    assertEqual(result.verbose, true);
});

test('Multiple aliases', () => {
    const parser = yaggs();
    parser.option('output', { type: 'string', alias: ['o', 'out'] });
    
    const result1 = parser.parse(['-o', 'file1.txt']);
    const result2 = parser.parse(['--out', 'file2.txt']);
    
    assertEqual(result1.output, 'file1.txt');
    assertEqual(result2.output, 'file2.txt');
});

test('Help text generation', () => {
    const parser = yaggs({ scriptName: 'myapp' });
    parser.option('name', { type: 'string', description: 'Your name' });
    parser.command('run', { description: 'Run the app' });
    
    const help = parser.getHelp();
    assertTruthy(help.includes('myapp'));
    assertTruthy(help.includes('--name'));
    assertTruthy(help.includes('run'));
});

test('Hidden options not in help', () => {
    const parser = yaggs();
    parser.option('visible', { type: 'string', description: 'Visible' });
    parser.option('hidden', { type: 'string', hidden: true });
    
    const help = parser.getHelp();
    assertTruthy(help.includes('--visible'));
    assertFalsy(help.includes('--hidden'));
});

test('Example generation', () => {
    const parser = yaggs();
    parser.example('myapp --name test', 'Run with name');
    
    const help = parser.getHelp();
    assertTruthy(help.includes('myapp --name test'));
});

test('Package version', () => {
    const parser = yaggs({ 
        pkg: { version: '1.5.0' },
        exitProcess: false 
    });
    
    let versionShown = false;
    const originalLog = console.log;
    console.log = (msg) => {
        if (msg === '1.5.0') versionShown = true;
    };
    
    try {
        parser.parse(['--version']);
    } catch (e) {}
    
    console.log = originalLog;
    assertTruthy(versionShown);
});

test('Handler execution', async () => {
    const parser = yaggs();
    parser.command('test', {
        handler: (argv) => {
            argv.handled = true;
        }
    });
    
    const result = await parser.run(['test']);
    assertEqual(result.handled, true);
});

test('Hook execution', async () => {
    const parser = yaggs();
    parser.command('test', {
        handler: () => {}
    });
    
    let beforeCalled = false;
    let afterCalled = false;
    
    parser.hook('beforeCommand', () => { beforeCalled = true; });
    parser.hook('afterCommand', () => { afterCalled = true; });
    
    await parser.run(['test']);
    
    assertTruthy(beforeCalled);
    assertTruthy(afterCalled);
});

test('Positional with type conversion', () => {
    const parser = yaggs();
    parser.positional('count', { type: 'integer' });
    
    const result = parser.parse(['42']);
    assertEqual(typeof result.count, 'number');
    assertEqual(result.count, 42);
});

test('Positional with choices', () => {
    const parser = yaggs();
    parser.positional('action', { type: 'string', choices: ['start', 'stop'] });
    
    const result = parser.parse(['start']);
    assertEqual(result.action, 'start');
});

test('Positional with default', () => {
    const parser = yaggs();
    parser.positional('mode', { type: 'string', default: 'default' });
    
    const result = parser.parse([]);
    assertEqual(result.mode, 'default');
});

test('Multiple array options', () => {
    const parser = yaggs();
    parser.option('include', { type: 'string', array: true });
    parser.option('exclude', { type: 'string', array: true });
    
    const result = parser.parse(['--include', 'a', 'b', '--exclude', 'c', 'd']);
    assertDeepEqual(result.include, ['a', 'b']);
    assertDeepEqual(result.exclude, ['c', 'd']);
});

test('Mixed option types', () => {
    const parser = yaggs();
    parser.option('name', { type: 'string' });
    parser.option('count', { type: 'number' });
    parser.option('enabled', { type: 'boolean' });
    
    const result = parser.parse(['--name', 'test', '--count', '42', '--enabled']);
    assertEqual(result.name, 'test');
    assertEqual(result.count, 42);
    assertEqual(result.enabled, true);
});

test('Environment variable support', () => {
    const parser = yaggs();
    parser.option('apiKey', { type: 'string', env: 'API_KEY' });
    
    process.env.API_KEY = 'test-key-from-env';
    const result = parser.parse([]);
    assertEqual(result.apiKey, 'test-key-from-env');
    delete process.env.API_KEY;
});

test('Environment variable overridden by CLI', () => {
    const parser = yaggs();
    parser.option('apiKey', { type: 'string', env: 'API_KEY' });
    
    process.env.API_KEY = 'env-value';
    const result = parser.parse(['--apiKey', 'cli-value']);
    assertEqual(result.apiKey, 'cli-value');
    delete process.env.API_KEY;
});

test('Config file support', () => {
    const fs = require('fs');
    const path = require('path');
    
    const configPath = path.join(__dirname, 'test-config.json');
    fs.writeFileSync(configPath, JSON.stringify({ port: 9000, mode: 'config-mode' }));
    
    const parser = yaggs();
    parser.option('port', { type: 'integer' });
    parser.option('mode', { type: 'string' });
    parser.config(configPath);
    
    const result = parser.parse([]);
    assertEqual(result.port, 9000);
    assertEqual(result.mode, 'config-mode');
    
    fs.unlinkSync(configPath);
});

test('Config file overridden by environment', () => {
    const fs = require('fs');
    const path = require('path');
    
    const configPath = path.join(__dirname, 'test-config.json');
    fs.writeFileSync(configPath, JSON.stringify({ port: 9000 }));
    
    const parser = yaggs();
    parser.option('port', { type: 'integer', env: 'PORT' });
    parser.config(configPath);
    
    process.env.PORT = '8000';
    const result = parser.parse([]);
    assertEqual(result.port, 8000);
    
    fs.unlinkSync(configPath);
    delete process.env.PORT;
});

test('Config file overridden by CLI', () => {
    const fs = require('fs');
    const path = require('path');
    
    const configPath = path.join(__dirname, 'test-config.json');
    fs.writeFileSync(configPath, JSON.stringify({ port: 9000 }));
    
    const parser = yaggs();
    parser.option('port', { type: 'integer' });
    parser.config(configPath);
    
    const result = parser.parse(['--port', '7000']);
    assertEqual(result.port, 7000);
    
    fs.unlinkSync(configPath);
});

test('Command aliases', () => {
    const parser = yaggs();
    parser.command('start', {
        description: 'Start the server',
        aliases: ['s', 'run'],
        handler: (argv) => {}
    });
    
    const result1 = parser.parse(['start']);
    const result2 = parser.parse(['s']);
    const result3 = parser.parse(['run']);
    
    assertEqual(result1.command, 'start');
    assertEqual(result2.command, 'start');
    assertEqual(result3.command, 'start');
});

test('Command groups in help', () => {
    const parser = yaggs({ scriptName: 'myapp' });
    parser.command('start', { 
        description: 'Start server', 
        group: 'Server Commands',
        handler: () => {}
    });
    parser.command('stop', { 
        description: 'Stop server', 
        group: 'Server Commands',
        handler: () => {}
    });
    parser.command('list', { 
        description: 'List items', 
        group: 'Utility Commands',
        handler: () => {}
    });
    
    const help = parser.getHelp();
    assertTruthy(help.includes('Server Commands'));
    assertTruthy(help.includes('Utility Commands'));
    assertTruthy(help.includes('start'));
    assertTruthy(help.includes('stop'));
    assertTruthy(help.includes('list'));
});

test('Command with aliases in help', () => {
    const parser = yaggs();
    parser.command('start', { 
        description: 'Start the server', 
        aliases: ['s', 'run'],
        handler: () => {}
    });
    
    const help = parser.getHelp();
    assertTruthy(help.includes('start'));
    assertTruthy(help.includes('(s, run)'));
});

test('Option conflicts detection', () => {
    const parser = yaggs();
    parser.option('production', { 
        type: 'boolean', 
        conflicts: ['development', 'test'] 
    });
    parser.option('development', { 
        type: 'boolean', 
        conflicts: ['production'] 
    });
    
    const result = parser.parse(['--production', '--development']);
    assertEqual(result.error, "Option 'production' conflicts with 'development'");
});

test('Option implies', () => {
    const parser = yaggs();
    parser.option('production', { 
        type: 'boolean', 
        implies: { logLevel: 'error' } 
    });
    parser.option('logLevel', { type: 'string', default: 'info' });
    
    const result = parser.parse(['--production']);
    assertEqual(result.production, true);
    assertEqual(result.logLevel, 'error');
});

test('Option implies does not override existing', () => {
    const parser = yaggs();
    parser.option('production', { 
        type: 'boolean', 
        implies: { logLevel: 'error' } 
    });
    parser.option('logLevel', { type: 'string' });
    
    const result = parser.parse(['--production', '--logLevel', 'warn']);
    assertEqual(result.production, true);
    assertEqual(result.logLevel, 'warn');
});

test('URL type validation', () => {
    const parser = yaggs();
    parser.option('url', { type: 'url' });
    
    const result = parser.parse(['--url', 'https://example.com']);
    assertEqual(result.url.protocol, 'https:');
    assertEqual(result.url.hostname, 'example.com');
});

test('Email type validation', () => {
    const parser = yaggs();
    parser.option('email', { type: 'email' });
    
    const result = parser.parse(['--email', 'test@example.com']);
    assertEqual(result.email, 'test@example.com');
});

test('IP type validation', () => {
    const parser = yaggs();
    parser.option('ip', { type: 'ip' });
    
    const result = parser.parse(['--ip', '192.168.1.1']);
    assertEqual(result.ip, '192.168.1.1');
});

test('File type validation', () => {
    const fs = require('fs');
    const path = require('path');
    const testFile = path.join(__dirname, 'test-file.txt');
    fs.writeFileSync(testFile, 'test');
    
    const parser = yaggs();
    parser.option('file', { type: 'file' });
    
    const result = parser.parse(['--file', testFile]);
    assertEqual(result.file, path.resolve(testFile));
    
    fs.unlinkSync(testFile);
});

test('Directory type validation', () => {
    const parser = yaggs();
    parser.option('dir', { type: 'directory' });
    
    const result = parser.parse(['--dir', __dirname]);
    assertEqual(result.dir, path.resolve(__dirname));
});

test('Bash completion generation', () => {
    const parser = yaggs({ scriptName: 'myapp' });
    parser.option('port', { type: 'integer', alias: 'p' });
    parser.option('host', { type: 'string' });
    parser.command('start', { description: 'Start server', handler: () => {} });
    parser.command('stop', { description: 'Stop server', handler: () => {} });
    
    const completion = parser.generateCompletion('bash');
    assertTruthy(completion.includes('_myapp_completions'));
    assertTruthy(completion.includes('--port'));
    assertTruthy(completion.includes('-p'));
    assertTruthy(completion.includes('start'));
    assertTruthy(completion.includes('stop'));
});

test('Zsh completion generation', () => {
    const parser = yaggs({ scriptName: 'myapp' });
    parser.option('port', { type: 'integer', description: 'Port number' });
    parser.command('start', { description: 'Start server', handler: () => {} });
    
    const completion = parser.generateCompletion('zsh');
    assertTruthy(completion.includes('#compdef myapp'));
    assertTruthy(completion.includes('--port'));
    assertTruthy(completion.includes('start'));
});

test('Fish completion generation', () => {
    const parser = yaggs({ scriptName: 'myapp' });
    parser.option('port', { type: 'integer', description: 'Port number' });
    parser.command('start', { description: 'Start server', handler: () => {} });
    
    const completion = parser.generateCompletion('fish');
    assertTruthy(completion.includes('#!/usr/bin/env fish'));
    assertTruthy(completion.includes('-l port'));
    assertTruthy(completion.includes('-a "start"'));
});

test('Date type validation', () => {
    const parser = yaggs();
    parser.option('date', { type: 'date' });
    
    const result = parser.parse(['--date', '2026-01-01']);
    assertEqual(result.date.getFullYear(), 2026);
    assertEqual(result.date.getMonth(), 0);
});

test('Regex type validation', () => {
    const parser = yaggs();
    parser.option('pattern', { type: 'regex' });
    
    const result = parser.parse(['--pattern', '^test$']);
    assertTruthy(result.pattern.test('test'));
    assertTruthy(!result.pattern.test('testing'));
});

console.log('\n' + '='.repeat(50));
console.log(`Test Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

if (failed > 0) {
    process.exit(1);
}
