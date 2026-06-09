# 多入口 vs 单入口：RN 组件微前端方案对比

**日期**：2026-06-09  
**状态**：探索中（与 `2026-06-09-tasklist-rn-to-web-design.md` 对比阅读）

---

## 核心问题

两个方案的区别在于：**React + react-native-web 这些共享依赖，打几次包、加载几次？**

---

## 方案一：多入口（已有设计）

每个组件独立构建，独立输出：

```
micro-apps/
  task-list/
    bundle.js   ← React(150KB) + RNW(80KB) + TaskList(5KB) = 235KB
  banners/
    bundle.js   ← React(150KB) + RNW(80KB) + Banners(5KB) = 235KB
```

每个 bundle 在各自的 simple-qiankun 沙箱中执行，**完全隔离**。

**优点**
- 独立部署：改 TaskList 只需重新发布 `task-list/`，不影响 Banners
- 故障隔离：一个组件加载失败不波及其他
- 与 simple-qiankun 现有协议完全兼容，无需改动

**缺点**
- 每个 bundle 都包含完整的 React + RNW（约 230KB gzipped），3 个组件就是 690KB
- dev 时需要为每个组件单独跑一个 `--watch` 进程

---

## 方案二：单入口（registry 模式）

所有组件合并到一个 bundle，只打包一次 React + RNW：

```
micro-apps/
  shared/
    rn-components.js  ← React(150KB) + RNW(80KB) + TaskList(5KB) + Banners(5KB) = 240KB
```

### 关键设计问题：沙箱无法共享

simple-qiankun 的每个子应用在独立沙箱（`new Function` + `with(window)`）中执行脚本。
即使两个子应用引用同一个 `rn-components.js`，**它们各自在沙箱里跑一次**，
React + RNW 依然被实例化两次 → **没有实际节省**。

要真正共享，必须**在真实 `window` 作用域（沙箱外）加载一次**，然后通过 `rawWindow` 让所有组件访问。这要求修改 simple-qiankun 或绕过它。

### 单入口的实现路径

**① bundle 设计**

`web/entries/all.jsx`：

```jsx
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { TaskList } from '../src/TaskList'
import { Banners } from '../src/Banners'

const roots = {}

function makeLifecycle(Component) {
  return {
    mount(container, props) {
      roots[container] = createRoot(container)
      roots[container].render(createElement(Component, props))
    },
    unmount(container) {
      roots[container]?.unmount()
      delete roots[container]
    },
  }
}

// 挂到真实 window，所有调用方共享同一个 React 实例
window.__RN_COMPONENTS__ = {
  'task-list': makeLifecycle(TaskList),
  banners:     makeLifecycle(Banners),
}
```

注意：这里 `mount(container, props)` 接收的是 **DOM 元素**，不是 simple-qiankun 的 `context` 对象，
因为我们跳过了 simple-qiankun 的沙箱。

**② 加载方式：绕过 simple-qiankun 沙箱**

h5-pages 的 `useMicroFrontend` 直接通过 `<script>` 标签加载到真实 window，
调用时从 `window.__RN_COMPONENTS__` 取对应组件：

```ts
// composables/useMicroFrontend.ts（单入口版）
const REGISTRY_URL = `${base}/shared/rn-components.js`
let registryLoaded: Promise<void> | null = null

function loadRegistry(): Promise<void> {
  if (registryLoaded) return registryLoaded
  registryLoaded = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = REGISTRY_URL
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load RN components registry'))
    document.head.appendChild(s)
  })
  return registryLoaded
}

export function useMicroFrontend(
  name: string,
  containerSelector: string,
  props: Record<string, unknown> = {},
) {
  onMounted(async () => {
    await loadRegistry()
    const registry = (window as any).__RN_COMPONENTS__
    const el = document.querySelector(containerSelector)
    registry[name].mount(el, props)
  })

  onUnmounted(() => {
    const registry = (window as any).__RN_COMPONENTS__
    const el = document.querySelector(containerSelector)
    registry[name]?.unmount(el)
  })
}
```

第一次调用 `useMicroFrontend` 时加载 bundle，后续调用命中缓存（`registryLoaded` Promise），
React + RNW **真正只加载一次**。

**③ Vite 构建配置（更简单）**

只有一个 config，一个 script：

```js
// web/all.config.js
import { createWebConfig } from './vite.base.config.js'
export default createWebConfig('shared/rn-components', 'web/entries/all.jsx')
```

```json
"build:web": "vite build --config web/all.config.js",
"dev:web":   "vite build --config web/all.config.js --watch"
```

---

## 真实对比（3 个组件场景）

| 维度 | 多入口 | 单入口（registry） |
|------|--------|--------------------|
| 首次总加载量 | 按需：只加载当前页使用的组件 | 必须全量：加载所有组件 |
| 3 组件总 bundle size | ~690KB（每份含完整 React+RNW） | ~250KB（React+RNW 只有一份） |
| 新增一个组件 | 新建 entry + config + 一行 script | 修改 `all.jsx` + 重构建 |
| 独立部署 | ✅ 改一个 → 只发一个 | ❌ 改一个 → 发全部 |
| 故障隔离 | ✅ 一个挂不影响其他 | ❌ bundle 挂 → 所有组件不可用 |
| 沙箱隔离 | ✅ 完整 simple-qiankun 沙箱 | ❌ 跑在真实 window 中 |
| CSS 作用域 | ✅ simple-qiankun 自动 scope | ❌ 需手动处理 |
| 构建复杂度 | 每组件一个 config（1 行） | 一个 config，但 entry 随组件增长 |
| dev 进程数 | N 个 `--watch`（可用 concurrently） | 1 个 `--watch` |

---

## 推荐

| 场景 | 推荐方案 |
|------|----------|
| 组件较多（5+），且同一页面同时展示多个 | 单入口：bundle size 优势明显 |
| 组件各自独立部署（不同团队维护） | 多入口：部署和故障隔离边界清晰 |
| 对沙箱隔离有要求 | 多入口：simple-qiankun 完整沙箱 |
| 快速原型 / demo | 单入口：构建最简单 |
| 本项目当前阶段 | **多入口**：组件数量少，隔离优先 |

---

## 折中方案：共享 vendor + 独立组件 bundle（供参考）

如果未来组件数量增加，可以做"vendor 分离"：

```
micro-apps/
  vendor/
    vendor.js           ← React + RNW（仅此一份，加载到真实 window）
  task-list/
    task-list.js        ← 仅 TaskList 逻辑（React/RNW 标记为 external）
  banners/
    banners.js          ← 仅 Banners 逻辑
```

每个组件的 HTML entry：
```html
<div></div>
<script src="../vendor/vendor.js"></script>   <!-- 浏览器缓存命中后 0 cost -->
<script src="./task-list.js"></script>
```

这样既有多入口的隔离性，又有单入口的依赖共享。
但需要 Vite 配置 `external`，并将 React/RNW 通过 `window.React`/`window.ReactDOM` 暴露。
暂不实现，作为性能优化预留方向。
