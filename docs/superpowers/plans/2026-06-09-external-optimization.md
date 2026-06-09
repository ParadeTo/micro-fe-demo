# External 优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 React / react-dom/client / react-native-web 从各微应用 IIFE bundle 中外部化，通过宿主统一提供 shared vendors bundle，把单包体积从 ~268 KB 降至 ~30 KB。

**Architecture:** 构建一个 IIFE 格式的 `shared/vendors.js` 将三个包挂到 `window` 上；微应用 Vite 构建默认声明 externals + globals；`micro-fe-sdk` 暴露一个 Nuxt module，host 装上后自动在 `<head>` 注入 vendors script。sandbox 的 `with(proxy)` 机制对未命中 key 会 fall-through 到 `rawWindow`，故无需修改 sandbox/loader。

**Tech Stack:** Vite 6, Rollup, @nuxt/kit (defineNuxtModule), pnpm workspaces

---

## 文件清单

| 操作 | 路径 | 说明 |
|------|------|------|
| 目录重命名 | `simple-qiankun/` → `micro-fe-sdk/` | SDK 包根目录 |
| 修改 | `micro-fe-sdk/package.json` | 改包名、加 exports 子路径、加 @nuxt/kit devDep |
| 修改 | `pnpm-workspace.yaml` | 改 simple-qiankun → micro-fe-sdk |
| 修改 | `package.json`（根） | workspaces 数组同步改名 |
| 修改 | `h5-pages/package.json` | 依赖改为 micro-fe-sdk |
| 新建 | `micro-fe-sdk/src/nuxt/index.js` | Nuxt module，注入 vendors script |
| 新建 | `rn_demo/web/entries/shared-vendors.js` | vendors bundle 入口 |
| 新建 | `rn_demo/web/shared-vendors.config.js` | vendors bundle Vite 构建配置 |
| 修改 | `rn_demo/web/vite.base.config.js` | 加 externals + globals |
| 修改 | `rn_demo/package.json` | 加 build:web:shared 脚本，更新 build:web 顺序 |
| 修改 | `h5-pages/app/composables/useMicroFrontend.ts` | import 路径改为 micro-fe-sdk |
| 修改 | `h5-pages/nuxt.config.ts` | 加 modules: ['micro-fe-sdk/nuxt'] |
| 修改 | `nginx/nginx.conf.template` | 加 /shared/ location |
| 修改 | `scripts/build.sh` | 更新注释说明（build:web 已包含 shared） |

---

## Task 1：重命名目录与更新 package.json

**Files:**
- Rename: `simple-qiankun/` → `micro-fe-sdk/`
- Modify: `micro-fe-sdk/package.json`
- Modify: `pnpm-workspace.yaml`
- Modify: `package.json`（根）
- Modify: `h5-pages/package.json`

- [ ] **Step 1: 重命名目录**

```bash
mv simple-qiankun micro-fe-sdk
```

- [ ] **Step 2: 更新 micro-fe-sdk/package.json**

将 `micro-fe-sdk/package.json` 改为：

```json
{
  "name": "micro-fe-sdk",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/micro-fe/index.js",
    "./nuxt": "./src/nuxt/index.js"
  },
  "scripts": {
    "dev": "node scripts/dev-server.js",
    "test": "node --test"
  },
  "devDependencies": {
    "@nuxt/kit": "^3.17.5"
  }
}
```

- [ ] **Step 3: 更新 pnpm-workspace.yaml**

```yaml
packages:
  - "micro-fe-sdk"
  - "h5-pages"
  - "rn_demo"
  - "server"
```

- [ ] **Step 4: 更新根 package.json**

```json
{
  "private": true,
  "workspaces": [
    "micro-fe-sdk",
    "h5-pages",
    "rn_demo",
    "server"
  ]
}
```

- [ ] **Step 5: 更新 h5-pages/package.json 依赖名**

将 `"@micro-fe/core": "workspace:*"` 改为 `"micro-fe-sdk": "workspace:*"`：

