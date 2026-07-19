# TSDK-CLI

TypeScript Development Kit CLI - 直接运行 TypeScript。

## 功能

- 直接运行 `.ts` 文件（无需手动编译）
- Watch 模式（文件变更自动重跑）
- REPL 交互环境
- 项目初始化
- 打包构建
- 代码格式化
- 测试运行器

## 安装

```bash
npm install tsdk-cli -g
```

## 使用

### 运行 TypeScript

```bash
tsdk run script.ts
```

### Watch 模式

```bash
tsdk watch script.ts
```

### REPL

```bash
tsdk repl
```

### 项目初始化

```bash
tsdk init my-project
```

### 打包

```bash
tsdk bundle src/index.ts --outfile=dist/bundle.js
```

### 格式化

```bash
tsdk format src/
```

### 测试

```bash
tsdk test
```

## 依赖

- esbuild - 快速打包
- chokidar - 文件监听
- prettier - 代码格式化
- glob - 文件匹配

## License

Apache-2.0 - Copyright (c) Vexify 2026