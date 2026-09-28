// Regression test: two MCP processes share one WebSocket port and one Figma
// plugin connection. The second process must relay through the first.
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 3200;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let failures = 0;

function check(label, ok) {
  console.log((ok ? '  PASS  ' : '  FAIL  ') + label);
  if (!ok) failures++;
}

function startClient(label) {
  const process = spawn('node', ['mcp/server.js'], {
    env: { ...globalThis.process.env, BRIDGE_PORT: String(PORT) },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  process.stderr.on('data', (data) => globalThis.process.stderr.write(`  [${label}] ${data}`));

  let buffer = '';
  let id = 0;
  const replies = new Map();
  process.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      const resolve = replies.get(message.id);
      if (resolve) {
        replies.delete(message.id);
        resolve(message);
      }
    }
  });

  const rpc = (method, params) => new Promise((resolve) => {
    const requestId = ++id;
    replies.set(requestId, resolve);
    process.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }) + '\n');
  });

  return { process, rpc };
}

async function initialize(client) {
  await client.rpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'multi-client-test', version: '1' },
  });
  client.process.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
}

const primary = startClient('primary');
await initialize(primary);
await sleep(300);

const plugin = new WebSocket(`ws://127.0.0.1:${PORT}`);
await new Promise((resolve, reject) => {
  plugin.once('open', resolve);
  plugin.once('error', reject);
});
plugin.send(JSON.stringify({ type: 'hello', role: 'plugin' }));
plugin.on('message', (raw) => {
  const { id, command, params } = JSON.parse(raw.toString());
  if (command === 'ping') {
    plugin.send(JSON.stringify({ id, ok: true, data: { file: 'Shared File', page: 'Page 1' } }));
  } else if (command === 'exec') {
    plugin.send(JSON.stringify({ type: 'progress', id, done: 1, message: 'step' }));
    plugin.send(JSON.stringify({ id, ok: true, data: { echoed: params.code } }));
  }
});

const secondary = startClient('secondary');
await initialize(secondary);
await sleep(500);

const secondaryStatus = await secondary.rpc('tools/call', { name: 'figma_status', arguments: {} });
check(
  'secondary MCP process reaches the shared plugin',
  secondaryStatus.result.content[0].text.includes('Shared File')
);

const secondaryExec = await secondary.rpc('tools/call', {
  name: 'figma_exec',
  arguments: { code: 'return 2' },
});
check(
  'secondary MCP command round-trips through the primary bridge',
  secondaryExec.result.content[0].text.includes('return 2')
);

secondary.process.kill();
await sleep(300);
const primaryStatus = await primary.rpc('tools/call', { name: 'figma_status', arguments: {} });
check(
  'primary bridge remains usable after a relay disconnects',
  primaryStatus.result.content[0].text.includes('Shared File')
);

plugin.close();
primary.process.kill();
console.log(failures === 0 ? '\nAll multi-client checks passed.' : `\n${failures} check(s) failed.`);
globalThis.process.exit(failures === 0 ? 0 : 1);
