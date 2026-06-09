# micro-fe-demo

用 React Native 组件跑在 Web 上的微前端演示项目。RN 源码零修改，通过 `react-native-web` 编译成 IIFE bundle，由自研微前端框架 `@micro-fe/core` 动态加载并隔离运行在 Nuxt 4 宿主应用中。

## 架构概览

```
浏览器 → nginx :8080
           ├── /               → h5-pages 静态站 (Nuxt 4 SSG)
           ├── /banners/       → Banners 微应用 bundle
           ├── /task-list/     → TaskList 微应用 bundle
           └── /api/           → Node.js API 代理 (:3001)
```

详细架构图见 [docs/architecture.md](docs/architecture.md)。

## 目录结构

```
micro-fe-demo/
├── simple-qiankun/   @micro-fe/core — 微前端运行时（沙箱、生命周期、CSS 隔离）
├── rn_demo/          React Native 源码 + Vite web 构建配置
│   ├── src/          RN 组件（不修改）
│   └── web/          Vite 构建入口和配置
├── h5-pages/         Nuxt 4 宿主应用
├── server/           Node.js API 服务
├── micro-apps/       构建产物（由 nginx 托管）
├── nginx/            nginx 配置模板和启动脚本
└── scripts/          构建和启动脚本
```

## 快速开始

### 依赖

- Node.js >= 18
- pnpm >= 10
- nginx 或 openresty（macOS 推荐 `brew install openresty`）

### 安装

```bash
pnpm install
```

### 开发模式

分别启动各服务：

```bash
# 终端 1 — API 服务
cd server && node src/index.js

# 终端 2 — 监听构建微应用 bundle（改动自动重建）
cd rn_demo && pnpm dev:web

# 终端 3 — nginx 静态服务（托管 micro-apps/）
bash nginx/start.sh

# 终端 4 — h5-pages 开发服务器
cd h5-pages && pnpm dev
```

访问 h5-pages 开发服务器地址（默认 http://localhost:3000）。

### 生产构建 & 部署

```bash
# 构建所有产物（micro-app bundles + h5-pages 静态站）
bash scripts/build.sh

# 启动 API 服务 + nginx
bash scripts/start.sh
```

访问 http://localhost:8080。

## 微应用

| 应用 | 源码 | 入口 | 说明 |
|------|------|------|------|
| `banners` | `rn_demo/src/Banners.js` | `rn_demo/web/entries/banners.jsx` | 横向滚动促销卡片，props 传入数据 |
| `task-list` | `rn_demo/src/TaskList.js` | `rn_demo/web/entries/task-list.jsx` | 从 `/api/tasks` 拉取并展示任务列表 |

### 新增微应用

1. `rn_demo/src/MyWidget.js` — 编写 RN 组件
2. `rn_demo/web/entries/my-widget.jsx` — 实现生命周期入口

   ```jsx
   import { createElement } from 'react';
   import { createRoot } from 'react-dom/client';
   import { MyWidget } from '../../src/MyWidget';

   let root = null;
   window.__MICRO_APP_LIFECYCLE__ = {
     async bootstrap() {},
     async mount(context) {
       root = createRoot(context.container);
       root.render(createElement(MyWidget, context.props));
     },
     async unmount() {
       root?.unmount();
       root = null;
     },
   };
   ```

3. `rn_demo/web/my-widget.config.js` — 一行配置

   ```js
   import { createWebConfig } from './vite.base.config.js';
   export default createWebConfig('my-widget', 'web/entries/my-widget.jsx');
   ```

4. `rn_demo/package.json` — 加构建脚本

   ```json
   "build:web:my-widget": "vite build --config web/my-widget.config.js"
   ```

5. `h5-pages/app/app.vue` — 挂载到插槽

   ```vue
   <div id="myWidget"></div>

   <script setup>
   useMicroFrontend({
     name: 'my-widget',
     entry: `${config.public.microAppsBase}/my-widget/index.html`,
     container: '#myWidget',
   });
   </script>
   ```

