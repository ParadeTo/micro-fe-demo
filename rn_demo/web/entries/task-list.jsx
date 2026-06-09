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
