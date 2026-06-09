import assert from 'node:assert/strict';
import test from 'node:test';

import { createApiServer } from '../src/app.js';

test('GET /api/health returns server status', async () => {
  const server = await listenForTest();

  try {
    const response = await fetch(server.url('/api/health'));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.service, 'rn-demo-api');
  } finally {
    await server.close();
  }
});

test('GET /api/tasks returns demo tasks', async () => {
  const server = await listenForTest();

  try {
    const response = await fetch(server.url('/api/tasks'));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(Array.isArray(body.tasks), true);
    assert.equal(body.tasks.length > 0, true);
    assert.deepEqual(Object.keys(body.tasks[0]).sort(), ['done', 'id', 'title']);
  } finally {
    await server.close();
  }
});

test('OPTIONS request returns CORS headers', async () => {
  const server = await listenForTest();

  try {
    const response = await fetch(server.url('/api/tasks'), { method: 'OPTIONS' });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    assert.match(response.headers.get('access-control-allow-methods'), /GET/);
  } finally {
    await server.close();
  }
});

async function listenForTest() {
  const instance = createApiServer();

  await new Promise((resolve) => {
    instance.listen(0, '127.0.0.1', resolve);
  });

  const address = instance.address();

  return {
    url(pathname) {
      return `http://127.0.0.1:${address.port}${pathname}`;
    },
    close() {
      return new Promise((resolve, reject) => {
        instance.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
