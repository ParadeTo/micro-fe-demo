# RN 组件 → Web 微前端通用设计文档

**日期**：2026-06-09  
**状态**：已批准

## 目标

以 react-native-web 的方式将 RN 组件（首批：TaskList；可扩展至 Banners 等）运行在浏览器中，作为独立微前端子应用挂载到 `h5-pages` 的对应插槽。RN 源码只维护一份，不做任何修改。

## 约束与决策

- **子应用格式**：遵循 simple-qiankun 的 HTML entry 协议（HTML 片段 + `window.__MICRO_APP_LIFECYCLE__`）
- **集成方式**：独立微前端子应用（独立构建、独立部署），不在 h5-pages 内安装 React
- **静态资源服务**：nginx 单独提供，端口 8080，产物目录 `micro-apps/`（与 simple-qiankun 目录解耦）
- **代码复用**：simple-qiankun 的 loader + MicroApp 通过 pnpm workspace 共享给 h5-pages

## 目录结构变更

```
micro-fe-demo/
  package.json               ← 新增：pnpm workspace root
  micro-apps/                ← 新增：nginx 静态文件根目录
    task-list/
      index.html             ← HTML 片段 entry
      task-list.js           ← Vite IIFE bundle
    banners/                 ← 未来 Banners 子应用（同结构）
      index.html
      banners.js
  nginx/
    nginx.conf.template      ← 新增：静态文件服务模板配置

  rn_demo/
    src/
      TaskList.js            ← 不改动
      Banners.js             ← 不改动（未来）
      api.js                 ← 不改动
    web/
      vite.base.config.js    ← 新增：共享 Vite 配置工厂
      entries/
        task-list.jsx        ← 新增：TaskList web 入口
        banners.jsx          ← 未来：Banners web 入口（同结构）
    package.json             ← 修改：新增 build:web:* scripts

  simple-qiankun/
    package.json             ← 修改：name 改为 @micro-fe/core
    src/micro-fe/
      app-manager.js         ← 修改：导出 MicroApp 类

  h5-pages/
    package.json             ← 修改：依赖 @micro-fe/core workspace
    app/
      app.vue                ← 修改：用 composable 注册插槽
    composables/
      useMicroFrontend.ts    ← 新增：通用微前端挂载 composable
    .env.development         ← 新增：VITE_MICRO_APPS_BASE=http://localhost:8080
```

## 各部分详细设计

### 1. pnpm Workspace

根目录新增 `package.json`：
```json
{
  "private": true,
  "workspaces": ["simple-qiankun", "h5-pages", "rn_demo", "server"]
}
```

### 2. simple-qiankun 改动

**`package.json`**：`"name": "@micro-fe/core"`，添加 `"exports"` 字段指向 `src/micro-fe/index.js`。

**`src/micro-fe/app-manager.js`**：在文件末尾新增 `export { MicroApp }`，使外部可直接实例化，不经过路由激活逻辑。

**`src/micro-fe/index.js`**：新增 `export { MicroApp }` 透传。

### 3. nginx 配置

**`nginx/nginx.conf`**：
```nginx
events {}

http {
  server {
    listen 8080;
    root /REPLACE_WITH_ABSOLUTE_PATH/micro-apps;

    location / {
      add_header Access-Control-Allow-Origin *;
      add_header Access-Control-Allow-Methods "GET, OPTIONS";
      try_files $uri $uri/ =404;
    }
  }
}
```

nginx 的 `root` 必须是绝对路径。启动前需将 `root` 替换为实际绝对路径，或通过脚本生成 `nginx.conf`：
```sh
sed "s|/REPLACE_WITH_ABSOLUTE_PATH|$(pwd)|g" nginx/nginx.conf.template > /tmp/micro-fe-nginx.conf
nginx -c /tmp/micro-fe-nginx.conf
```
项目提供 `nginx/nginx.conf.template`，`.gitignore` 忽略生成的临时配置文件。

### 4. rn_demo web 构建

#### 共享 Vite 配置工厂

**`web/vite.base.config.js`**：
```js
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function createWebConfig(name, entryFile) {
  const outDir = resolve(__dirname, `../../micro-apps/${name}`)

  return {
    plugins: [
      react(),
      {
        name: 'write-html-entry',
        closeBundle() {
          writeFileSync(
            resolve(outDir, 'index.html'),
            `<div></div>\n<script src="./${name}.js"></script>\n`,
          )
        },
      },
    ],
    resolve: {
      alias: { 'react-native': 'react-native-web' },
    },
    build: {
      lib: {
        entry: resolve(__dirname, '..', entryFile),
        formats: ['iife'],
        name: `${toPascalCase(name)}App`,
      },
      outDir,
      emptyOutDir: true,
      rollupOptions: {
        output: { entryFileNames: `${name}.js` },
      },
    },
  }
}

function toPascalCase(str) {
  return str.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())
}
```

`write-html-entry` 插件在每次构建完成后自动生成 `index.html`，不需要额外脚本。

#### 各组件 web 入口

