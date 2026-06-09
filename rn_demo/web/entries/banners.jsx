import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { Banners } from '../../src/Banners';

let root = null;

window.__MICRO_APP_LIFECYCLE__ = {
  async bootstrap() {},

  async mount(context) {
    root = createRoot(context.container);
    root.render(createElement(Banners, { items: context.props.items }));
  },

  async unmount() {
    root?.unmount();
    root = null;
  },
};
