# TaskList RN → Web 微前端实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `rn_demo/src/TaskList.js` 以 react-native-web 编译为独立微前端子应用，通过 nginx 静态服务 + simple-qiankun loader 挂载到 `h5-pages` 的 `#taskList` 插槽，RN 源码不做任何修改。

**Architecture:** pnpm workspace 共享 `@micro-fe/core`（simple-qiankun 改名）；rn_demo 增加 Vite IIFE 构建，产物输出到根目录 `micro-apps/`；nginx 静态服务该目录；h5-pages 通过 `useMicroFrontend` composable 调用 `MicroApp` 直接挂载（不经路由激活）。

**Tech Stack:** pnpm workspaces, Vite + @vitejs/plugin-react, react-native-web, Nuxt 4 / Vue 3, Node.js built-in test runner, nginx

---

## 文件地图

| 操作 | 路径 | 职责 |
|------|------|------|
| 新建 | `package.json`（根） | pnpm workspace 配置 |
| 新建 | `micro-apps/` | nginx 静态文件根目录 |
| 新建 | `nginx/nginx.conf.template` | 静态服务模板 |
| 修改 | `simple-qiankun/package.json` | 改名为 `@micro-fe/core`，添加 exports |
| 修改 | `simple-qiankun/src/micro-fe/app-manager.js` | 导出 `MicroApp` 类 |
| 修改 | `simple-qiankun/src/micro-fe/index.js` | 透传 `MicroApp` 导出 |
| 修改 | `simple-qiankun/test/micro-fe.test.js` | 新增 MicroApp 导出测试 |
| 新建 | `rn_demo/web/vite.base.config.js` | Vite 配置工厂（含 write-html-entry 插件） |
| 新建 | `rn_demo/web/entries/task-list.jsx` | TaskList web 入口，暴露 `__MICRO_APP_LIFECYCLE__` |
| 新建 | `rn_demo/web/task-list.config.js` | TaskList Vite 配置（1 行） |
| 修改 | `rn_demo/package.json` | 添加 vite/react-native-web 依赖和 build:web 脚本 |
| 修改 | `h5-pages/package.json` | 添加 `@micro-fe/core` workspace 依赖 |
| 新建 | `h5-pages/composables/useMicroFrontend.ts` | 通用微前端挂载 composable |
| 修改 | `h5-pages/app/app.vue` | 调用 composable 挂载 task-list |
| 新建 | `h5-pages/.env.development` | `VITE_MICRO_APPS_BASE=http://localhost:8080` |

---

## Task 1：pnpm workspace 配置

**Files:**
- Create: `package.json`（项目根目录）

- [ ] **Step 1：创建根 package.json**

```json
{
  "private": true,
  "workspaces": [
    "simple-qiankun",
    "h5-pages",
    "rn_demo",
    "server"
  ]
}
```

- [ ] **Step 2：移除子项目独立 lock file**

pnpm workspace 模式下只允许根目录存在一个 `pnpm-lock.yaml`，子项目的 lock file 需删除：

```bash
rm /Users/youxingzhi/ayou/micro-fe-demo/h5-pages/pnpm-lock.yaml
```

- [ ] **Step 3：验证 pnpm 识别 workspace**

```bash
cd /Users/youxingzhi/ayou/micro-fe-demo
pnpm install
```

预期：pnpm 输出 `Packages: N+` 并在根目录生成 `node_modules/` 和 `pnpm-lock.yaml`，各子项目 node_modules 符号链接正确。如报错 "pnpm: command not found"，先安装：`npm i -g pnpm`。

