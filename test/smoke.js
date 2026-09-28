// Smoke test: drives the MCP server over stdio while a fake plugin answers on
// the WebSocket side. Verifies the full request path without needing Figma open.
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 3199;
const srv = spawn('node', ['mcp/server.js'], {
  // Short timeout so the progress test proves progress events keep a request alive.
  env: { ...process.env, BRIDGE_PORT: String(PORT), BRIDGE_TIMEOUT: '600' },
  stdio: ['pipe', 'pipe', 'pipe'],
});

srv.stderr.on('data', (d) => process.stderr.write('  [srv] ' + d));

let buf = '';
const replies = new Map();
const notifications = [];
srv.stdout.on('data', (d) => {
  buf += d.toString();
  const lines = buf.split('\n');
  buf = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.method) notifications.push(msg);
    const r = replies.get(msg.id);
    if (r) {
      replies.delete(msg.id);
      r(msg);
    }
  }
});

let id = 0;
const rpc = (method, params) =>
  new Promise((res) => {
    const reqId = ++id;
    replies.set(reqId, res);
    srv.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: reqId, method, params }) + '\n');
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(label, ok, detail) {
  console.log((ok ? '  PASS  ' : '  FAIL  ') + label + (detail ? '  — ' + detail : ''));
  if (!ok) failures++;
}

await sleep(700);

// --- handshake -------------------------------------------------------------
await rpc('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: { name: 'smoke', version: '1' },
});
srv.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

const tools = await rpc('tools/list', {});
const names = tools.result.tools.map((t) => t.name);
check('tools/list returns all 9 tools', names.length === 9, names.join(', '));

// --- disconnected state ----------------------------------------------------
const offline = await rpc('tools/call', { name: 'figma_status', arguments: {} });
check(
  'figma_status reports disconnected before the plugin joins',
  offline.result.content[0].text.includes('"connected":false')
);

const noPlugin = await rpc('tools/call', {
  name: 'figma_exec',
  arguments: { code: 'return 1' },
});
check(
  'figma_exec fails with a useful hint when no plugin is attached',
  noPlugin.result.isError === true && noPlugin.result.content[0].text.includes('Plugins > Development')
);

// --- fake plugin -----------------------------------------------------------
// Mirrors what code.js + ui.html do: answer commands, echo results by id.
const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
await new Promise((r) => ws.on('open', r));
ws.send(JSON.stringify({ type: 'hello', role: 'plugin' }));

ws.on('message', (raw) => {
  const { id, command, params } = JSON.parse(raw.toString());
  const reply = (ok, extra) => ws.send(JSON.stringify({ type: 'result', id, ok, ...extra }));

  if (command === 'ping') return reply(true, { data: { file: 'Test File', page: 'Page 1' } });
  if (command === 'exec') {
    if (params.code.includes('boom')) return reply(false, { error: 'boom exploded' });
    return reply(true, { data: { createdNodeIds: ['1:2'], echoed: params.code.length } });
  }
  if (command === 'build') {
    // Emit progress for longer than BRIDGE_TIMEOUT before answering.
    let done = 0;
    const tick = setInterval(() => {
      done++;
      ws.send(JSON.stringify({ type: 'progress', id, done, total: 5, message: 'node ' + done }));
      if (done === 5) {
        clearInterval(tick);
        reply(true, { data: { rootIds: ['9:1'], count: params.node.children.length + 1 } });
      }
    }, 250);
    return;
  }
  if (command === 'get_pages') return reply(true, { data: [{ id: '0:1', name: 'Page 1', isCurrent: true }] });
  if (command === 'get_metadata') return reply(true, { data: { id: '0:1', type: 'PAGE', children: [] } });
  if (command === 'get_selection') return reply(true, { data: { count: 0, nodes: [] } });
  if (command === 'screenshot') {
    // 1x1 transparent PNG.
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    return reply(true, { data: { base64: png, meta: { id: '1:2', name: 'Frame', width: 1, height: 1 } } });
  }
  reply(false, { error: 'unknown command ' + command });
});

await sleep(300);

// --- connected path --------------------------------------------------------
const status = await rpc('tools/call', { name: 'figma_status', arguments: {} });
check(
  'figma_status reports the open file once connected',
  status.result.content[0].text.includes('"connected":true') &&
    status.result.content[0].text.includes('Test File')
);

const exec = await rpc('tools/call', {
  name: 'figma_exec',
  arguments: { code: 'return figma.createFrame().id' },
});
check('figma_exec round-trips a result', exec.result.content[0].text.includes('createdNodeIds'));

const err = await rpc('tools/call', { name: 'figma_exec', arguments: { code: 'boom()' } });
check(
  'a plugin-side throw comes back as an error, not a crash',
  err.result.isError === true && err.result.content[0].text.includes('boom exploded')
);

const shot = await rpc('tools/call', { name: 'figma_screenshot', arguments: { nodeId: '1:2' } });
check(
  'figma_screenshot returns an inline image',
  shot.result.content[1].type === 'image' && shot.result.content[1].mimeType === 'image/png'
);

const build = await rpc('tools/call', {
  name: 'figma_build',
  arguments: { node: { name: 'Card', children: [{ type: 'TEXT', text: 'Hi' }] } },
  _meta: { progressToken: 'build-1' },
});
check(
  'figma_build outlives the timeout while progress keeps arriving',
  !build.result.isError && build.result.content[0].text.includes('9:1'),
  build.result.content[0].text
);
const progress = notifications.filter(
  (n) => n.method === 'notifications/progress' && n.params.progressToken === 'build-1'
);
check(
  'build progress is forwarded as MCP progress notifications',
  progress.length === 5 && progress[4].params.progress === 5 && progress[4].params.total === 5,
  progress.map((n) => n.params.progress).join(',')
);

const pages = await rpc('tools/call', { name: 'figma_get_pages', arguments: {} });
check('figma_get_pages lists pages', pages.result.content[0].text.includes('Page 1'));

const meta = await rpc('tools/call', { name: 'figma_get_metadata', arguments: {} });
check('figma_get_metadata returns an outline', meta.result.content[0].text.includes('PAGE'));

// --- disconnect handling ---------------------------------------------------
ws.close();
await sleep(300);
const afterClose = await rpc('tools/call', { name: 'figma_status', arguments: {} });
check(
  'status flips back to disconnected when the plugin closes',
  afterClose.result.content[0].text.includes('"connected":false')
);

srv.kill();
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