**`web/entries/task-list.jsx`**：
```jsx
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { TaskList } from '../src/TaskList'

let root = null

window.__MICRO_APP_LIFECYCLE__ = {
  async bootstrap() {},
  async mount(context) {
    root = createRoot(context.container)
    root.render(createElement(TaskList, { apiBaseUrl: context.props.apiBaseUrl }))
  },
  async unmount() {
    root?.unmount()
    root = null
  },
}
```

**`web/entries/banners.jsx`**（未来，结构完全一致）：
```jsx
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Banners } from '../src/Banners'

let root = null

window.__MICRO_APP_LIFECYCLE__ = {
  async bootstrap() {},
  async mount(context) {
    root = createRoot(context.container)
    root.render(createElement(Banners, context.props))
  },
  async unmount() {
    root?.unmount()
    root = null
  },
}
```

#### 各组件 Vite 配置（一行调用）

每个组件只需一个薄配置文件：

**`web/task-list.config.js`**：
```js
import { createWebConfig } from './vite.base.config.js'
export default createWebConfig('task-list', 'web/entries/task-list.jsx')
```

**`web/banners.config.js`**（未来）：
```js
import { createWebConfig } from './vite.base.config.js'
export default createWebConfig('banners', 'web/entries/banners.jsx')
```

#### package.json scripts

```json
"build:web:task-list": "vite build --config web/task-list.config.js",
"build:web:banners":   "vite build --config web/banners.config.js",
"build:web":           "pnpm build:web:task-list && pnpm build:web:banners",
"dev:web:task-list":   "vite build --config web/task-list.config.js --watch",
"dev:web:banners":     "vite build --config web/banners.config.js --watch"
```

**新增 devDependencies**：`vite`, `@vitejs/plugin-react`, `react-native-web`, `react-dom`

### 5. h5-pages 集成

**`package.json`** 新增依赖：
```json
"dependencies": {
  "@micro-fe/core": "workspace:*"
}
```

**`.env.development`**：
```
VITE_MICRO_APPS_BASE=http://localhost:8080
```

#### 通用 composable

**`composables/useMicroFrontend.ts`**：
```ts
import { MicroApp } from '@micro-fe/core'
import { onMounted, onUnmounted } from 'vue'

export function useMicroFrontend(
  name: string,
  container: string,
  props: Record<string, unknown> = {},
) {
  const base = import.meta.env.VITE_MICRO_APPS_BASE ?? 'http://localhost:8080'
  let app: InstanceType<typeof MicroApp> | undefined

  onMounted(async () => {
    app = new MicroApp({ name, entry: `${base}/${name}/index.html`, container, props })
    await app.mount()
  })

  onUnmounted(() => app?.unmount())
}
```

#### app.vue 使用方式

**`app/app.vue`**：
```vue
<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtWelcome />
    <div id="taskList"></div>
    <!-- 未来：<div id="banners"></div> -->
  </div>
</template>

<script setup>
const apiBaseUrl = 'http://localhost:3001'

useMicroFrontend('task-list', '#taskList', { apiBaseUrl })
// 未来新增一行：
// useMicroFrontend('banners', '#banners', { apiBaseUrl })
</script>
```

Nuxt 自动发现 `composables/` 目录，无需手动 import。

### 6. 扩展性：新增组件清单

新增一个 RN 组件（以 Banners 为例）只需 **4 步**，无需改动 nginx / loader / simple-qiankun：

| 步骤 | 文件 | 改动量 |
|------|------|--------|
| ① web 入口 | `rn_demo/web/entries/banners.jsx` | 新建，~15 行，结构固定 |
| ② Vite 配置 | `rn_demo/web/banners.config.js` | 新建，**1 行** |
| ③ 构建 script | `rn_demo/package.json` | 追加 2 行 |
| ④ 插槽注册 | `h5-pages/app/app.vue`（或目标页面） | 追加 1 行 `useMicroFrontend(...)` + 1 个 `<div>` |

## 开发联调流程

| 服务 | 命令 | 端口 |
|------|------|------|
| API server | `cd server && node src/index.js` | 3001 |
| TaskList web 构建 | `cd rn_demo && pnpm dev:web:task-list` | — |
| 静态资源服务 | `nginx -c /tmp/micro-fe-nginx.conf` | 8080 |
| h5-pages | `cd h5-pages && pnpm dev` | 3000 |

改动 `TaskList.js` → Vite --watch 自动重建（< 1s）→ 浏览器手动刷新即可。  
多个组件联调时，各自 `dev:web:xxx` 独立运行，互不影响。

## 技术风险

- **react-native-web 兼容性**：ActivityIndicator 在 RNW 中渲染为 `<div>` + CSS 动画，外观和 RN 有差异，但功能一致。
- **sandbox 与 ReactDOM**：react-native-web 会向 `document.head` 注入 `<style>` 标签，这些样式不受 simple-qiankun CSS scoping 保护。对本 demo 影响有限，生产环境可考虑 Shadow DOM 隔离。
