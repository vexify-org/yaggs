const ArgumentParser = require('./lib/parser');

class Yaggs {
    constructor(options = {}) {
        this.parser = new ArgumentParser(options);
        this.middlewares = [];
        this.commandHooks = {};
        this.defaultHandler = null;
        this.completionFunction = null;
        this.pkg = options.pkg || null;
        
        this.parser.option('help', {
            type: 'boolean',
            description: 'Show help message',
            alias: ['h'],
            hidden: false
        });
        
        this.parser.option('version', {
            type: 'boolean',
            description: 'Show version',
            alias: ['v'],
            hidden: false
        });
    }

    option(name, config) {
        this.parser.option(name, config);
        return this;
    }

    positional(name, config) {
        this.parser.positional(name, config);
        return this;
    }

    command(name, description, builder, handler) {
        if (typeof description === 'object') {
            this.parser.command(name, description);
        } else {
            this.parser.command(name, {
                description,
                builder,
                handler
            });
        }
        return this;
    }

    middleware(fn) {
        this.middlewares.push(fn);
        return this;
    }

    hook(event, fn) {
        if (!this.commandHooks[event]) {
            this.commandHooks[event] = [];
        }
        this.commandHooks[event].push(fn);
        return this;
    }

    defaults(defaults) {
        for (const [key, value] of Object.entries(defaults)) {
            if (!this.parser.options[key]) {
                this.parser.option(key, { default: value });
            } else {
                this.parser.options[key].default = value;
                this.parser.defaults[key] = value;
            }
        }
        return this;
    }

    strict() {
        this.parser.strict = true;
        return this;
    }

    wrapHelp(fn) {
        this.parser.helpFunction = fn;
        return this;
    }

    exitProcess(exit = true) {
        this.parser.exitProcess = exit;
        return this;
    }

    usage(usage) {
        this.parser.usage = usage;
        return this;
    }

    example(command, description) {
        if (!this.parser.examples) {
            this.parser.examples = [];
        }
        this.parser.examples.push({ command, description });
        return this;
    }

    completion(fn) {
        this.completionFunction = fn;
        return this;
    }

    generateCompletion(shell = 'bash') {
        return this.parser.generateCompletion(shell);
    }

    async checkVersion(packageName, currentVersion) {
        return this.parser.checkVersion(packageName, currentVersion);
    }

    async prompt(questions) {
        return this.parser.prompt(questions);
    }

    progress(percentage, message = '') {
        this.parser.progress(percentage, message);
        return this;
    }

    table(data, options = {}) {
        this.parser.table(data, options);
        return this;
    }

    log(message, level = 'info') {
        this.parser.log(message, level);
        return this;
    }

    error(message) {
        this.parser.error(message);
        return this;
    }

    warn(message) {
        this.parser.warn(message);
        return this;
    }

    debug(message) {
        this.parser.debug(message);
        return this;
    }

    success(message) {
        this.parser.success(message);
        return this;
    }

    async countdown(seconds, message = 'Countdown') {
        await this.parser.countdown(seconds, message);
        return this;
    }

    async ask(question, options = {}) {
        return this.parser.ask(question, options);
    }

    spinner(message = 'Loading') {
        return this.parser.spinner(message);
    }

    async confirm(message, options = {}) {
        return this.parser.confirm(message, options);
    }

    async select(options, question = 'Select an option') {
        return this.parser.select(options, question);
    }

    async password(message = 'Enter password') {
        return this.parser.password(message);
    }

    async http(url, options = {}) {
        return this.parser.http(url, options);
    }

    file(path, options = {}) {
        return this.parser.file(path, options);
    }

    template(str, data = {}) {
        return this.parser.template(str, data);
    }

    formatDate(date = new Date(), format = 'YYYY-MM-DD HH:mm:ss') {
        return this.parser.formatDate(date, format);
    }

    random(min = 0, max = 100) {
        return this.parser.random(min, max);
    }

    randomFloat(min = 0, max = 1) {
        return this.parser.randomFloat(min, max);
    }

    uuid() {
        return this.parser.uuid();
    }

    slugify(str) {
        return this.parser.slugify(str);
    }

    capitalize(str) {
        return this.parser.capitalize(str);
    }

    truncate(str, maxLength = 100, suffix = '...') {
        return this.parser.truncate(str, maxLength, suffix);
    }

    hash(str, algorithm = 'sha256') {
        return this.parser.hash(str, algorithm);
    }

    md5(str) {
        return this.parser.md5(str);
    }

    sha256(str) {
        return this.parser.sha256(str);
    }

    sha512(str) {
        return this.parser.sha512(str);
    }

