import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/data/demo.js', ['data/demo.js', 'text/javascript; charset=utf-8']],
  ['/data/live.js', ['data/live.js', 'text/javascript; charset=utf-8']],
  ['/data/live.json', ['data/live.json', 'application/json; charset=utf-8']]
]);
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  if (pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
  const file = files.get(pathname);
  if (!file) { response.writeHead(404); response.end('Not found'); return; }
  try {
    const content = await readFile(new URL(file[0], import.meta.url));
    response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(500); response.end('Unable to read local demo file');
  }
});
server.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
server.listen(8877, '127.0.0.1', () => console.log('Local demo: http://127.0.0.1:8877'));