- [ ] **Step 4：commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add pnpm workspace root"
```

---

## Task 2：@micro-fe/core — 导出 MicroApp 类

**Files:**
- Modify: `simple-qiankun/package.json`
- Modify: `simple-qiankun/src/micro-fe/app-manager.js`（末尾）
- Modify: `simple-qiankun/src/micro-fe/index.js`
- Modify: `simple-qiankun/test/micro-fe.test.js`（顶部 import + 新增测试）

- [ ] **Step 1：写失败测试**

在 `simple-qiankun/test/micro-fe.test.js` 顶部 import 行改为：

```js
import { MicroFrontend, MicroApp, resolvePreparedStatus } from '../src/micro-fe/app-manager.js';
```

在文件末尾追加：

```js
test('MicroApp is exported and initialises with correct defaults', () => {
  assert.equal(typeof MicroApp, 'function');
  const app = new MicroApp({
    name: 'test-app',
    entry: 'http://localhost/test.html',
    container: '#container',
    props: { foo: 'bar' },
  });
  assert.equal(app.name, 'test-app');
  assert.equal(app.status, 'NOT_LOADED');
  assert.deepEqual(app.props, { foo: 'bar' });
});
```

- [ ] **Step 2：运行测试确认失败**

```bash
cd /Users/youxingzhi/ayou/micro-fe-demo/simple-qiankun
node --test
```

预期：`SyntaxError: The requested module ... does not provide an export named 'MicroApp'`（或类似导入错误）。

- [ ] **Step 3：导出 MicroApp**

在 `simple-qiankun/src/micro-fe/app-manager.js` 的最后一行（`function escapeHtml` 之后）追加：

```js
export { MicroApp };
```

- [ ] **Step 4：更新 index.js**

将 `simple-qiankun/src/micro-fe/index.js` 改为：

```js
import { MicroFrontend } from './app-manager.js';

const microFrontend = new MicroFrontend();

export const registerMicroApps = microFrontend.registerMicroApps.bind(microFrontend);
export const start = microFrontend.start.bind(microFrontend);
export const prefetchApps = microFrontend.prefetchApps.bind(microFrontend);

export { MicroFrontend, MicroApp } from './app-manager.js';
```

- [ ] **Step 5：运行测试确认全部通过**

```bash
cd /Users/youxingzhi/ayou/micro-fe-demo/simple-qiankun
node --test
```

预期：所有测试 PASS，包括新增的 `MicroApp is exported...` 测试。

- [ ] **Step 6：将 simple-qiankun 注册为 @micro-fe/core**

将 `simple-qiankun/package.json` 改为：

```json
{
  "name": "@micro-fe/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/micro-fe/index.js"
  },
  "scripts": {
    "dev": "node scripts/dev-server.js",
    "test": "node --test"
  }
}
```

- [ ] **Step 7：在根目录重新安装以更新链接**

```bash
cd /Users/youxingzhi/ayou/micro-fe-demo
pnpm install
```

预期：`node_modules/@micro-fe/core` 指向 `simple-qiankun/`。

- [ ] **Step 8：commit**

```bash
git add simple-qiankun/package.json simple-qiankun/src/micro-fe/app-manager.js simple-qiankun/src/micro-fe/index.js simple-qiankun/test/micro-fe.test.js
git commit -m "feat: export MicroApp from @micro-fe/core"
```

---

## Task 3：nginx + micro-apps 目录

**Files:**
- Create: `micro-apps/.gitkeep`
- Create: `nginx/nginx.conf.template`

- [ ] **Step 1：创建 micro-apps 目录**

```bash
mkdir -p /Users/youxingzhi/ayou/micro-fe-demo/micro-apps
touch /Users/youxingzhi/ayou/micro-fe-demo/micro-apps/.gitkeep
```

- [ ] **Step 2：创建 nginx 配置模板**

新建 `nginx/nginx.conf.template`：

```nginx
worker_processes 1;
error_log /tmp/micro-fe-nginx-error.log;
pid /tmp/micro-fe-nginx.pid;

events {
  worker_connections 64;
}

