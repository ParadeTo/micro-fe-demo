# External 优化设计文档

## 目标

将 React、react-dom/client、react-native-web 从各微应用 IIFE bundle 中外部化，通过宿主统一提供，把单包体积从 ~268 KB 降至 ~30 KB。

## 背景约束

- 微应用以 IIFE 格式构建，在 `sandbox.exec()`（`new Function() + with(proxy)`）中执行
- Sandbox proxy 对未命中的 key 会 fall-through 到 `rawWindow`，故 `window.React` 等全局变量天然可被沙箱内代码访问
- React 19 已删除 UMD build，不能直接复用 npm 包内的 UMD 文件，需自行构建 shared IIFE bundle
- 不改动 sandbox / loader 架构

## 改名

| 现在 | 改后 |
|------|------|
| 目录 `simple-qiankun/` | `micro-fe-sdk/` |
| package name `@micro-fe/core` | `micro-fe-sdk` |
| h5-pages `import('@micro-fe/core')` | `import('micro-fe-sdk')` |
| pnpm workspace `"@micro-fe/core": "workspace:*"` | `"micro-fe-sdk": "workspace:*"` |

## 架构变更

```
构建产物
  micro-apps/
    shared/
      vendors.js        ← 新增，暴露 window.React / ReactDOMClient / ReactNativeWeb
    banners/
      index.html
      banners.js        ← 外部化后约 ~30 KB（原 ~268 KB）
    task-list/
      index.html
      task-list.js      ← 同上

宿主 (h5-pages)
  nuxt.config.ts        ← modules: ['micro-fe-sdk/nuxt']
  ↓ Nuxt module 在 <head> 注入 <script src="/shared/vendors.js">

nginx
  /shared/*             ← 已由现有配置托管 micro-apps/ 目录，无需额外改动
```

## 各部分详细设计

### 1. Shared vendors bundle

**新文件**：`rn_demo/web/entries/shared-vendors.js`

```js
import * as React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import * as ReactNativeWeb from 'react-native-web';

window.React = React;
window.ReactDOMClient = ReactDOMClient;
window.ReactNativeWeb = ReactNativeWeb;
```

**新文件**：`rn_demo/web/shared-vendors.config.js`

```js
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': JSON.stringify({ NODE_ENV: 'production' }),
    'process': JSON.stringify({ env: { NODE_ENV: 'production' } }),
  },
  build: {
    lib: {
      entry: resolve('web/entries/shared-vendors.js'),
      formats: ['iife'],
      name: 'MicroFeShared',
    },
    outDir: resolve('../micro-apps/shared'),
    emptyOutDir: true,
    rollupOptions: {
      output: { entryFileNames: 'vendors.js' },
    },
  },
});
```

**`rn_demo/package.json` 新增脚本**：

```json
"build:web:shared": "vite build --config web/shared-vendors.config.js",
"build:web": "pnpm build:web:shared && pnpm build:web:task-list && pnpm build:web:banners"
```

### 2. `createWebConfig` 默认外部化

`rn_demo/web/vite.base.config.js` 的 `rollupOptions` 改为：

```js
rollupOptions: {
  external: ['react', 'react-dom/client', 'react-native-web'],
  output: {
    entryFileNames: `${name}.js`,
    globals: {
      'react': 'React',
      'react-dom/client': 'ReactDOMClient',
      'react-native-web': 'ReactNativeWeb',
    },
  },
},
```

接入方调用 `createWebConfig('my-widget', entry)` 无需任何改动即可生效。

### 3. Nuxt module（`micro-fe-sdk/src/nuxt/index.js`）

```js
import { defineNuxtModule } from '@nuxt/kit';

export default defineNuxtModule({
  meta: { name: 'micro-fe-sdk', configKey: 'microFe' },
  defaults: { vendorsUrl: '/shared/vendors.js' },
  setup(options, nuxt) {
    nuxt.options.app.head.script ??= [];
    nuxt.options.app.head.script.unshift({ src: options.vendorsUrl });
  },
});
```

`micro-fe-sdk/package.json` exports 增加子路径：

```json
"exports": {
  ".": "./src/micro-fe/index.js",
  "./nuxt": "./src/nuxt/index.js"
}
```

### 4. Host 接入（`h5-pages/nuxt.config.ts`）

```ts
modules: ['micro-fe-sdk/nuxt'],
// 可选覆盖：
// microFe: { vendorsUrl: 'https://cdn.example.com/vendors.js' },
```

`useMicroFrontend.ts` 中 `import('@micro-fe/core')` 改为 `import('micro-fe-sdk')`。

### 5. 构建顺序（`scripts/build.sh`）

shared vendors 必须先于微应用构建：

```bash
cd rn_demo && pnpm build:web:shared && pnpm build:web:task-list && pnpm build:web:banners
```

或统一走 `pnpm build:web`（已在脚本中保证顺序）。

## 新增微应用接入流程（接入方视角）

改动前需 6 步，改动后步骤不变，但第 3 步配置更简单：

```js
// 改动前
import { createWebConfig } from './vite.base.config.js';
export default createWebConfig('my-widget', 'web/entries/my-widget.jsx');
// 改动后：完全相同，无需额外配置
```

shared deps 自动外部化，host 侧 vendors.js 已统一注入。

## 不在本次范围内

- Import Maps + ESM 方案（需重构 sandbox/loader）
- 内容哈希 + 长效缓存（独立优化项）
- vendors.js 的拆分（三个独立文件）
