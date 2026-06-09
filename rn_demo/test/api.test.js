import assert from 'node:assert/strict';
import test from 'node:test';

import { loadDashboard, normalizeApiBaseUrl } from '../src/api.js';

test('normalizeApiBaseUrl removes trailing slashes', () => {
  assert.equal(normalizeApiBaseUrl('http://localhost:3001///'), 'http://localhost:3001');
});

test('loadDashboard fetches profile and tasks', async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);

    if (url.endsWith('/api/profile')) {
      return jsonResponse({ profile: { name: 'Ada', role: 'Engineer' } });
    }

    if (url.endsWith('/api/tasks')) {
      return jsonResponse({ tasks: [{ id: 'one', title: 'Fetch API', done: true }] });
    }

    throw new Error(`Unexpected URL: ${url}`);
  };

  const dashboard = await loadDashboard(fakeFetch, 'http://localhost:3001/');

  assert.deepEqual(calls, ['http://localhost:3001/api/profile', 'http://localhost:3001/api/tasks']);
  assert.equal(dashboard.profile.name, 'Ada');
  assert.equal(dashboard.tasks[0].title, 'Fetch API');
});

test('loadDashboard throws a readable error when the API fails', async () => {
  const fakeFetch = async () => ({
    ok: false,
    status: 500,
    json: async () => ({ error: 'boom' }),
  });

  await assert.rejects(
    () => loadDashboard(fakeFetch, 'http://localhost:3001'),
    /Request failed: 500/,
  );
});

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  };
}
