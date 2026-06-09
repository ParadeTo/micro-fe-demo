export function getCurrentRoute(locationLike = window.location) {
  return locationLike.hash || locationLike.pathname || '/';
}

export function matchActiveRule(activeRule, route) {
  if (typeof activeRule === 'function') {
    return Boolean(activeRule(route));
  }

  if (activeRule instanceof RegExp) {
    return activeRule.test(route);
  }

  if (typeof activeRule === 'string') {
    const normalized = activeRule.endsWith('/') ? activeRule : `${activeRule}/`;
    return route === activeRule || route.startsWith(normalized);
  }

  return false;
}