```json
{
  "name": "h5-pages",
  "type": "module",
  "private": true,
  "scripts": {
    "build": "nuxt build",
    "dev": "nuxt dev",
    "generate": "nuxt generate",
    "preview": "nuxt preview",
    "postinstall": "nuxt prepare"
  },
  "dependencies": {
    "micro-fe-sdk": "workspace:*",
    "nuxt": "^4.4.7",
    "vue": "^3.5.35",
    "vue-router": "^5.1.0"
  }
}
```

- [ ] **Step 6: 重装依赖，验证 workspace 链接正常**

```bash
pnpm install
```

Expected: 无报错，`h5-pages/node_modules/micro-fe-sdk` 应为指向 `micro-fe-sdk/` 的 symlink。

验证：

```bash
ls -la h5-pages/node_modules/micro-fe-sdk
```

Expected: 输出包含 `-> ../../micro-fe-sdk` 或类似 symlink 路径。

- [ ] **Step 7: 运行现有测试确认未破坏**

```bash
cd micro-fe-sdk && node --test
```

Expected: 所有测试通过（exit 0）。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: rename simple-qiankun to micro-fe-sdk"
```

---

## Task 2：新增 Nuxt module

**Files:**
- Create: `micro-fe-sdk/src/nuxt/index.js`

- [ ] **Step 1: 创建文件**

新建 `micro-fe-sdk/src/nuxt/index.js`：

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

- [ ] **Step 2: 验证文件路径与 package.json exports 匹配**

```bash
cat micro-fe-sdk/package.json | grep -A4 '"exports"'
```

Expected：`"./nuxt": "./src/nuxt/index.js"` 出现在输出中。

- [ ] **Step 3: Commit**

```bash
git add micro-fe-sdk/src/nuxt/index.js
git commit -m "feat(micro-fe-sdk): add nuxt module for vendors script injection"
```

---

## Task 3：更新 h5-pages 使用新包名和 Nuxt module

**Files:**
- Modify: `h5-pages/app/composables/useMicroFrontend.ts`
- Modify: `h5-pages/nuxt.config.ts`

- [ ] **Step 1: 更新 useMicroFrontend.ts 的 import 路径**

将 `h5-pages/app/composables/useMicroFrontend.ts` 中：

```ts
const { MicroApp } = await import('@micro-fe/core');
```

改为：

```ts
const { MicroApp } = await import('micro-fe-sdk');
```

- [ ] **Step 2: 将 Nuxt module 加入 nuxt.config.ts**

将 `h5-pages/nuxt.config.ts` 改为：

```ts
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['micro-fe-sdk/nuxt'],
  runtimeConfig: {
    public: {
      microAppsBase: 'http://localhost:8080',
      apiBase: 'http://localhost:3001',
    },
  },
})
```

- [ ] **Step 3: 验证 Nuxt 能解析模块（dev 模式启动不报错）**

```bash
cd h5-pages && pnpm dev 2>&1 | head -20
```

Expected: 输出包含 `Nuxt` 启动信息，无 `Cannot find module 'micro-fe-sdk/nuxt'` 报错。按 Ctrl+C 停止。

- [ ] **Step 4: Commit**

```bash
git add h5-pages/app/composables/useMicroFrontend.ts h5-pages/nuxt.config.ts
git commit -m "feat(h5-pages): use micro-fe-sdk and register vendors nuxt module"
```

---

## Task 4：构建 shared vendors bundle

**Files:**
- Create: `rn_demo/web/entries/shared-vendors.js`
- Create: `rn_demo/web/shared-vendors.config.js`
- Modify: `rn_demo/package.json`

- [ ] **Step 1: 新建 vendors 入口文件**

新建 `rn_demo/web/entries/shared-vendors.js`：

```js
import * as React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import * as ReactNativeWeb from 'react-native-web';