http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  access_log /tmp/micro-fe-nginx-access.log;

  server {
    listen 8080;
    root MICRO_FE_ROOT/micro-apps;

    location / {
      add_header Access-Control-Allow-Origin *;
      add_header Access-Control-Allow-Methods "GET, OPTIONS";
      if ($request_method = OPTIONS) { return 204; }
      try_files $uri $uri/ =404;
    }
  }
}
```

`MICRO_FE_ROOT` 是占位符，由启动脚本替换为绝对路径。

- [ ] **Step 3：创建启动脚本**

新建 `nginx/start.sh`：

```bash
#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONF=/tmp/micro-fe-nginx.conf
sed "s|MICRO_FE_ROOT|${ROOT}|g" "${ROOT}/nginx/nginx.conf.template" > "$CONF"
nginx -c "$CONF"
echo "nginx started on http://localhost:8080 (root: ${ROOT}/micro-apps)"
```

```bash
chmod +x /Users/youxingzhi/ayou/micro-fe-demo/nginx/start.sh
```

- [ ] **Step 4：验证 nginx 配置语法**

```bash
cd /Users/youxingzhi/ayou/micro-fe-demo
bash nginx/start.sh
```

预期：终端输出 `nginx started on http://localhost:8080`，无报错。

```bash
curl -I http://localhost:8080/
```

预期：返回 `404`（`micro-apps/` 目前是空的，但 nginx 已正常响应）。

```bash
# 停止测试
nginx -s stop -p /tmp 2>/dev/null || true
```

- [ ] **Step 5：commit**

```bash
git add micro-apps/.gitkeep nginx/
git commit -m "feat: add micro-apps dir and nginx static server"
```

---

## Task 4：rn_demo web 构建基础设施

**Files:**
- Modify: `rn_demo/package.json`
- Create: `rn_demo/web/vite.base.config.js`
- Create: `rn_demo/web/task-list.config.js`

- [ ] **Step 1：添加 web 构建依赖**

在 `rn_demo/package.json` 中添加（保留原有字段，只新增）：

```json
{
  "name": "rn-demo-client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "node_modules/expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "ios": "expo start --ios",
    "android": "expo start --android",
    "test": "node --test",
    "build:web:task-list": "vite build --config web/task-list.config.js",
    "build:web": "pnpm build:web:task-list",
    "dev:web:task-list": "vite build --config web/task-list.config.js --watch",
    "dev:web": "pnpm dev:web:task-list"
  },
  "dependencies": {
    "expo": "53.0.27",
    "react": "19.0.0",
    "react-native": "0.79.6"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "react-dom": "^19.0.0",
    "react-native-web": "^0.20.0",
    "vite": "^6.3.5"
  }
}
```

```bash
cd /Users/youxingzhi/ayou/micro-fe-demo
pnpm install
```

预期：`rn_demo/node_modules/vite/` 和 `rn_demo/node_modules/react-native-web/` 存在。

- [ ] **Step 2：创建 Vite 配置工厂**

新建 `rn_demo/web/vite.base.config.js`：

```js
import react from '@vitejs/plugin-react';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createWebConfig(name, entryFromRnDemoRoot) {
  const outDir = resolve(__dirname, '../../micro-apps', name);

  return {
    plugins: [
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
    build: {
      lib: {
        entry: resolve(__dirname, '..', entryFromRnDemoRoot),
        formats: ['iife'],
        name: toPascalCase(name) + 'App',
      },
      outDir,
      emptyOutDir: true,
      rollupOptions: {
        output: { entryFileNames: `${name}.js` },
      },
    },
  };
}

function toPascalCase(str) {
  return str.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
}
```

- [ ] **Step 3：创建 TaskList Vite 配置（单行）**

新建 `rn_demo/web/task-list.config.js`：

```js
import { createWebConfig } from './vite.base.config.js';
export default createWebConfig('task-list', 'web/entries/task-list.jsx');
```

- [ ] **Step 4：commit（基础设施，尚无可构建的 entry）**

```bash
git add rn_demo/package.json rn_demo/web/
git commit -m "feat: add vite web build infrastructure to rn_demo"
```

