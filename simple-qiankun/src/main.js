import { registerMicroApps, start } from './micro-fe/index.js';

const lifecycleLog = document.querySelector('#lifecycle-log');
const currentRoute = document.querySelector('#current-route');
const navLinks = [...document.querySelectorAll('[data-route]')];

window.hostLog = function hostLog(message) {
  const item = document.createElement('li');
  item.textContent = `${new Date().toLocaleTimeString()} ${message}`;
  lifecycleLog.prepend(item);
};

function syncRouteUi() {
  const route = window.location.hash || '#/sales';
  currentRoute.textContent = route;

  for (const link of navLinks) {
    link.toggleAttribute('aria-current', link.dataset.route === route);
  }
}

window.addEventListener('hashchange', syncRouteUi);

registerMicroApps([
  {
    name: 'sales',
    entry: '/apps/sales.html',
    container: '#micro-container',
    activeRule: '#/sales',
    props: {
      title: 'North Region Pipeline',
    },
  },
  {
    name: 'profile',
    entry: '/apps/profile.html',
    container: '#micro-container',
    activeRule: '#/profile',
    props: {
      user: 'Ada Chen',
    },
  },
]);

if (!window.location.hash) {
  window.location.hash = '#/sales';
}

syncRouteUi();
start({ prefetch: true });
