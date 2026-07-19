class ArgumentParser {
    constructor(options = {}) {
        this.options = {};
        this.commands = {};
        this._positional = [];
        this.aliases = {};
        this.defaults = {};
        this.validation = {};
        this.globalOptions = {};
        this.version = options.version || '1.0.0';
        this.description = options.description || '';
        this.scriptName = options.scriptName || process.argv[1] || 'yaggs';
        this.helpFunction = options.helpFunction || null;
        this.errorHandler = options.errorHandler || null;
        this.configFile = options.configFile || null;
        this.config = {};
        this.deprecatedCommands = {};
        this.subCommandAliases = {};
    }

    option(name, config) {
        if (typeof name === 'object') {
            for (const [key, value] of Object.entries(name)) {
                this.option(key, value);
            }
            return this;
        }

        const optionName = name.toLowerCase();
        const isBoolean = config.boolean || config.type === 'boolean';
        this.options[optionName] = {
            type: config.type || 'string',
            description: config.description || '',
            alias: config.alias || [],
            default: config.default,
            requiresArg: config.requiresArg !== undefined ? config.requiresArg : !isBoolean,
            boolean: isBoolean,
            array: config.array || false,
            nargs: config.nargs,
            choices: config.choices,
            demandOption: config.demandOption || config.required || false,
            normalize: config.normalize,
            hidden: config.hidden || false,
            conflicts: config.conflicts || [],
            implies: config.implies || {},
            global: config.global !== undefined ? config.global : true,
            ...config
        };

        if (config.alias) {
            const aliases = Array.isArray(config.alias) ? config.alias : [config.alias];
            for (const alias of aliases) {
                this.aliases[alias.toLowerCase()] = optionName;
            }
        }

        if (config.default !== undefined) {
            this.defaults[optionName] = config.default;
        }

        if (config.validate || config.check) {
            this.validation[optionName] = config.validate || config.check;
        }

        return this;
    }

    positional(name, config) {
        this._positional.push({
            name,
            type: config.type || 'string',
            description: config.description || '',
            demandOption: config.demandOption || config.required || false,
            choices: config.choices,
            default: config.default,
            normalize: config.normalize,
            ...config
        });
        return this;
    }

    command(name, config) {
        if (typeof name === 'object') {
            for (const [key, value] of Object.entries(name)) {
                this.command(key, value);
            }
            return this;
        }

        this.commands[name] = {
            description: config.description || '',
            builder: config.builder || null,
            handler: config.handler || null,
            aliases: config.aliases || [],
            hidden: config.hidden || false,
            strict: config.strict || false,
            group: config.group || 'Commands',
            deprecated: config.deprecated || false,
            deprecationMessage: config.deprecationMessage || '',
            ...config
        };

        if (config.deprecated) {
            this.deprecatedCommands[name] = config.deprecationMessage;
        }

        if (config.aliases) {
            const aliases = Array.isArray(config.aliases) ? config.aliases : [config.aliases];
            for (const alias of aliases) {
                this.subCommandAliases[alias] = name;
            }
        }

        return this;
    }

    deprecateCommand(name, message) {
        if (this.commands[name]) {
            this.commands[name].deprecated = true;
            this.commands[name].deprecationMessage = message;
            this.deprecatedCommands[name] = message;
        }
        return this;
    }

    loadConfig(filePath) {
        const fs = require('fs');
        const path = require('path');
        
        try {
            const fullPath = path.resolve(filePath);
            if (!fs.existsSync(fullPath)) {
                return this;
            }
            
            const ext = path.extname(filePath).toLowerCase();
            if (ext === '.json') {
                this.config = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            } else if (ext === '.js') {
                this.config = require(fullPath);
            }
            
            return this;
        } catch (error) {
            this._handleError(`Failed to load config file: ${error.message}`);
            return this;
        }
    }

    parse(argv = process.argv.slice(2)) {
        const result = {
            _: [],
            $0: this.scriptName,
            argv: argv
        };

        let currentCommand = null;
        let commandChain = [];
        let inOption = null;
        let optionAccumulator = [];
        let positionalIndex = 0;

        for (let i = 0; i < argv.length; i++) {
            const arg = argv[i];
            if (!currentCommand && !arg.startsWith('-') && this.commands[arg]) {
                currentCommand = arg;
                commandChain.push(arg);
                
                const cmd = this.commands[currentCommand];
                if (cmd.builder && typeof cmd.builder === 'function') {
                    const subParser = new ArgumentParser();
                    cmd.builder(subParser);
                    for (const [key, value] of Object.entries(subParser.options)) {
                        if (!this.options[key]) {
                            this.options[key] = value;
                            if (value.default !== undefined) {
                                this.defaults[key] = value.default;
                            }
                            if (value.alias) {
                                const aliases = Array.isArray(value.alias) ? value.alias : [value.alias];
                                for (const alias of aliases) {
                                    this.aliases[alias.toLowerCase()] = key;
                                }
                            }
                        }
                    }
                }
            }
        }

        for (let i = 0; i < argv.length; i++) {
            const arg = argv[i];

            if (inOption) {
                if (arg.startsWith('-') || this.commands[arg] || this._resolveCommandAlias(arg)) {
                    this._assignOption(result, inOption, optionAccumulator);
                    inOption = null;
                    optionAccumulator = [];
                } else {
                    optionAccumulator.push(arg);
                    if (!this.options[inOption].array && (!this.options[inOption].nargs || optionAccumulator.length >= this.options[inOption].nargs)) {
                        this._assignOption(result, inOption, optionAccumulator);
                        inOption = null;
                        optionAccumulator = [];
                    }
                    continue;
                }
            }

            if (arg === '--') {
                result._.push(...argv.slice(i + 1));
                break;
            }

            if (arg.startsWith('--')) {
                const optionName = arg.slice(2);
                const resolvedName = this.aliases[optionName] || optionName;

                if (this.options[resolvedName]) {
                    const opt = this.options[resolvedName];
                    if (opt.boolean && !opt.requiresArg) {
                        result[resolvedName] = true;
                    } else if (opt.boolean && opt.requiresArg) {
                        if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
                            this._assignOption(result, resolvedName, [argv[i + 1]]);
                            i++;
                        } else {
                            result[resolvedName] = true;
                        }
                    } else if (opt.array) {
                        inOption = resolvedName;
                    } else {
                        if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
                            this._assignOption(result, resolvedName, [argv[i + 1]]);
                            i++;
                        } else {
                            this._handleError(`Option '--${optionName}' requires an argument`);
                        }
                    }
                } else {
                    const [name, value] = optionName.split('=');
                    const resolvedNameEq = this.aliases[name] || name;
                    if (value !== undefined) {
                        this._assignOption(result, resolvedNameEq, [value]);
                    } else if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
                        result[resolvedNameEq] = argv[i + 1];
                        i++;
                    } else {
                        result[resolvedNameEq] = true;
                    }
                }
            } else if (arg.startsWith('-')) {
                const options = arg.slice(1);
                for (let j = 0; j < options.length; j++) {
                    const optChar = options[j];
                    const resolvedName = this.aliases[optChar] || optChar;

                    if (this.options[resolvedName]) {
                        const opt = this.options[resolvedName];
                        if (opt.boolean && !opt.requiresArg) {
                            result[resolvedName] = true;
                        } else if (opt.boolean && opt.requiresArg) {
                            const remaining = options.slice(j + 1);
                            if (remaining) {
                                this._assignOption(result, resolvedName, [remaining]);
                                break;
                            } else if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
                                this._assignOption(result, resolvedName, [argv[i + 1]]);
                                i++;
                                break;
                            } else {
                                result[resolvedName] = true;
                            }
                        } else {
                            const remaining = options.slice(j + 1);
                            if (remaining) {
                                this._assignOption(result, resolvedName, [remaining]);
                                break;
                            } else if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
                                this._assignOption(result, resolvedName, [argv[i + 1]]);
                                i++;
                                break;
                            } else {
                                this._handleError(`Option '-${optChar}' requires an argument`);
                            }
                        }
                    } else {
                        result[resolvedName] = true;
                    }
                }
            } else {
                if (!currentCommand && (this.commands[arg] || this._resolveCommandAlias(arg))) {
                    const resolvedCommand = this._resolveCommandAlias(arg) || arg;
                    currentCommand = resolvedCommand;
                    commandChain.push(resolvedCommand);
                } else if (currentCommand && (this.commands[arg] || this._resolveCommandAlias(arg))) {
                    // 跳过已识别的命令名，避免被当作 positional 参数
                    continue;
                } else {
                    result._.push(arg);
                }
            }
        }

        if (inOption) {
            this._assignOption(result, inOption, optionAccumulator);
        }

        if (currentCommand && this.commands[currentCommand]) {
            const cmd = this.commands[currentCommand];
            if (cmd.builder && typeof cmd.builder === 'function') {
                const subParser = new ArgumentParser();
                cmd.builder(subParser);
                for (const [key, value] of Object.entries(subParser.options)) {
                    if (!this.options[key]) {
                        this.options[key] = value;
                        if (value.default !== undefined) {
                            this.defaults[key] = value.default;
                        }
                        if (value.alias) {
                            const aliases = Array.isArray(value.alias) ? value.alias : [value.alias];
                            for (const alias of aliases) {
                                this.aliases[alias.toLowerCase()] = key;
                            }
                        }
                    }
                }
            }
        }

        for (const [key, value] of Object.entries(this.defaults)) {
            if (result[key] === undefined) {
                result[key] = typeof value === 'function' ? value() : value;
            } else if (typeof result[key] === 'object' && typeof value === 'object') {
                result[key] = this._deepMerge(value, result[key]);
            }
        }

        for (const [key, value] of Object.entries(this.config)) {
            if (result[key] === undefined) {
                result[key] = value;
            } else if (typeof result[key] === 'object' && typeof value === 'object') {
                result[key] = this._deepMerge(value, result[key]);
            }
        }

        for (const [name, opt] of Object.entries(this.options)) {
            if (result[name] === undefined && opt.default !== undefined) {
                result[name] = typeof opt.default === 'function' ? opt.default() : opt.default;
            }
        }

        this._applyTypeConversion(result);
        this._validateOptions(result);
        this._validatePositionals(result);
        this._validateConflicts(result);
        this._applyImplies(result);

        if (currentCommand && this.commands[currentCommand]) {
            this._checkDeprecation(currentCommand);
            result.command = currentCommand;
            result.commandChain = commandChain;
        }

        return result;
    }

    _assignOption(result, name, values) {
        const opt = this.options[name];
        
        if (!opt) {
            result[name] = values[0];
            return;
        }
        
        if (opt.env && !result[name]) {
            const envValue = process.env[opt.env];
            if (envValue !== undefined) {
                result[name] = envValue;
            }
        }
        
        if (opt.array) {
            if (!result[name]) result[name] = [];
            result[name].push(...values);
        } else {
            result[name] = values[0];
        }
    }

    _applyTypeConversion(result) {
        for (const [name, value] of Object.entries(result)) {
            if (name === '_' || name === '$0' || name === 'argv' || name === 'command' || name === 'commandChain') continue;
            
            const opt = this.options[name];
            if (!opt) continue;

            if (opt.type === 'number') {
                if (opt.array) {
                    result[name] = Array.isArray(value) ? value.map(v => parseFloat(v)) : [parseFloat(value)];
                } else {
                    result[name] = parseFloat(value);
                }
            } else if (opt.type === 'integer') {
                if (opt.array) {
                    result[name] = Array.isArray(value) ? value.map(v => parseInt(v, 10)) : [parseInt(value, 10)];
                } else {
                    result[name] = parseInt(value, 10);
                }
            } else if (opt.type === 'boolean') {
                if (typeof value === 'string') {
                    result[name] = ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
                }
            } else if (opt.type === 'json') {
                try {
                    result[name] = JSON.parse(value);
                } catch {
                    this._handleError(`Invalid JSON for option '${name}'`);
                }
            } else if (opt.type === 'url') {
                try {
                    result[name] = new URL(value);
                } catch {
                    this._handleError(`Invalid URL for option '${name}'`);
                }
            } else if (opt.type === 'email') {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                    this._handleError(`Invalid email for option '${name}'`);
                }
            } else if (opt.type === 'ip') {
                const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
                if (!ipRegex.test(value)) {
                    this._handleError(`Invalid IP address for option '${name}'`);
                }
            } else if (opt.type === 'file') {
                const fs = require('fs');
                const path = require('path');
                const fullPath = path.resolve(value);
                if (!fs.existsSync(fullPath)) {
                    this._handleError(`File not found: ${fullPath}`);
                }
                result[name] = fullPath;
            } else if (opt.type === 'directory') {
                const fs = require('fs');
                const path = require('path');
                const fullPath = path.resolve(value);
                if (!fs.existsSync(fullPath)) {
                    this._handleError(`Directory not found: ${fullPath}`);
                }
                if (!fs.statSync(fullPath).isDirectory()) {
                    this._handleError(`Not a directory: ${fullPath}`);
                }
                result[name] = fullPath;
            } else if (opt.type === 'date') {
                const date = new Date(value);
                if (isNaN(date.getTime())) {
                    this._handleError(`Invalid date for option '${name}'`);
                }
                result[name] = date;
            } else if (opt.type === 'regex') {
                try {
                    result[name] = new RegExp(value);
                } catch {
                    this._handleError(`Invalid regex for option '${name}'`);
                }
            } else if (opt.type === 'hostname') {
                const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
                if (!hostnameRegex.test(value)) {
                    this._handleError(`Invalid hostname for option '${name}'`);
                }
            } else if (opt.type === 'port') {
                const port = parseInt(value, 10);
                if (isNaN(port) || port < 1 || port > 65535) {
                    this._handleError(`Invalid port for option '${name}'. Must be between 1 and 65535`);
                }
                result[name] = port;
            } else if (opt.type === 'path') {
                const fs = require('fs');
                const path = require('path');
                const fullPath = path.resolve(value);
                if (!fs.existsSync(path.dirname(fullPath))) {
                    this._handleError(`Directory not found for path: ${fullPath}`);
                }
                result[name] = fullPath;
            } else if (opt.type === 'hex') {
                const hexRegex = /^[0-9a-fA-F]+$/;
                if (!hexRegex.test(value)) {
                    this._handleError(`Invalid hex value for option '${name}'`);
                }
            } else if (opt.type === 'base64') {
                try {
                    Buffer.from(value, 'base64');
                } catch {
                    this._handleError(`Invalid base64 for option '${name}'`);
                }
            } else if (opt.type === 'uuid') {
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (!uuidRegex.test(value)) {
                    this._handleError(`Invalid UUID for option '${name}'`);
                }
            } else if (opt.type === 'semver') {
                const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?(\+[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?$/;
                if (!semverRegex.test(value)) {
                    this._handleError(`Invalid semver for option '${name}'`);
                }
            } else if (opt.type === 'urlencoded') {
                try {
                    decodeURIComponent(value);
                } catch {
                    this._handleError(`Invalid URL encoded value for option '${name}'`);
                }
            } else if (opt.type === 'mac') {
                const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
                if (!macRegex.test(value)) {
                    this._handleError(`Invalid MAC address for option '${name}'`);
                }
            } else if (opt.type === 'cidr') {
                const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
                if (!cidrRegex.test(value)) {
                    this._handleError(`Invalid CIDR for option '${name}'`);
                }
            } else if (opt.type === 'unix') {
                const fs = require('fs');
                if (!fs.existsSync(value)) {
                    this._handleError(`Unix socket not found: ${value}`);
                }
                result[name] = value;
            } else if (opt.type === 'custom' && opt._customType) {
                result[name] = opt._customType(value);
            }
        }
    }

    _validateOptions(result) {
        for (const [name, opt] of Object.entries(this.options)) {
            if (opt.demandOption && result[name] === undefined) {
                this._handleError(`Missing required option: --${name}`);
            }

            if (opt.choices && result[name] !== undefined) {
                const values = opt.array ? result[name] : [result[name]];
                for (const value of values) {
                    if (!opt.choices.includes(value)) {
                        this._handleError(`Invalid choice for '${name}': ${value}. Must be one of: ${opt.choices.join(', ')}`);
                    }
                }
            }

            if (this.validation[name] && result[name] !== undefined) {
                const valid = this.validation[name](result[name]);
                if (!valid) {
                    this._handleError(`Validation failed for option '${name}'`);
                }
            }

            if (opt.min !== undefined && typeof result[name] === 'number' && result[name] < opt.min) {
                this._handleError(`Option '${name}' must be at least ${opt.min}`);
            }

            if (opt.max !== undefined && typeof result[name] === 'number' && result[name] > opt.max) {
                this._handleError(`Option '${name}' must be at most ${opt.max}`);
            }
        }
    }

    _validatePositionals(result) {
        const positionals = [...result._];
        result._ = [];
        
        for (let i = 0; i < this._positional.length; i++) {
            const pos = this._positional[i];
            if (i >= positionals.length) {
                if (pos.demandOption) {
                    this._handleError(`Missing required argument: ${pos.name}`);
                }
                if (pos.default !== undefined) {
                    result[pos.name] = pos.default;
                }
            } else {
                let value = positionals[i];
                
                if (pos.type === 'number') {
                    value = parseFloat(value);
                } else if (pos.type === 'integer') {
                    value = parseInt(value, 10);
                } else if (pos.type === 'boolean') {
                    value = ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
                } else if (pos.type === 'json') {
                    try {
                        value = JSON.parse(value);
                    } catch {
                        this._handleError(`Invalid JSON for argument '${pos.name}'`);
                    }
                }

                if (pos.choices && !pos.choices.includes(value)) {
                    this._handleError(`Invalid choice for '${pos.name}': ${value}. Must be one of: ${pos.choices.join(', ')}`);
                }

                result[pos.name] = value;
            }
        }

        for (let i = this._positional.length; i < positionals.length; i++) {
            result._.push(positionals[i]);
        }
    }

    _validateConflicts(result) {
        for (const [name, opt] of Object.entries(this.options)) {
            if (result[name] !== undefined && opt.conflicts && opt.conflicts.length > 0) {
                for (const conflict of opt.conflicts) {
                    if (result[conflict] !== undefined) {
                        this._handleError(`Option '${name}' conflicts with '${conflict}'`);
                    }
                }
            }
        }

        for (const [name, opt] of Object.entries(this.options)) {
            if (opt.exclusiveGroup) {
                const groupMembers = Object.entries(this.options)
                    .filter(([, o]) => o.exclusiveGroup === opt.exclusiveGroup)
                    .map(([n]) => n);
                
                const setMembers = groupMembers.filter(n => result[n] !== undefined);
                
                if (setMembers.length > 1) {
                    this._handleError(`Options '${setMembers.join(', ')}' are mutually exclusive`);
                }
            }
        }
    }

    _deepMerge(target, source) {
        const result = { ...target };
        for (const [key, value] of Object.entries(source)) {
            if (typeof target[key] === 'object' && typeof value === 'object') {
                result[key] = this._deepMerge(target[key], value);
            } else {
                result[key] = value;
            }
        }
        return result;
    }

    async _promptForMissing(options) {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const prompt = (question, defaultValue) => {
            return new Promise((resolve) => {
                const displayQuestion = defaultValue !== undefined 
                    ? `${question} (${defaultValue}): ` 
                    : `${question}: `;
                rl.question(displayQuestion, (answer) => {
                    resolve(answer || defaultValue);
                });
            });
        };

        for (const [name, opt] of Object.entries(options)) {
            if (opt.prompt && options[name] === undefined) {
                const value = await prompt(opt.promptMessage || `Enter ${name}`, opt.default);
                options[name] = value;
            }
        }

        rl.close();
        return options;
    }

    _applyImplies(result) {
        for (const [name, opt] of Object.entries(this.options)) {
            if (result[name] !== undefined && Object.keys(opt.implies).length > 0) {
                for (const [impliedName, impliedValue] of Object.entries(opt.implies)) {
                    if (result[impliedName] === undefined) {
                        result[impliedName] = impliedValue;
                    }
                }
            }
        }
    }

    _handleError(message) {
        if (this.errorHandler) {
            this.errorHandler(message);
        } else {
            console.error(`\u001b[31mError:\u001b[0m ${message}`);
            process.exit(1);
        }
    }

    _resolveCommandAlias(arg) {
        if (this.subCommandAliases[arg]) {
            return this.subCommandAliases[arg];
        }
        for (const [name, cmd] of Object.entries(this.commands)) {
            if (cmd.aliases && cmd.aliases.includes(arg)) {
                return name;
            }
        }
        return null;
    }

    _checkDeprecation(commandName) {
        const cmd = this.commands[commandName];
        if (cmd && cmd.deprecated) {
            const message = cmd.deprecationMessage || `Command '${commandName}' is deprecated`;
            console.warn(`\u001b[33m[DEPRECATED] ${message}\u001b[0m`);
        }
    }

    generateCompletion(shell = 'bash') {
        if (shell === 'bash') {
            return this._generateBashCompletion();
        } else if (shell === 'zsh') {
            return this._generateZshCompletion();
        } else if (shell === 'fish') {
            return this._generateFishCompletion();
        }
        return '';
    }

    _generateBashCompletion() {
        let completion = `#!/usr/bin/env bash

_${this.scriptName}_completions() {
    local cur prev opts
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
    
    opts=""
    
    OPTIONS="`;
        
        for (const [name, opt] of Object.entries(this.options)) {
            if (!opt.hidden) {
                completion += `--${name} `;
                if (opt.alias && opt.alias.length > 0) {
                    const aliases = Array.isArray(opt.alias) ? opt.alias : [opt.alias];
                    for (const alias of aliases) {
                        completion += `-${alias} `;
                    }
                }
            }
        }
        
        completion += `"
    
    COMMANDS="`;
    
        for (const [name, cmd] of Object.entries(this.commands)) {
            if (!cmd.hidden) {
                completion += `${name} `;
                if (cmd.aliases) {
                    completion += `${cmd.aliases.join(' ')} `;
                }
            }
        }
        
        completion += `"
    
    if [[ "\${cur}" == -* ]]; then
        COMPREPLY=( \$(compgen -W "\${OPTIONS}" -- "\${cur}") )
    else
        COMPREPLY=( \$(compgen -W "\${COMMANDS}" -- "\${cur}") )
    fi
    
    return 0
}

complete -F _${this.scriptName}_completions ${this.scriptName}
`;
        
        return completion;
    }

    _generateZshCompletion() {
        let completion = `#compdef ${this.scriptName}

local commands options

commands=('`;
        
        for (const [name, cmd] of Object.entries(this.commands)) {
            if (!cmd.hidden) {
                completion += `${name}:${cmd.description} `;
            }
        }
        
        completion += `')

options=('`;
        
        for (const [name, opt] of Object.entries(this.options)) {
            if (!opt.hidden) {
                completion += `--${name}[${opt.description}]:`;
                if (opt.choices) {
                    completion += ':(' + opt.choices.join(' ') + ') ';
                } else {
                    completion += ' ';
                }
                if (opt.alias && opt.alias.length > 0) {
                    const aliases = Array.isArray(opt.alias) ? opt.alias : [opt.alias];
                    for (const alias of aliases) {
                        completion += `-${alias}[${opt.description}]: `;
                    }
                }
            }
        }
        
        completion += `')

_arguments \${options[@]} \\
    '1:command:\${commands}' \\
    '*::args:_normal'
`;
        
        return completion;
    }

    _generateFishCompletion() {
        let completion = `#!/usr/bin/env fish

complete -c ${this.scriptName} `;
        
        for (const [name, opt] of Object.entries(this.options)) {
            if (!opt.hidden) {
                completion += `-l ${name} -d "${opt.description}" `;
                if (opt.alias && opt.alias.length > 0) {
                    const aliases = Array.isArray(opt.alias) ? opt.alias : [opt.alias];
                    for (const alias of aliases) {
                        completion += `-s ${alias} `;
                    }
                }
            }
        }
        
        completion += '\n\n';
        
        for (const [name, cmd] of Object.entries(this.commands)) {
            if (!cmd.hidden) {
                completion += `complete -c ${this.scriptName} -a "${name}" -d "${cmd.description}"\n`;
            }
        }
        
        return completion;
    }

    async checkVersion(packageName, currentVersion) {
        try {
            const https = require('https');
            return new Promise((resolve) => {
                https.get(`https://registry.npmjs.org/${packageName}/latest`, (res) => {
                    let data = '';
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => {
                        try {
                            const latest = JSON.parse(data);
                            if (latest.version && latest.version !== currentVersion) {
                                console.log(`\u001b[33mUpdate available: ${packageName} ${currentVersion} → ${latest.version}\u001b[0m`);
                                console.log(`\u001b[36mRun: npm install -g ${packageName}\u001b[0m`);
                            }
                            resolve(latest.version);
                        } catch {
                            resolve(null);
                        }
                    });
                }).on('error', () => {
                    resolve(null);
                });
            });
        } catch {
            return null;
        }
    }

    async prompt(questions) {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const answers = {};

        for (const question of questions) {
            const answer = await new Promise((resolve) => {
                const defaultVal = question.default !== undefined ? ` (${question.default})` : '';
                const choices = question.choices ? ` [${question.choices.join('/')}]` : '';
                const required = question.required ? '*' : '';
                
                rl.question(`\u001b[34m${question.name}${required}${choices}${defaultVal}:\u001b[0m `, (input) => {
                    const value = input.trim() || question.default;
                    
                    if (question.required && !value) {
                        console.log('\u001b[31mThis field is required!\u001b[0m');
                        rl.emit('close');
                        resolve(null);
                        return;
                    }
                    
                    if (question.choices && value && !question.choices.includes(value)) {
                        console.log(`\u001b[31mInvalid choice. Must be one of: ${question.choices.join(', ')}\u001b[0m`);
                        rl.emit('close');
                        resolve(null);
                        return;
                    }
                    
                    if (question.type === 'number') {
                        resolve(parseFloat(value));
                    } else if (question.type === 'integer') {
                        resolve(parseInt(value, 10));
                    } else if (question.type === 'boolean') {
                        resolve(['true', '1', 'yes', 'y'].includes(value.toLowerCase()));
                    } else {
                        resolve(value);
                    }
                });
            });

            if (answer === null) {
                rl.close();
                return null;
            }

            answers[question.name] = answer;
        }

        rl.close();
        return answers;
    }

    progress(percentage, message = '') {
        const barLength = 40;
        const filled = Math.round(barLength * percentage / 100);
        const empty = barLength - filled;
        
        const bar = '\u001b[32m' + '█'.repeat(filled) + '\u001b[0m' + '░'.repeat(empty);
        const percent = percentage.toFixed(1);
        
        process.stdout.write(`\r${bar} ${percent}% ${message}`);
        
        if (percentage >= 100) {
            process.stdout.write('\n');
        }
    }

    table(data, options = {}) {
        if (!data || data.length === 0) {
            console.log('No data to display');
            return;
        }

        const headers = Object.keys(data[0]);
        const columnWidths = {};

        for (const header of headers) {
            const maxLen = Math.max(
                header.length,
                ...data.map(row => String(row[header] || '').length)
            );
            columnWidths[header] = maxLen + 2;
        }

        const border = '─'.repeat(Object.values(columnWidths).reduce((a, b) => a + b, 0) + headers.length + 1);
        
        console.log('\u001b[36m' + border + '\u001b[0m');
        
        let headerRow = '│ ';
        for (const header of headers) {
            headerRow += header.padEnd(columnWidths[header]) + '│ ';
        }
        console.log('\u001b[35m' + headerRow + '\u001b[0m');
        
        console.log('\u001b[36m' + border + '\u001b[0m');
        
        for (const row of data) {
            let rowStr = '│ ';
            for (const header of headers) {
                rowStr += String(row[header] || '').padEnd(columnWidths[header]) + '│ ';
            }
            console.log(rowStr);
        }
        
        console.log('\u001b[36m' + border + '\u001b[0m');
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        
        switch (level) {
            case 'error':
                console.error(`\u001b[31m[${timestamp}] [ERROR] ${message}\u001b[0m`);
                break;
            case 'warn':
                console.warn(`\u001b[33m[${timestamp}] [WARN] ${message}\u001b[0m`);
                break;
            case 'debug':
                console.log(`\u001b[34m[${timestamp}] [DEBUG] ${message}\u001b[0m`);
                break;
            case 'success':
                console.log(`\u001b[32m[${timestamp}] [SUCCESS] ${message}\u001b[0m`);
                break;
            default:
                console.log(`\u001b[37m[${timestamp}] [INFO] ${message}\u001b[0m`);
        }
    }

    error(message) {
        this.log(message, 'error');
    }

    warn(message) {
        this.log(message, 'warn');
    }

    debug(message) {
        this.log(message, 'debug');
    }

    success(message) {
        this.log(message, 'success');
    }

    countdown(seconds, message = 'Countdown') {
        let remaining = seconds;
        
        return new Promise((resolve) => {
            const timer = setInterval(() => {
                process.stdout.write(`\r\u001b[33m${message}: ${remaining} seconds remaining...\u001b[0m`);
                
                remaining--;
                
                if (remaining <= 0) {
                    clearInterval(timer);
                    process.stdout.write('\n');
                    resolve();
                }
            }, 1000);
        });
    }

    async ask(question, options = {}) {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            const choices = options.choices ? ` [${options.choices.join('/')}]` : '';
            const defaultValue = options.default !== undefined ? ` (default: ${options.default})` : '';
            const required = options.required ? '*' : '';
            
            rl.question(`\u001b[34m${question}${required}${choices}${defaultValue}:\u001b[0m `, (input) => {
                let value = input.trim() || options.default;
                
                if (options.required && !value) {
                    console.log('\u001b[31mThis field is required!\u001b[0m');
                    rl.close();
                    resolve(null);
                    return;
                }
                
                if (options.choices && value && !options.choices.includes(value)) {
                    console.log(`\u001b[31mInvalid choice. Must be one of: ${options.choices.join(', ')}\u001b[0m`);
                    rl.close();
                    resolve(null);
                    return;
                }
                
                if (options.type === 'number') {
                    value = parseFloat(value);
                } else if (options.type === 'integer') {
                    value = parseInt(value, 10);
                } else if (options.type === 'boolean') {
                    value = ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
                }
                
                rl.close();
                resolve(value);
            });
        });
    }

    spinner(message = 'Loading') {
        const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        let frameIndex = 0;
        let interval;
        
        const start = () => {
            interval = setInterval(() => {
                process.stdout.write(`\r\u001b[34m${frames[frameIndex]} ${message}\u001b[0m`);
                frameIndex = (frameIndex + 1) % frames.length;
            }, 80);
        };
        
        const stop = (finalMessage = '') => {
            clearInterval(interval);
            if (finalMessage) {
                process.stdout.write(`\r\u001b[32m✓ ${finalMessage}\u001b[0m\n`);
            } else {
                process.stdout.write('\r');
            }
        };
        
        start();
        
        return { stop };
    }

    async confirm(message, options = {}) {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            const defaultValue = options.default !== undefined ? (options.default ? 'Y/n' : 'y/N') : 'y/N';
            
            rl.question(`\u001b[33m${message} [${defaultValue}]:\u001b[0m `, (input) => {
                const answer = input.trim().toLowerCase();
                
                let result;
                if (answer === '') {
                    result = options.default !== undefined ? options.default : false;
                } else {
                    result = ['yes', 'y', 'true', '1'].includes(answer);
                }
                
                rl.close();
                resolve(result);
            });
        });
    }

    async select(options, question = 'Select an option') {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            console.log(`\u001b[34m${question}:\u001b[0m`);
            
            options.forEach((opt, index) => {
                const display = typeof opt === 'object' ? opt.value : opt;
                const description = typeof opt === 'object' && opt.description ? ` - ${opt.description}` : '';
                console.log(`  ${index + 1}. ${display}${description}`);
            });
            
            rl.question('\u001b[34mEnter your choice:\u001b[0m ', (input) => {
                const choice = parseInt(input.trim(), 10);
                
                if (isNaN(choice) || choice < 1 || choice > options.length) {
                    console.log('\u001b[31mInvalid choice!\u001b[0m');
                    rl.close();
                    resolve(null);
                    return;
                }
                
                const selected = options[choice - 1];
                const result = typeof selected === 'object' ? selected.value : selected;
                
                rl.close();
                resolve(result);
            });
        });
    }

    async password(message = 'Enter password') {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true
        });

        return new Promise((resolve) => {
            const stdin = process.stdin;
            const stdout = process.stdout;
            
            stdin.setRawMode(true);
            
            let password = '';
            
            stdout.write(`\u001b[34m${message}:\u001b[0m `);
            
            const onData = (data) => {
                const char = data.toString('utf8');
                
                if (char === '\n' || char === '\r') {
                    stdin.setRawMode(false);
                    stdout.write('\n');
                    stdin.removeListener('data', onData);
                    rl.close();
                    resolve(password);
                } else if (char === '\u0008' || char === '\u007f') {
                    if (password.length > 0) {
                        password = password.slice(0, -1);
                        stdout.write('\u0008 \u0008');
                    }
                } else if (char.charCodeAt(0) === 3) {
                    process.exit(1);
                } else {
                    password += char;
                    stdout.write('*');
                }
            };
            
            stdin.on('data', onData);
        });
    }

    async http(url, options = {}) {
        const https = require('https');
        const http = require('http');
        
        const protocol = url.startsWith('https') ? https : http;
        const method = options.method || 'GET';
        const headers = options.headers || {};
        const body = options.body ? JSON.stringify(options.body) : null;
        
        if (body && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }
        if (body && !headers['Content-Length']) {
            headers['Content-Length'] = Buffer.byteLength(body);
        }
        
        return new Promise((resolve, reject) => {
            const req = protocol.request(url, { method, headers }, (res) => {
                let data = '';
                
                res.on('data', (chunk) => { data += chunk; });
                
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
                    } catch {
                        resolve({ status: res.statusCode, headers: res.headers, body: data });
                    }
                });
            });
            
            req.on('error', reject);
            
            if (body) {
                req.write(body);
            }
            
            req.end();
        });
    }

    file(path, options = {}) {
        const fs = require('fs');
        const pathMod = require('path');
        
        return {
            read: () => {
                const encoding = options.encoding || 'utf8';
                return fs.readFileSync(path, encoding);
            },
            readJson: () => {
                const content = fs.readFileSync(path, 'utf8');
                return JSON.parse(content);
            },
            write: (content) => {
                const encoding = options.encoding || 'utf8';
                return fs.writeFileSync(path, content, encoding);
            },
            writeJson: (content, space = 2) => {
                const json = JSON.stringify(content, null, space);
                return fs.writeFileSync(path, json, 'utf8');
            },
            exists: () => fs.existsSync(path),
            mkdir: () => fs.mkdirSync(path, { recursive: true }),
            rm: () => fs.unlinkSync(path),
            stat: () => fs.statSync(path),
            dirname: () => pathMod.dirname(path),
            basename: () => pathMod.basename(path),
            extname: () => pathMod.extname(path),
            resolve: () => pathMod.resolve(path)
        };
    }

    template(str, data = {}) {
        return str.replace(/{{([^}]+)}}/g, (match, key) => {
            const keys = key.trim().split('.');
            let value = data;
            
            for (const k of keys) {
                if (value && typeof value === 'object') {
                    value = value[k];
                } else {
                    value = undefined;
                    break;
                }
            }
            
            return value !== undefined ? value : match;
        });
    }

    formatDate(date = new Date(), format = 'YYYY-MM-DD HH:mm:ss') {
        const d = typeof date === 'string' ? new Date(date) : date;
        
        const pad = (n) => n.toString().padStart(2, '0');
        
        const replacements = {
            YYYY: d.getFullYear(),
            MM: pad(d.getMonth() + 1),
            DD: pad(d.getDate()),
            HH: pad(d.getHours()),
            mm: pad(d.getMinutes()),
            ss: pad(d.getSeconds()),
            ms: d.getMilliseconds().toString().padStart(3, '0'),
            YYYYMMDD: `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`,
            HHmmss: `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`,
            day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()],
            month: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getMonth()],
            timestamp: Math.floor(d.getTime() / 1000)
        };
        
        return format.replace(/(YYYY|MM|DD|HH|mm|ss|ms|YYYYMMDD|HHmmss|day|month|timestamp)/g, (match) => {
            return replacements[match] !== undefined ? replacements[match] : match;
        });
    }

    random(min = 0, max = 100) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    randomFloat(min = 0, max = 1) {
        return Math.random() * (max - min) + min;
    }

    uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    slugify(str) {
        return str.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }

    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    truncate(str, maxLength = 100, suffix = '...') {
        return str.length > maxLength ? str.slice(0, maxLength) + suffix : str;
    }

    hash(str, algorithm = 'sha256') {
        const crypto = require('crypto');
        return crypto.createHash(algorithm).update(str).digest('hex');
    }

    md5(str) {
        return this.hash(str, 'md5');
    }

    sha256(str) {
        return this.hash(str, 'sha256');
    }

    sha512(str) {
        return this.hash(str, 'sha512');
    }

    env(key, value) {
        if (value !== undefined) {
            process.env[key] = value;
            return this;
        }
        return process.env[key];
    }

    getEnv(key) {
        return process.env[key];
    }

    setEnv(key, value) {
        process.env[key] = value;
        return this;
    }

    listEnv(filter = '') {
        const env = {};
        for (const [key, value] of Object.entries(process.env)) {
            if (filter === '' || key.toLowerCase().includes(filter.toLowerCase())) {
                env[key] = value;
            }
        }
        return env;
    }

    math() {
        return {
            sum: (...args) => args.reduce((a, b) => a + b, 0),
            avg: (...args) => args.reduce((a, b) => a + b, 0) / args.length,
            min: (...args) => Math.min(...args),
            max: (...args) => Math.max(...args),
            round: (num, decimals = 0) => Number(num.toFixed(decimals)),
            floor: (num) => Math.floor(num),
            ceil: (num) => Math.ceil(num),
            abs: (num) => Math.abs(num),
            pow: (base, exponent) => Math.pow(base, exponent),
            sqrt: (num) => Math.sqrt(num),
            log: (num) => Math.log(num),
            log10: (num) => Math.log10(num),
            sin: (num) => Math.sin(num),
            cos: (num) => Math.cos(num),
            tan: (num) => Math.tan(num),
            pi: Math.PI,
            e: Math.E
        };
    }

    getHelp() {
        let help = `\u001b[36m${this.scriptName}\u001b[0m`;
        
        if (this.description) {
            help += `\n\n${this.description}`;
        }

        const visibleOptions = Object.entries(this.options).filter(([, opt]) => !opt.hidden);
        if (visibleOptions.length > 0) {
            help += '\n\n\u001b[33mOptions:\u001b[0m';
            
            const maxLen = Math.max(...visibleOptions.map(([name]) => name.length)) + 4;
            
            for (const [name, opt] of visibleOptions) {
                let line = `  --${name}`;
                
                if (opt.alias && opt.alias.length > 0) {
                    line += `, -${opt.alias.join(', -')}`;
                }
                
                if (opt.type && opt.type !== 'string') {
                    line += ` (\u001b[35m${opt.type}\u001b[0m)`;
                }
                
                if (opt.default !== undefined) {
                    line += ` [default: ${JSON.stringify(opt.default)}]`;
                }
                
                line = line.padEnd(maxLen);
                line += opt.description;
                
                help += `\n${line}`;
            }
        }

        const visibleCommands = Object.entries(this.commands).filter(([, cmd]) => !cmd.hidden);
        if (visibleCommands.length > 0) {
            const groupedCommands = {};
            for (const [name, cmd] of visibleCommands) {
                const group = cmd.group || 'Commands';
                if (!groupedCommands[group]) {
                    groupedCommands[group] = [];
                }
                groupedCommands[group].push({ name, cmd });
            }
            
            for (const [groupName, commands] of Object.entries(groupedCommands)) {
                help += `\n\n\u001b[33m${groupName}:\u001b[0m`;
                
                const maxLen = Math.max(...commands.map(({ name }) => name.length)) + 4;
                
                for (const { name, cmd } of commands) {
                    let line = `  ${name}`;
                    
                    if (cmd.aliases && cmd.aliases.length > 0) {
                        line += ` (${cmd.aliases.join(', ')})`;
                    }
                    
                    line = line.padEnd(maxLen);
                    line += cmd.description;
                    
                    help += `\n${line}`;
                }
            }
        }

        if (this._positional.length > 0) {
            help += '\n\n\u001b[33mArguments:\u001b[0m';
            
            for (const pos of this._positional) {
                let line = `  ${pos.name}`;
                
                if (pos.type && pos.type !== 'string') {
                    line += ` (\u001b[35m${pos.type}\u001b[0m)`;
                }
                
                if (pos.demandOption) {
                    line += ' \u001b[31m(required)\u001b[0m';
                }
                
                line += `\n    ${pos.description}`;
                
                help += `\n${line}`;
            }
        }

        help += '\n\nUse `--help` for more information about a command.';
        
        return help;
    }

    showHelp() {
        console.log(this.getHelp());
        process.exit(0);
    }
}

module.exports = ArgumentParser;