---

## Task 5：TaskList web 入口 + 构建验证

**Files:**
- Create: `rn_demo/web/entries/task-list.jsx`

- [ ] **Step 1：创建 TaskList web 入口**

新建 `rn_demo/web/entries/task-list.jsx`：

```jsx
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { TaskList } from '../../src/TaskList';

let root = null;

window.__MICRO_APP_LIFECYCLE__ = {
  async bootstrap() {},

  async mount(context) {
    root = createRoot(context.container);
    root.render(createElement(TaskList, { apiBaseUrl: context.props.apiBaseUrl }));
  },

  async unmount() {
    root?.unmount();
    root = null;
  },
};
```

注意：`../../src/TaskList` 从 `rn_demo/web/entries/` 向上两级到 `rn_demo/src/TaskList.js`，即原始 RN 文件，不做任何修改。

- [ ] **Step 2：运行构建**

```bash
cd /Users/youxingzhi/ayou/micro-fe-demo/rn_demo
pnpm build:web:task-list
```

预期：无报错，输出类似：

```
vite v6.x.x building for production...
✓ 1 modules transformed.
../micro-apps/task-list/task-list.js  xxx kB
```

以及 `write-html-entry` 插件自动生成 `micro-apps/task-list/index.html`。

- [ ] **Step 3：验证产物内容**

```bash
# 确认两个文件存在
ls /Users/youxingzhi/ayou/micro-fe-demo/micro-apps/task-list/

# 确认 JS bundle 包含生命周期
grep -c '__MICRO_APP_LIFECYCLE__' /Users/youxingzhi/ayou/micro-fe-demo/micro-apps/task-list/task-list.js

# 确认 HTML entry 格式正确
cat /Users/youxingzhi/ayou/micro-fe-demo/micro-apps/task-list/index.html
```

预期：
- 输出 `index.html  task-list.js`
- grep 输出 `1`（至少出现一次）
- HTML 内容为 `<div></div>\n<script src="./task-list.js"></script>`

- [ ] **Step 4：验证 nginx 能正确服务产物**

```bash
bash /Users/youxingzhi/ayou/micro-fe-demo/nginx/start.sh
curl http://localhost:8080/task-list/index.html
```

预期：返回 `<div></div>\n<script src="./task-list.js"></script>`（加 CORS 头）。

```bash
curl -I http://localhost:8080/task-list/task-list.js | grep content-type
```

预期：`content-type: application/javascript`（或 `text/javascript`）。

- [ ] **Step 5：commit**

```bash
git add rn_demo/web/entries/task-list.jsx
# micro-apps/ 产物不进 git（构建产物）
git commit -m "feat: add TaskList web entry for react-native-web build"
```

---

## Task 6：h5-pages 集成

**Files:**
- Modify: `h5-pages/package.json`
- Create: `h5-pages/composables/useMicroFrontend.ts`
- Modify: `h5-pages/app/app.vue`
- Create: `h5-pages/.env.development`

- [ ] **Step 1：在 h5-pages 中依赖 @micro-fe/core**

将 `h5-pages/package.json` 的 `dependencies` 改为：

```json
"dependencies": {
  "@micro-fe/core": "workspace:*",
  "nuxt": "^4.4.7",
  "vue": "^3.5.35",
  "vue-router": "^5.1.0"
}
```

```bash
cd /Users/youxingzhi/ayou/micro-fe-demo
pnpm install
```

预期：`h5-pages/node_modules/@micro-fe/core` 是指向 `simple-qiankun/` 的符号链接。

```bash
ls -la /Users/youxingzhi/ayou/micro-fe-demo/h5-pages/node_modules/@micro-fe/core
```

- [ ] **Step 2：创建 .env.development**

新建 `h5-pages/.env.development`：

```
VITE_MICRO_APPS_BASE=http://localhost:8080
```

- [ ] **Step 3：创建 useMicroFrontend composable**

