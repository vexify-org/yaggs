# @vexify-org/yaggs

A powerful CLI argument parser for Node.js, designed as a modern alternative to yargs.

## Features

- Deprecation warnings for deprecated options
- Subcommand aliases
- Extended type validators (email, URL, UUID, etc.)
- Default value merge
- Conflict detection
- Exclusive groups
- Interactive prompts
- Zero dependencies

## Installation

```bash
npm install @vexify-org/yaggs
```

## Usage

### Basic Example

```javascript
const yaggs = require('@vexify-org/yaggs');

const argv = yaggs
    .option('name', {
        alias: 'n',
        type: 'string',
        description: 'Your name',
        default: 'World'
    })
    .option('count', {
        alias: 'c',
        type: 'number',
        description: 'Number of times to greet',
        default: 1
    })
    .argv;

console.log(`Hello, ${argv.name}!`.repeat(argv.count));
```

### Commands

```javascript
yaggs
    .command('start [room]', 'Start MineP2P client', (yargs) => {
        yargs.option('room', {
            type: 'string',
            description: 'Room ID to join'
        });
    }, (argv) => {
        console.log('Starting...', argv.room);
    })
    .command('stop', 'Stop MineP2P client', () => {
        console.log('Stopping...');
    })
    .argv;
```

### Type Validators

```javascript
yaggs
    .option('email', {
        type: 'email',
        description: 'Email address'
    })
    .option('url', {
        type: 'url',
        description: 'Website URL'
    })
    .option('uuid', {
        type: 'uuid',
        description: 'UUID'
    })
    .argv;
```

### Deprecation Warnings

```javascript
yaggs
    .option('old-flag', {
        type: 'boolean',
        deprecated: true,
        deprecatedMessage: 'Use --new-flag instead'
    })
    .argv;
```

### Exclusive Groups

```javascript
yaggs
    .option('json', {
        type: 'boolean',
        conflicts: 'yaml'
    })
    .option('yaml', {
        type: 'boolean',
        conflicts: 'json'
    })
    .argv;
```

## API

- `yaggs.option(name, options)` - Define an option
- `yaggs.command(cmd, desc, builder, handler)` - Define a command
- `yaggs.parse(args)` - Parse arguments
- `yaggs.argv` - Get parsed arguments

## Compatibility

- Node.js >= 14.0.0
- Drop-in replacement for yargs in most cases

## License

Apache-2.0 - Copyright (c) Vexify 2026