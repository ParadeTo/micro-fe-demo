import { createServer } from 'node:http';

const tasks = [
  { id: 'setup', title: 'Start the API server', done: true },
  { id: 'fetch', title: 'Fetch tasks from React Native', done: false },
  { id: 'refresh', title: 'Tap refresh and update the UI', done: false },
];

const profile = {
  name: 'Ada Chen',
  role: 'Mobile Engineer',
  city: 'Shanghai',
};


export function createApiServer() {
  return createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === 'OPTIONS') {
      sendEmpty(response, 204);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, 200, {
        ok: true,
        service: 'rn-demo-api',
        time: new Date().toISOString(),
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/tasks') {
      sendJson(response, 200, { tasks });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/profile') {
      sendJson(response, 200, { profile });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/banners') {
      sendJson(response, 200, { profile });
      return;
    }

    sendJson(response, 404, {
      error: 'Not found',
      path: url.pathname,
    });
  });
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    ...corsHeaders(),
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}

function sendEmpty(response, statusCode) {
  response.writeHead(statusCode, corsHeaders());
  response.end();
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
