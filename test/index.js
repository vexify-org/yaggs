const { compile, compileFile, run, requireTs } = require('../index.js');
const fs = require('fs');
const path = require('path');

const tests = [
    {
        name: 'Basic TypeScript compilation',
        run: () => {
            const code = `
                function add(a: number, b: number): number {
                    return a + b;
                }
                const result = add(2, 3);
            `;
            const result = compile(code);
            return !!result.code && result.code.includes('add');
        }
    },
    {
        name: 'Compile TypeScript file',
        run: () => {
            const testFile = path.join(__dirname, 'test.ts');
            const result = compileFile(testFile);
            return !!result.code && result.code.includes('Hello');
        }
    },
    {
        name: 'Require TypeScript module',
        run: () => {
            const testFile = path.join(__dirname, 'test.ts');
            const mod = requireTs(testFile);
            return mod.greet && typeof mod.greet === 'function' && mod.greet('Test') === 'Hello, Test!';
        }
    },
    {
        name: 'TypeScript with interfaces',
        run: () => {
            const code = `
                interface Person {
                    name: string;
                    age: number;
                }
                const person: Person = { name: 'John', age: 30 };
                export const name = person.name;
            `;
            const result = compile(code);
            return !!result.code;
        }
    },
    {
        name: 'TypeScript with generics',
        run: () => {
            const code = `
                function identity<T>(arg: T): T {
                    return arg;
                }
                const result = identity<string>('hello');
            `;
            const result = compile(code);
            return !!result.code && result.code.includes('hello');
        }
    },
    {
        name: 'Async/await support',
        run: () => {
            const code = `
                async function fetchData(): Promise<string> {
                    return 'data';
                }
                fetchData().then(console.log);
            `;
            const result = compile(code);
            return !!result.code && result.code.includes('fetchData');
        }
    },
    {
        name: 'Error handling - file not found',
        run: () => {
            try {
                compileFile('/non/existent/file.ts');
                return false;
            } catch (error) {
                return error.message.includes('not found');
            }
        }
    }
];

let passed = 0;
let failed = 0;

console.log('Running tsdk-cli tests...\n');

for (const test of tests) {
    try {
        const result = test.run();
        if (result) {
            console.log(`\u2713 ${test.name}`);
            passed++;
        } else {
            console.log(`\u2717 ${test.name}`);
            console.log(`   Result: ${result}`);
            failed++;
        }
    } catch (error) {
        console.log(`\u2717 ${test.name}`);
        console.log(`   Error: ${error.message}`);
        failed++;
    }
}

console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
    process.exit(1);
}