window.React = React;
window.ReactDOMClient = ReactDOMClient;
window.ReactNativeWeb = ReactNativeWeb;
```

- [ ] **Step 2: 新建 vendors Vite 构建配置**

新建 `rn_demo/web/shared-vendors.config.js`：

```js
import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': JSON.stringify({ NODE_ENV: 'production' }),
    'process': JSON.stringify({ env: { NODE_ENV: 'production' } }),
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'entries/shared-vendors.js'),
      formats: ['iife'],
      name: 'MicroFeShared',
    },
    outDir: resolve(__dirname, '../../micro-apps/shared'),
    emptyOutDir: true,
    rollupOptions: {
      output: { entryFileNames: 'vendors.js' },
    },
  },
});
```

- [ ] **Step 3: 更新 rn_demo/package.json 脚本**

```json
{
  "name": "rn-demo-client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "AppEntry.js",
  "scripts": {
    "start": "expo start",
    "ios": "expo start --ios",
    "android": "expo start --android",
    "test": "node --test",
    "build:web:shared": "vite build --config web/shared-vendors.config.js",
    "build:web:task-list": "vite build --config web/task-list.config.js",
    "build:web:banners": "vite build --config web/banners.config.js",
    "build:web": "pnpm build:web:shared && pnpm build:web:task-list && pnpm build:web:banners",
    "dev:web:task-list": "vite build --config web/task-list.config.js --watch",
    "dev:web:banners": "vite build --config web/banners.config.js --watch",
    "dev:web": "pnpm dev:web:task-list & pnpm dev:web:banners"
  },
  "dependencies": {
    "expo": "53.0.27",
    "react": "19.0.0",
    "react-native": "0.79.6"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "react-dom": "19.0.0",
    "react-native-web": "^0.20.0",
    "vite": "^6.3.5"
  }
}
```

- [ ] **Step 4: 构建 vendors bundle，验证产物**

```bash
cd rn_demo && pnpm build:web:shared
```

Expected: `micro-apps/shared/vendors.js` 生成成功，无报错。

验证产物包含三个全局赋值：

```bash
grep -c "window\.React\|window\.ReactDOMClient\|window\.ReactNativeWeb" ../micro-apps/shared/vendors.js
```

Expected: 输出 `3`（三处赋值，minified 后可能是连在一起的，用 `grep -o` 计数）。若结果为 0，用：

```bash
grep -o "window\." ../micro-apps/shared/vendors.js | wc -l
```

Expected: 大于 0。

验证文件大小（应包含 React + RNWeb，体积较大）：

```bash
du -sh ../micro-apps/shared/vendors.js
```

Expected: 500 KB 到 2 MB 之间。

- [ ] **Step 5: Commit**

```bash
git add rn_demo/web/entries/shared-vendors.js rn_demo/web/shared-vendors.config.js rn_demo/package.json
git commit -m "feat(rn_demo): add shared vendors IIFE bundle for React/RNWeb globals"
```

---

## Task 5：外部化微应用 bundle 的 shared deps

**Files:**
- Modify: `rn_demo/web/vite.base.config.js`

- [ ] **Step 1: 在 createWebConfig 中加 externals 和 globals**

将 `rn_demo/web/vite.base.config.js` 的 `rollupOptions` 改为：

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

完整文件如下（只改 `rollupOptions` 部分，其余不变）：

```js
import react from '@vitejs/plugin-react';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { transformWithEsbuild } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createWebConfig(name, entryFromRnDemoRoot) {
  const outDir = resolve(__dirname, '../../micro-apps', name);

  return {
    plugins: [
      {
        name: 'treat-js-as-jsx',
        enforce: 'pre',
        async transform(code, id) {
          if (id.includes('node_modules') || !id.endsWith('.js')) return null;
          return transformWithEsbuild(code, id, { loader: 'jsx', jsx: 'automatic' });
        },
      },
      react(),
      {
        name: 'write-html-entry',
        closeBundle() {
          mkdirSync(outDir, { recursive: true });
          writeFileSync(
            resolve(outDir, 'index.html'),
            `<div></div>\n<script src="./${name}.js"></script>\n`,
          );
        },
      },
    ],
    resolve: {
      alias: { 'react-native': 'react-native-web' },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env': JSON.stringify({ NODE_ENV: 'production' }),
      'process': JSON.stringify({ env: { NODE_ENV: 'production' } }),
    },
    build: {
      lib: {
        entry: resolve(__dirname, '..', entryFromRnDemoRoot),
        formats: ['iife'],
        name: toPascalCase(name) + 'App',
      },
      outDir,
      emptyOutDir: true,
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
    },
  };
}

