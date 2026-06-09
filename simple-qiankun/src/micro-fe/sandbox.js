export function createSandbox(name, rawWindow = globalThis) {
  const sandboxWindow = Object.create(null);
  let proxy;

  proxy = new Proxy(sandboxWindow, {
    get(target, key) {
      if (key === Symbol.unscopables) {
        return undefined;
      }

      if (key === 'window' || key === 'self' || key === 'globalThis') {
        return proxy;
      }

      if (key === '__MICRO_APP_NAME__') {
        return name;
      }

      if (key in target) {
        return target[key];
      }

      const value = rawWindow[key];
      if (typeof value !== 'function') return value;
      // .bind() drops static properties (e.g. Symbol.for, Promise.resolve).
      // Wrap so the bound call goes to rawWindow while property lookups hit the original.
      const bound = Function.prototype.bind.call(value, rawWindow);
      return new Proxy(bound, {
        get(_, prop) {
          return Reflect.get(value, prop);
        },
      });
    },

    set(target, key, value) {
      target[key] = value;
      return true;
    },

    has() {
      return true;
    },

    deleteProperty(target, key) {
      delete target[key];
      return true;
    },
  });

  return {
    name,
    proxy,
    exec(code, sourceUrl = `${name}.js`) {
      const runner = new Function(
        'window',
        'self',
        'globalThis',
        `with (window) {\n${code}\n}\n//# sourceURL=${sourceUrl}`,
      );

      return runner(proxy, proxy, proxy);
    },
    clear() {
      for (const key of Object.keys(sandboxWindow)) {
        delete sandboxWindow[key];
      }
    },
  };
}