新建 `h5-pages/composables/useMicroFrontend.ts`：

```ts
import { onMounted, onUnmounted } from 'vue'

export function useMicroFrontend(
  name: string,
  containerSelector: string,
  props: Record<string, unknown> = {},
) {
  const base = import.meta.env.VITE_MICRO_APPS_BASE ?? 'http://localhost:8080'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any

  onMounted(async () => {
    // 动态 import 确保只在客户端执行，避免 SSR 中访问 browser API
    const { MicroApp } = await import('@micro-fe/core')
    app = new MicroApp({
      name,
      entry: `${base}/${name}/index.html`,
      container: containerSelector,
      props,
    })
    await app.mount()
  })

  onUnmounted(() => app?.unmount())
}
```

Nuxt 4 会自动从 `composables/` 目录发现并 auto-import，`app.vue` 中无需手动 import。

- [ ] **Step 4：更新 app.vue**

将 `h5-pages/app/app.vue` 改为：

```vue
<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtWelcome />
    <div id="taskList"></div>
  </div>
</template>

<script setup>
const apiBaseUrl = 'http://localhost:3001'

useMicroFrontend('task-list', '#taskList', { apiBaseUrl })
</script>
```

- [ ] **Step 5：启动所有服务，端对端验证**

打开 4 个终端，依次运行：

```bash
# 终端 1：API server
cd /Users/youxingzhi/ayou/micro-fe-demo/server
node src/index.js
# 预期：server listening on port 3001

# 终端 2：TaskList --watch 构建
cd /Users/youxingzhi/ayou/micro-fe-demo/rn_demo
pnpm dev:web:task-list
# 预期：✓ built in Xms，之后进入 watch 模式

# 终端 3：nginx 静态服务
bash /Users/youxingzhi/ayou/micro-fe-demo/nginx/start.sh
# 预期：nginx started on http://localhost:8080

# 终端 4：h5-pages dev server
cd /Users/youxingzhi/ayou/micro-fe-demo/h5-pages
pnpm dev
# 预期：Nuxt ready on http://localhost:3000
```

- [ ] **Step 6：浏览器验证**

打开 `http://localhost:3000`，确认：

1. 页面加载无控制台报错
2. `#taskList` 区域出现 **"Server Tasks"** 标题和 **"Refresh"** 按钮
3. 任务列表从 `http://localhost:3001/api/tasks` 加载并显示 3 条任务
4. 点击 **Refresh** 按钮，列表重新加载（loading 状态短暂出现）
5. 打开 DevTools → Network，确认请求了 `http://localhost:8080/task-list/index.html` 和 `task-list.js`

- [ ] **Step 7：commit**

```bash
git add h5-pages/package.json h5-pages/composables/ h5-pages/app/app.vue h5-pages/.env.development
git commit -m "feat: mount TaskList micro-app into h5-pages via useMicroFrontend"
```

---

## 附：新增组件快速参考（以 Banners 为例）

当需要新增 Banners 组件时，只需 4 步：

1. **新建入口** `rn_demo/web/entries/banners.jsx`（复制 task-list.jsx，换成 `Banners` 组件和对应 props）
2. **新建配置** `rn_demo/web/banners.config.js`：
   ```js
   import { createWebConfig } from './vite.base.config.js';
   export default createWebConfig('banners', 'web/entries/banners.jsx');
   ```
3. **在 package.json 追加 scripts**：
   ```json
   "build:web:banners": "vite build --config web/banners.config.js",
   "dev:web:banners": "vite build --config web/banners.config.js --watch"
   ```
   并在 `build:web` 末尾追加 `&& pnpm build:web:banners`
4. **在目标页面追加一行**（`app.vue` 或其他页面）：
   ```vue
   <div id="banners"></div>
   <!-- 在 <script setup> 中 -->
   useMicroFrontend('banners', '#banners', { /* props */ })
   ```

nginx 和 `@micro-fe/core` 无需任何改动。
