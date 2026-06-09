import assert from 'node:assert/strict';
import test from 'node:test';

import { scopeCss } from '../src/micro-fe/css-scope.js';
import { MicroFrontend, MicroApp, resolvePreparedStatus } from '../src/micro-fe/app-manager.js';
import { matchActiveRule } from '../src/micro-fe/router.js';
import { createSandbox } from '../src/micro-fe/sandbox.js';

test('matchActiveRule supports string prefixes and custom functions', () => {
  assert.equal(matchActiveRule('#/sales', '#/sales/overview'), true);
  assert.equal(matchActiveRule('#/sales', '#/settings'), false);
  assert.equal(matchActiveRule((route) => route.includes('analytics'), '#/analytics'), true);
});

test('scopeCss prefixes normal selectors and keeps keyframes global', () => {
  const css = `
    .title, button:hover { color: tomato; }
    @media (min-width: 700px) { .card { display: grid; } }
    @keyframes pulse { from { opacity: 0; } to { opacity: 1; } }
  `;

  const scoped = scopeCss(css, 'sales');

  assert.match(scoped, /\[data-micro-app="sales"\] \.title/);
  assert.match(scoped, /\[data-micro-app="sales"\] button:hover/);
  assert.match(scoped, /@media \(min-width: 700px\) \{ \[data-micro-app="sales"\] \.card/);
  assert.match(scoped, /@keyframes pulse/);
});

test('createSandbox keeps app globals away from the host window', () => {
  const hostWindow = {
    existing: 41,
    location: { hash: '#/sales' },
  };
  const sandbox = createSandbox('sales', hostWindow);

  sandbox.exec('window.answer = existing + 1; leaked = "sandboxed";');

  assert.equal(hostWindow.answer, undefined);
  assert.equal(hostWindow.leaked, undefined);
  assert.equal(sandbox.proxy.answer, 42);
  assert.equal(sandbox.proxy.leaked, 'sandboxed');
  assert.equal(sandbox.proxy.location.hash, '#/sales');
});

test('createSandbox exposes lifecycle registered by a micro app script', async () => {
  const sandbox = createSandbox('profile', {});
  sandbox.exec(`
    window.__MICRO_APP_LIFECYCLE__ = {
      async bootstrap() {
        window.bootstrapped = true;
      },
      async mount(context) {
        context.container.text = context.props.label;
      },
      async unmount() {
        window.unmounted = true;
      }
    };
  `);

  const lifecycle = sandbox.proxy.__MICRO_APP_LIFECYCLE__;
  const container = {};

  await lifecycle.bootstrap();
  await lifecycle.mount({ container, props: { label: 'demo app' } });
  await lifecycle.unmount();

  assert.equal(sandbox.proxy.bootstrapped, true);
  assert.equal(container.text, 'demo app');
  assert.equal(sandbox.proxy.unmounted, true);
});

test('reroute does not mount the same app twice while mount is in flight', async () => {
  const originalWindow = globalThis.window;
  let releaseMount;
  const mountCanFinish = new Promise((resolve) => {
    releaseMount = resolve;
  });
  const microFrontend = new MicroFrontend();
  const app = {
    activeRule: '#/sales',
    mountCalls: 0,
    status: 'NOT_MOUNTED',
    async mount() {
      this.mountCalls += 1;
      this.status = 'MOUNTING';
      await mountCanFinish;
      this.status = 'MOUNTED';
    },
    async unmount() {},
  };

  globalThis.window = {
    location: { hash: '#/sales' },
  };
  microFrontend.apps = [app];

  let firstReroute;
  let secondReroute;

  try {
    firstReroute = microFrontend.reroute();
    secondReroute = microFrontend.reroute();

    await Promise.resolve();

    assert.equal(app.mountCalls, 1);

    releaseMount();
    await Promise.all([firstReroute, secondReroute]);
    assert.equal(app.status, 'MOUNTED');
  } finally {
    releaseMount();
    await Promise.allSettled([firstReroute, secondReroute]);

    if (originalWindow) {
      globalThis.window = originalWindow;
    } else {
      delete globalThis.window;
    }
  }
});

test('reroute unmounts inactive apps before mounting newly active apps', async () => {
  const originalWindow = globalThis.window;
  const calls = [];
  const microFrontend = new MicroFrontend();
  const salesApp = {
    activeRule: '#/sales',
    status: 'NOT_MOUNTED',
    async mount() {
      calls.push('sales:mount');
      this.status = 'MOUNTED';
    },
    async unmount() {},
  };
  const profileApp = {
    activeRule: '#/profile',
    status: 'MOUNTED',
    async mount() {},
    async unmount() {
      calls.push('profile:unmount');
      this.status = 'NOT_MOUNTED';
    },
  };

  globalThis.window = {
    location: { hash: '#/sales' },
  };
  microFrontend.apps = [salesApp, profileApp];

  try {
    await microFrontend.reroute();
    assert.deepEqual(calls, ['profile:unmount', 'sales:mount']);
  } finally {
    if (originalWindow) {
      globalThis.window = originalWindow;
    } else {
      delete globalThis.window;
    }
  }
});

test('resolvePreparedStatus does not downgrade mounting or mounted apps', () => {
  assert.equal(resolvePreparedStatus('NOT_LOADED'), 'NOT_MOUNTED');
  assert.equal(resolvePreparedStatus('MOUNTING'), 'MOUNTING');
  assert.equal(resolvePreparedStatus('MOUNTED'), 'MOUNTED');
});

test('MicroApp is exported and initialises with correct defaults', () => {
  assert.equal(typeof MicroApp, 'function');

  // MicroApp constructor references `window`; provide a minimal stub for Node test env
  const originalWindow = globalThis.window;
  globalThis.window = globalThis;
  try {
    const app = new MicroApp({
      name: 'test-app',
      entry: 'http://localhost/test.html',
      container: '#container',
      props: { foo: 'bar' },
    });
    assert.equal(app.name, 'test-app');
    assert.equal(app.status, 'NOT_LOADED');
    assert.deepEqual(app.props, { foo: 'bar' });
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});
