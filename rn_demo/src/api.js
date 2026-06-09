export function normalizeApiBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

export async function loadProfile(fetchImpl, apiBaseUrl) {
  const baseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const response = await fetchImpl(`${baseUrl}/api/profile`);
  const body = await readJson(response);
  return body.profile;
}

export async function loadTasks(fetchImpl, apiBaseUrl) {
  const baseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const response = await fetchImpl(`${baseUrl}/api/tasks`);
  const body = await readJson(response);
  return body.tasks;
}

export async function loadDashboard(fetchImpl, apiBaseUrl) {
  const baseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [profileResponse, tasksResponse] = await Promise.all([
    fetchImpl(`${baseUrl}/api/profile`),
    fetchImpl(`${baseUrl}/api/tasks`),
  ]);

  const [profileBody, tasksBody] = await Promise.all([
    readJson(profileResponse),
    readJson(tasksResponse),
  ]);

  return {
    profile: profileBody.profile,
    tasks: tasksBody.tasks,
  };
}

async function readJson(response) {
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${body.error || ''}`.trim());
  }

  return body;
}