    env(key, value) {
        if (value !== undefined) {
            this.parser.env(key, value);
            return this;
        }
        return this.parser.env(key);
    }

    getEnv(key) {
        return this.parser.getEnv(key);
    }

    setEnv(key, value) {
        this.parser.setEnv(key, value);
        return this;
    }

    listEnv(filter = '') {
        return this.parser.listEnv(filter);
    }

    math() {
        return this.parser.math();
    }

    check(fn) {
        this.middleware(fn);
        return this;
    }

    validate(fn) {
        this.middleware(fn);
        return this;
    }

    demandOption(name, msg) {
        if (this.parser.options[name]) {
            this.parser.options[name].demandOption = true;
            if (msg) {
                this.parser.options[name].demandOptionMsg = msg;
            }
        }
        return this;
    }

    demandCommand(msg) {
        this.parser.demandCommand = true;
        if (msg) {
            this.parser.demandCommandMsg = msg;
        }
        return this;
    }

    env(name, envVar) {
        if (this.parser.options[name]) {
            this.parser.options[name].env = envVar;
        }
        return this;
    }

    config(filePath) {
        this.parser.loadConfig(filePath);
        return this;
    }

    parse(argv = process.argv.slice(2)) {
        const result = this.parser.parse(argv);
        
        for (const middleware of this.middlewares) {
            middleware(result);
        }
        
        if (result.help) {
            this.showHelp();
        }
        
        if (result.version) {
            this.showVersion();
        }
        
        return result;
    }

    async parseAsync(argv = process.argv.slice(2)) {
        const result = this.parse(argv);
        
        for (const middleware of this.middlewares) {
            const middlewareResult = middleware(result);
            if (middlewareResult && typeof middlewareResult.then === 'function') {
                await middlewareResult;
            }
        }
        
        return result;
    }

    async run(argv = process.argv.slice(2)) {
        const result = await this.parseAsync(argv);
        
        if (result.command && this.parser.commands[result.command]) {
            const cmd = this.parser.commands[result.command];
            
            if (this.commandHooks['beforeCommand']) {
                for (const hook of this.commandHooks['beforeCommand']) {
                    await hook(result);
                }
            }
            
            if (cmd.builder) {
                if (typeof cmd.builder === 'function') {
                    const subYaggs = new Yaggs();
                    cmd.builder(subYaggs);
                    const subResult = subYaggs.parse(result._);
                    Object.assign(result, subResult);
                } else if (typeof cmd.builder === 'object') {
                    for (const [key, value] of Object.entries(cmd.builder)) {
                        if (!result[key]) {
                            result[key] = value;
                        }
                    }
                }
            }
            
            if (cmd.handler) {
                const handlerResult = cmd.handler(result);
                if (handlerResult && typeof handlerResult.then === 'function') {
                    await handlerResult;
                }
            }
            
            if (this.commandHooks['afterCommand']) {
                for (const hook of this.commandHooks['afterCommand']) {
                    await hook(result);
                }
            }
        } else if (this.defaultHandler) {
            await this.defaultHandler(result);
        }
        
        return result;
    }

    showHelp() {
        let help = this.parser.getHelp();
        
        if (this.parser.examples && this.parser.examples.length > 0) {
            help += '\n\n\u001b[33mExamples:\u001b[0m';
            for (const example of this.parser.examples) {
                help += `\n  \u001b[36m${example.command}\u001b[0m`;
                if (example.description) {
                    help += `\n    ${example.description}`;
                }
            }
        }
        
        if (this.parser.helpFunction) {
            help = this.parser.helpFunction(help);
        }
        
        console.log(help);
        
        if (this.parser.exitProcess !== false) {
            process.exit(0);
        }
    }

    help() {
        return this;
    }

    showVersion() {
        const version = this.pkg ? this.pkg.version : this.parser.version;
        console.log(version);
        
        if (this.parser.exitProcess !== false) {
            process.exit(0);
        }
    }

    getHelp() {
        let help = this.parser.getHelp();
        
        if (this.parser.examples && this.parser.examples.length > 0) {
            help += '\n\n\u001b[33mExamples:\u001b[0m';
            for (const example of this.parser.examples) {
                help += `\n  \u001b[36m${example.command}\u001b[0m`;
                if (example.description) {
                    help += `\n    ${example.description}`;
                }
            }
        }
        
        return help;
    }
}

function yaggs(options) {
    return new Yaggs(options);
}

yaggs.Yaggs = Yaggs;
yaggs.ArgumentParser = ArgumentParser;

module.exports = yaggs;
module.exports.default = yaggs;
