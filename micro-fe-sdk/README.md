# Mini Qiankun Demo

这是一个无依赖的教学版微前端框架，用来讲清楚 qiankun 的核心原理。它不是生产框架，但保留了微前端运行时最关键的几条链路：

- 主应用注册子应用
- 根据路由匹配激活子应用
- 通过 HTML Entry 拉取子应用资源
- 执行 `bootstrap`、`mount`、`unmount` 生命周期
- 用 `Proxy` 模拟 JS 沙箱
- 对子应用 CSS 做简单选择器前缀隔离

## 运行

```bash
npm run dev
```

打开：

```text
http://localhost:4173
```

测试：

```bash
npm test
```

## 文件导览

```text
index.html                  主应用页面
src/main.js                 主应用注册两个子应用并启动框架
apps/sales.html             子应用 A 的 HTML Entry
apps/profile.html           子应用 B 的 HTML Entry

src/micro-fe/index.js       框架公开 API
src/micro-fe/app-manager.js 子应用调度、生命周期、挂载和卸载
src/micro-fe/loader.js      拉取并解析 HTML Entry
src/micro-fe/router.js      路由匹配
src/micro-fe/sandbox.js     Proxy 沙箱
src/micro-fe/css-scope.js   CSS 选择器作用域改写
```

## 主应用如何使用

```js
import { registerMicroApps, start } from './micro-fe/index.js';

registerMicroApps([
  {
    name: 'sales',
    entry: '/apps/sales.html',
    container: '#micro-container',
    activeRule: '#/sales',
    props: { title: 'North Region Pipeline' },
  },
]);

start({ prefetch: true });
```

这和 qiankun 的使用方式类似：主应用只描述“有哪些子应用、从哪里加载、挂到哪里、什么时候激活”。

## 子应用如何暴露生命周期

每个子应用是一个 HTML 文件，里面可以包含模板、样式和脚本。脚本向沙箱里的 `window` 写入生命周期对象：

```js
window.__MICRO_APP_LIFECYCLE__ = {
  async bootstrap(context) {},
  async mount(context) {},
  async unmount(context) {},
};
```

框架第一次加载子应用时执行脚本，拿到生命周期对象。路由命中时调用 `mount`，离开路由时调用 `unmount`。

## 核心原理

### 1. 注册表

`registerMicroApps` 把配置转换成内部的 `MicroApp` 实例。框架运行时只围绕这张注册表做三件事：

- 当前路由是否匹配 `activeRule`
- 匹配时是否需要加载并挂载
- 不匹配时是否需要卸载

### 2. 路由驱动

`start` 监听 `hashchange`、`popstate` 和 `load`，每次变化都执行 `reroute`。这里 demo 用 hash 路由：

```js
activeRule: '#/sales'
```

当地址是 `#/sales` 或 `#/sales/overview` 时，`sales` 子应用会被激活。

### 3. HTML Entry

`loader.js` 用 `fetch` 拉取子应用 HTML，然后用 `DOMParser` 拆出三类资源：

- `template`：去掉脚本和样式后的 HTML
- `styles`：内联或外链 CSS
- `scripts`：内联或外链 JS

挂载时，框架先把 `template` 放进主应用指定的容器，再执行脚本拿生命周期。

### 4. 生命周期

`app-manager.js` 中的顺序是：

```text
prepare assets -> render template -> inject styles -> exec scripts -> bootstrap -> mount
```

离开路由时：

```text
unmount -> remove styles -> clear container
```

`bootstrap` 只会执行一次，`mount` 和 `unmount` 会随着路由切换重复执行。

### 5. JS 沙箱

`sandbox.js` 用 `Proxy` 做了一个假的 `window`：

```js
const sandbox = createSandbox('sales', window);
sandbox.exec('window.demoGlobal = 1');
```

子应用写入的 `window.demoGlobal` 实际保存在代理对象上，不会污染主应用真实的 `window`。如果子应用读取 `location`、`setTimeout` 等浏览器 API，代理会从真实 `window` 兜底读取。

可以切换 `Sales` 和 `Profile` 看页面上的 `Sandbox Global`。两个子应用都写 `window.demoGlobal`，但值互不影响。

### 6. CSS 隔离

`css-scope.js` 会把子应用选择器改写成带作用域的选择器：

```css
.title {
  color: red;
}
```

变成：

```css
[data-micro-app="sales"] .title {
  color: red;
}
```

所以两个子应用都可以使用 `.title`、`.metric`、`.app-shell` 这样的同名 class，而不会互相覆盖。

## 和 qiankun 的差距

这个 demo 只保留原理，不覆盖生产复杂度：

- 没有处理复杂 CSS 语法、CSS Modules、Shadow DOM 等高级样式隔离场景
- JS 沙箱没有完整模拟多实例、快照沙箱、严格模式边界和所有浏览器全局对象细节
- 没有资源预加载优先级、错误重试、性能统计和通信总线
- 没有支持 webpack、Vite、React、Vue 等框架的真实构建产物约定

讲解时可以把它当作 qiankun 的最小骨架：真实 qiankun 做得更严密，但核心路径就是注册、匹配、加载、沙箱、生命周期和卸载。