6. 重新构建部署

   ```bash
   bash scripts/build.sh && bash scripts/start.sh
   ```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/tasks` | 任务列表 |
| GET | `/api/profile` | 用户信息 |

## 未来优化方向

### 1. 共享依赖，减小 bundle 体积

当前每个微应用都把 React + react-native-web 打进自己的 IIFE bundle，单个 ~650 KB。多个子应用并存时重复下载。

**方向**：利用 [Import Maps](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap) 把 React 提升为宿主提供的全局共享模块：

```html
<!-- h5-pages index.html -->
<script type="importmap">
{
  "imports": {
    "react": "/shared/react.js",
    "react-dom/client": "/shared/react-dom-client.js",
    "react-native-web": "/shared/react-native-web.js"
  }
}
</script>
```

Vite 构建时配置 `build.rollupOptions.external`，bundle 体积可从 650 KB 降至 ~30 KB。

---

### 2. 内容哈希 + 长效缓存

当前产物文件名固定（`task-list.js`），部署新版本后浏览器可能命中旧缓存。

**方向**：Vite 输出带内容哈希的文件名，`index.html` 始终是最新引用：

```js
// vite.base.config.js
rollupOptions: {
  output: { entryFileNames: `${name}.[hash].js` },
}
```

`write-html-entry` 插件同步写入带哈希的文件名，nginx 对 `index.html` 设 `no-cache`，JS 文件设长效缓存（`max-age=31536000, immutable`）。

---

### 3. 预加载，消除首屏白屏

当前 `MicroApp.mount()` 在 `onMounted` 时才开始 fetch bundle，用户能感知加载延迟。

**方向**：在宿主页面 `<head>` 提前注入 `<link rel="preload">`，或在 Vue 应用启动前调用 `prefetchApps()`（`@micro-fe/core` 已有此接口）：

```ts
// app.vue
await prefetchApps([
  { name: 'banners', entry: `${base}/banners/index.html` },
  { name: 'task-list', entry: `${base}/task-list/index.html` },
]);
```

bundle 在网络空闲期下载，mount 时直接从缓存读取。

---

### 4. 骨架屏 / 加载占位

当前子应用加载期间容器为空，体验割裂。

**方向**：在 `useMicroFrontend` 中增加 `loading` 状态，宿主侧渲染占位骨架，mount 完成后替换：

```ts
const { loading, error } = useMicroFrontend({ name, entry, container });
```

---

### 5. 子应用间通信

当前子应用完全隔离，无法互相传递事件（例如 Banners 点击触发 TaskList 刷新）。

**方向**：在宿主实现一个发布订阅总线，通过 `props` 注入给子应用：

```ts
// 宿主
const bus = createEventBus();
useMicroFrontend({ props: { eventBus: bus } });

// 子应用 lifecycle
mount(context) {
  context.props.eventBus.on('refresh', () => { ... });
}
```

也可以复用浏览器原生 `CustomEvent` + `window.dispatchEvent`，无需额外抽象。

---

### 6. 沙箱增强

当前沙箱通过 `with(proxy)` + `has() → true` 拦截变量查找，但无法阻止子应用通过原型链或闭包逃逸访问宿主全局。

**方向**：
- **Shadow DOM**：将子应用渲染在 Shadow DOM 内，天然隔离 CSS，无需 `scopeCss`
- **iframe 沙箱**：强隔离场景下用 `<iframe sandbox>` 替代 `with(proxy)`，通过 `postMessage` 通信
- **严格模式检查**：在 `exec` 中开启 `'use strict'`，阻止对未声明变量的写入

---

### 7. 服务端渲染（SSR）支持

当前微应用只能在客户端挂载（`onMounted`），首屏 HTML 中没有子应用内容，不利于 SEO 和首屏性能。

**方向**：在宿主 SSR 阶段，用 Node.js 版的 `react-dom/server` 将子应用渲染成 HTML 字符串直接插入响应，客户端再 hydrate。需要在 `@micro-fe/core` 增加 `renderToString` 模式。

---

### 8. 类型安全的 Props 契约

当前宿主和子应用之间通过 `props: Record<string, unknown>` 传递数据，无类型检查，重构时容易出错。

**方向**：为每个微应用定义 Props 类型声明文件并发布为独立包，宿主和子应用共同引用：

```ts
// @micro-fe/task-list-types
export interface TaskListProps {
  apiBaseUrl: string;
}
```

## 技术要点

**JSX in .js 文件**：RN 约定用 `.js` 写 JSX。Vite 的 rollup import analysis 不识别，通过 `enforce: 'pre'` 的自定义插件用 `transformWithEsbuild` 提前转换。

**沙箱 CSS 隔离**：子应用 HTML 入口中的 `<style>/<link>` 被提取成纯文本，注入宿主前由 `scopeCss` 给所有选择器加 `[data-micro-app="name"]` 前缀，unmount 时移除。

**Symbol.for / 静态方法丢失**：沙箱 `get` 对函数做 `.bind(rawWindow)` 会丢失 `Symbol.for`、`Promise.resolve` 等静态方法。修复方案：返回 `Proxy(bound, { get: (_, p) => Reflect.get(original, p) })`。

**process 未定义**：浏览器没有 `process`，沙箱的 `has()` 总返回 `true` 导致 `process` 走 proxy 查到 `undefined`。双重修复：Vite `define` 在构建时替换，沙箱初始化时注入 `process` polyfill。