function toPascalCase(str) {
  return str.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
}
```

- [ ] **Step 2: 构建两个微应用，验证体积大幅下降**

```bash
cd rn_demo && pnpm build:web:banners && pnpm build:web:task-list
```

Expected: 无报错。

验证体积：

```bash
du -sh ../micro-apps/banners/banners.js ../micro-apps/task-list/task-list.js
```

Expected: 两个文件各约 20–50 KB（原来各 ~268 KB）。

- [ ] **Step 3: 验证 bundle 不再包含 React 源码**

```bash
grep -c "createElement" ../micro-apps/banners/banners.js
```

Expected: 输出 `0` 或极小的数（外部化后 bundle 内不应包含 React 实现，只有对全局变量的引用）。

- [ ] **Step 4: Commit**

```bash
git add rn_demo/web/vite.base.config.js
git commit -m "feat(rn_demo): externalize react/react-dom/react-native-web from micro-app bundles"
```

---

## Task 6：更新 nginx 配置支持 /shared/ 路径

**Files:**
- Modify: `nginx/nginx.conf.template`

- [ ] **Step 1: 在 nginx.conf.template 中加 /shared/ location**

将 `nginx/nginx.conf.template` 的 location 区块改为（在现有 `task-list|banners` location 后加 shared）：

```nginx
    # Micro-app bundles — CORS headers allow dev h5-pages (different port) to load them
    location ~ ^/(task-list|banners|shared)/ {
      root MICRO_FE_ROOT/micro-apps;
      add_header Access-Control-Allow-Origin *;
      add_header Access-Control-Allow-Methods "GET, OPTIONS";
      if ($request_method = OPTIONS) { return 204; }
      try_files $uri =404;
    }
```

（只改正则中的 `task-list|banners` → `task-list|banners|shared`，其余不变）

- [ ] **Step 2: 验证模板语法正确（检查改动）**

```bash
grep "location ~" nginx/nginx.conf.template
```

Expected: 输出包含 `task-list|banners|shared`。

- [ ] **Step 3: Commit**

```bash
git add nginx/nginx.conf.template
git commit -m "feat(nginx): serve /shared/ path for vendors bundle"
```

---

## Task 7：端到端冒烟测试

- [ ] **Step 1: 重启 nginx（如果正在运行）**

```bash
bash nginx/start.sh
```

Expected: nginx 启动成功，无报错。

- [ ] **Step 2: 验证 vendors.js 可通过 nginx 访问**

```bash
curl -I http://localhost:8080/shared/vendors.js
```

Expected: `HTTP/1.1 200 OK`，Content-Type 为 `application/javascript` 或类似。

- [ ] **Step 3: 启动 h5-pages dev server 验证页面正常**

```bash
cd h5-pages && pnpm dev
```

访问 `http://localhost:3000`，打开浏览器 DevTools：

- Network 面板：确认 `/shared/vendors.js` 被加载（HTTP 200）
- Console 面板：无报错
- 页面：banners 和 task-list 微应用正常渲染

- [ ] **Step 4: 验证 window globals 已挂载**

在浏览器 Console 执行：

```js
typeof window.React          // 期望: "object"
typeof window.ReactDOMClient // 期望: "object"
typeof window.ReactNativeWeb // 期望: "object"
```

Expected: 三个均返回 `"object"`。

- [ ] **Step 5: 完整生产构建验证**

```bash
cd .. && bash scripts/build.sh
```

Expected: 所有步骤无报错，输出 `Build complete.`

- [ ] **Step 6: 最终 commit**

```bash
git add -A
git commit -m "chore: verify external optimization end-to-end"
```

---

## 新增微应用接入流程（改动后）

接入方开发一个新微应用，**无需任何改动**即享受 external 优化：

```js
// rn_demo/web/my-widget.config.js
import { createWebConfig } from './vite.base.config.js';
export default createWebConfig('my-widget', 'web/entries/my-widget.jsx');
// externals 默认开启，无需额外参数
```

Host 侧已通过 Nuxt module 统一注入 vendors.js，接入方只需按原有步骤在 `app.vue` 挂载即可。
