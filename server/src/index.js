import { createApiServer } from './app.js';

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '0.0.0.0';

const server = createApiServer();

server.listen(port, host, () => {
  console.log(`RN demo API listening on http://localhost:${port}`);
});
