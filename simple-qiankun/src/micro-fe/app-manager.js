import { scopeCss } from './css-scope.js';
import { loadHtmlEntry } from './loader.js';
import { getCurrentRoute, matchActiveRule } from './router.js';
import { createSandbox } from './sandbox.js';

export class MicroFrontend {
  constructor() {
    this.apps = [];
    this.started = false;
    this.rerouteQueue = Promise.resolve();
    this.reroute = this.reroute.bind(this);
  }

  registerMicroApps(apps) {
    this.apps = apps.map((config) => new MicroApp(config));
  }

  start(options = {}) {
    if (this.started) {
      return;
    }

    this.started = true;
    window.addEventListener('hashchange', this.reroute);
    window.addEventListener('popstate', this.reroute);
    window.addEventListener('load', this.reroute);

    if (options.prefetch) {
      window.setTimeout(() => this.prefetchApps(), 0);
    }

    return this.reroute();
  }

  async reroute() {
    const task = this.rerouteQueue.then(
      () => this.performReroute(),
      () => this.performReroute(),
    );
    this.rerouteQueue = task.catch(() => {});
    return task;
  }

  async performReroute() {
    const route = getCurrentRoute(window.location);
    const decisions = this.apps.map((app) => ({
      app,
      shouldBeActive: matchActiveRule(app.activeRule, route),
    }));

    for (const { app, shouldBeActive } of decisions) {
      if (!shouldBeActive && app.status === 'MOUNTED') {
        await app.unmount();
      }
    }

    for (const { app, shouldBeActive } of decisions) {
      if (shouldBeActive && isMountableStatus(app.status)) {
        await app.mount(route);
      }
    }
  }

  async prefetchApps() {
    await Promise.all(this.apps.map((app) => app.prepare()));
  }
}

function isMountableStatus(status) {
  return status === 'NOT_LOADED' || status === 'NOT_MOUNTED' || status === 'LOAD_ERROR';
}

export function resolvePreparedStatus(status) {
  return status === 'NOT_LOADED' ? 'NOT_MOUNTED' : status;
}

class MicroApp {
  constructor(config) {
    this.name = config.name;
    this.entry = config.entry;
    this.container = config.container;
    this.activeRule = config.activeRule;
    this.props = config.props || {};
    this.status = 'NOT_LOADED';
    this.bootstrapped = false;
    this.assets = null;
    this.loadPromise = null;
    this.lifecycle = null;
    this.sandbox = createSandbox(config.name, window);
    this.styleElements = [];
    this.root = null;
  }

  async prepare() {
    if (!this.assets) {
      this.loadPromise ||= loadHtmlEntry(this.entry);

      try {
        this.assets = await this.loadPromise;
        this.status = resolvePreparedStatus(this.status);
      } catch (error) {
        this.loadPromise = null;
        throw error;
      }
    }

    return this.assets;
  }

  async mount(route) {
    this.status = 'MOUNTING';

    try {
      const assets = await this.prepare();
      const container = resolveContainer(this.container);

      container.innerHTML = `<section class="micro-app-root" data-micro-app="${this.name}">${assets.template}</section>`;
      this.root = container.querySelector(`[data-micro-app="${this.name}"]`);
      this.injectStyles(assets.styles);

      if (!this.lifecycle) {
        for (const script of assets.scripts) {
          this.sandbox.exec(script.code, script.sourceUrl);
        }

        this.lifecycle = this.sandbox.proxy.__MICRO_APP_LIFECYCLE__;
      }

      validateLifecycle(this.name, this.lifecycle);

      if (!this.bootstrapped && this.lifecycle.bootstrap) {
        await this.lifecycle.bootstrap(this.createContext(route));
        this.bootstrapped = true;
      }

      await this.lifecycle.mount(this.createContext(route));
      this.status = 'MOUNTED';
    } catch (error) {
      this.status = 'LOAD_ERROR';
      this.renderError(error);
      throw error;
    }
  }

  async unmount() {
    this.status = 'UNMOUNTING';

    if (this.lifecycle?.unmount) {
      await this.lifecycle.unmount(this.createContext(getCurrentRoute(window.location)));
    }

    for (const element of this.styleElements) {
      element.remove();
    }

    this.styleElements = [];
    resolveContainer(this.container).innerHTML = '';
    this.root = null;
    this.status = 'NOT_MOUNTED';
  }

  createContext(route) {
    return {
      name: this.name,
      container: this.root,
      props: this.props,
      route,
      sandbox: this.sandbox.proxy,
    };
  }

  injectStyles(styles) {
    for (const cssText of styles) {
      const element = document.createElement('style');
      element.dataset.microAppStyle = this.name;
      element.textContent = scopeCss(cssText, this.name);
      document.head.appendChild(element);
      this.styleElements.push(element);
    }
  }

  renderError(error) {
    const container = resolveContainer(this.container);
    container.innerHTML = `
      <section class="micro-app-error">
        <h2>${this.name} failed to load</h2>
        <pre>${escapeHtml(error.message)}</pre>
      </section>
    `;
  }
}

function resolveContainer(container) {
  const element = typeof container === 'string' ? document.querySelector(container) : container;

  if (!element) {
    throw new Error(`Micro app container was not found: ${container}`);
  }

  return element;
}

function validateLifecycle(name, lifecycle) {
  if (!lifecycle || typeof lifecycle.mount !== 'function') {
    throw new Error(`${name} must expose window.__MICRO_APP_LIFECYCLE__.mount`);
  }
}

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
