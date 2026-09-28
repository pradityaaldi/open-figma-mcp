#!/usr/bin/env node
// Unofficial Figma MCP server.
//
// One process, two faces:
//   - stdio  : speaks MCP to any MCP client (Claude Code, Cursor, etc.)
//   - :3055  : WebSocket server the Figma plugin connects to
//
// Commands travel MCP -> WS -> plugin ui.html -> plugin code.js, and results
// come back the same way. No Figma cloud API involved, so no tool-call quota.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { WebSocket, WebSocketServer } from 'ws';

const PORT = Number(process.env.BRIDGE_PORT || 3055);
const TIMEOUT_MS = Number(process.env.BRIDGE_TIMEOUT || 30000);

// stdout belongs to the MCP protocol — every diagnostic goes to stderr.
const log = (...a) => process.stderr.write('[bridge] ' + a.join(' ') + '\n');

// ------------------------------------------------------------ plugin channel

let plugin = null;
const pending = new Map();
const forwarded = new Map();
let seq = 0;
let forwardSeq = 0;
let relayRetry = null;

const wss = new WebSocketServer({ port: PORT, host: '127.0.0.1' });

wss.on('connection', (ws) => {
  let role = 'unknown';

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type === 'hello') {
      role = msg.role === 'relay' ? 'relay' : 'plugin';
      if (role === 'plugin') {
        log('plugin connected');
        if (plugin && plugin !== ws) plugin.close(1012, 'Replaced by a newer plugin connection');
        plugin = ws;
      } else {
        log('MCP relay connected');
      }
      return;
    }

    if (role === 'relay') {
      if (!plugin || plugin.readyState !== WebSocket.OPEN) {
        ws.send(JSON.stringify({
          id: msg.id,
          ok: false,
          error: 'Figma plugin not connected. Run Unofficial Figma MCP in Figma.',
        }));
        return;
      }
      const forwardedId = `relay-${++forwardSeq}`;
      forwarded.set(forwardedId, { relay: ws, originalId: msg.id });
      plugin.send(JSON.stringify({ ...msg, id: forwardedId }));
      return;
    }

    const forwardedEntry = forwarded.get(msg.id);
    if (forwardedEntry) {
      // Progress events precede the result; only the result ends the request.
      if (msg.type !== 'progress') forwarded.delete(msg.id);
      if (forwardedEntry.relay.readyState === WebSocket.OPEN) {
        forwardedEntry.relay.send(JSON.stringify({ ...msg, id: forwardedEntry.originalId }));
      }
      return;
    }

    settle(msg);
  });

  ws.on('close', () => {
    if (role === 'plugin') log('plugin disconnected');
    if (role === 'relay') log('MCP relay disconnected');
    if (plugin === ws) {
      plugin = null;
      for (const [id, entry] of forwarded) {
        if (entry.relay.readyState === WebSocket.OPEN) {
          entry.relay.send(JSON.stringify({
            id: entry.originalId,
            ok: false,
            error: 'Plugin disconnected mid-request',
          }));
        }
        forwarded.delete(id);
      }
    }
    for (const [id, entry] of forwarded) {
      if (entry.relay === ws) forwarded.delete(id);
    }
    // Fail fast rather than let callers hang on a dead plugin socket. Relay
    // disconnects must not cancel requests owned by the primary MCP process.
    if (role === 'plugin') {
      for (const [id, entry] of pending) {
        clearTimeout(entry.timer);
        entry.resolve({ id, ok: false, error: 'Plugin disconnected mid-request' });
      }
      pending.clear();
    }
  });

  ws.on('error', (e) => log('socket error:', e.message));
});

wss.on('listening', () => log(`listening on ws://127.0.0.1:${PORT}`));
wss.on('error', (e) => {
  log('server error:', e.message);
  if (e.code === 'EADDRINUSE') {
    log(`port ${PORT} busy — connecting to the existing bridge as an MCP relay`);
    connectRelay();
  }
});

function connectRelay() {
  clearTimeout(relayRetry);
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);

  ws.on('open', () => {
    log('connected to shared bridge');
    ws.send(JSON.stringify({ type: 'hello', role: 'relay' }));
    plugin = ws;
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    settle(msg);
  });

  const reconnect = () => {
    if (plugin === ws) plugin = null;
    for (const [id, entry] of pending) {
      clearTimeout(entry.timer);
      entry.resolve({ id, ok: false, error: 'Shared bridge disconnected mid-request' });
    }
    pending.clear();
    relayRetry = setTimeout(connectRelay, 1000);
  };
  ws.on('close', reconnect);
  ws.on('error', (e) => log('relay error:', e.message));
}

// Route a plugin message to its waiting caller. A progress event keeps the
// request alive (the timeout measures silence, not total duration) and is
// passed on; anything else is the final result.
function settle(msg) {
  const entry = pending.get(msg.id);
  if (!entry) return;
  if (msg.type === 'progress') {
    entry.arm();
    entry.onProgress?.(msg);
    return;
  }
  pending.delete(msg.id);
  clearTimeout(entry.timer);
  entry.resolve(msg);
}

function send(command, params = {}, onProgress) {
  return new Promise((resolve, reject) => {
    if (!plugin || plugin.readyState !== 1) {
      reject(
        new Error(
          'Figma plugin not connected. In Figma: Plugins > Development > Unofficial Figma MCP, ' +
            'then press Connect.'
        )
      );
      return;
    }
    const id = String(++seq);
    const entry = { resolve, onProgress, timer: null };
    entry.arm = () => {
      clearTimeout(entry.timer);
      entry.timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timed out after ${TIMEOUT_MS}ms without a response from the plugin`));
      }, TIMEOUT_MS);
    };
    entry.arm();
    pending.set(id, entry);
    plugin.send(JSON.stringify({ id, command, params }));
  });
}

// A plugin-side throw is a normal outcome, not a transport failure — surface the
// message to the model so it can correct the script.
async function call(command, params, onProgress) {
  const res = await send(command, params, onProgress);
  if (!res.ok) throw new Error(res.error + (res.stack ? '\n' + res.stack : ''));
  return res.data;
}

const text = (v) => ({
  // Compact JSON: indentation roughly doubles the tokens the model has to read.
  content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v) }],
});

// ------------------------------------------------------------------- MCP side

const EXEC_DESCRIPTION = `Run JavaScript inside the open Figma file with full Plugin API access.

The body is wrapped in an async function, so top-level \`await\` and \`return\` both work.
Whatever you \`return\` is JSON-serialized and sent back — that is the only output channel
(\`console.log\` is not captured). Node objects in the return value are collapsed to
{id, name, type, x, y, width, height}.

Prefer figma_build for creating new layouts — it is faster to write and builds live on canvas.
Use figma_exec for edits, queries, and anything figma_build cannot express.

Injected helpers: \`color('#2B5CFF')\` -> Figma RGB; \`await loadFontsFor(textNode)\` loads every
font a text node already uses; \`outline(node, depth)\` returns a structural dump;
\`await step(node?)\` repaints the canvas (and scrolls to a top-level node) so the user watches
the build progress — call it after appending each section when creating many nodes.

Rules that bite:
- Colors are 0-1, not 0-255.
- Load fonts before touching text: \`await figma.loadFontAsync({family:'Inter', style:'Bold'})\`.
- \`fills\`/\`strokes\` are read-only arrays — build a new array and reassign.
- Switch pages with \`await figma.setCurrentPageAsync(page)\`; the sync setter throws.
- \`figma.notify()\` is unavailable here.
- Set \`layoutSizing*\` only after \`appendChild\`.
- Always return the ids of nodes you create or change.

Example:
  await figma.loadFontAsync({family:'Inter', style:'Bold'});
  const f = figma.createFrame();
  f.resize(400, 300);
  f.fills = [{type:'SOLID', color: color('#101828')}];
  figma.currentPage.appendChild(f);
  return { createdNodeIds: [f.id] };`;

const BUILD_DESCRIPTION = `Build a design from a JSON node tree. Nodes appear on canvas one at a time
so the user watches it being assembled; the viewport follows the build. All fonts load up front.
Returns {rootIds, count, nodes:[{id,name,type}]}.

Node spec (every field optional except where noted):
  type: FRAME (default) | TEXT | RECTANGLE | ELLIPSE | LINE | SVG | COMPONENT | INSTANCE | POLYGON | STAR
  name, x, y (ignored inside auto-layout unless position:"absolute"), width, height
    width/height: number (fixed) | "hug" | "fill" (fill needs an auto-layout parent)
  fill: "#hex" | "#RRGGBBAA" | {gradient:["#a","#b"], angle:180} | [paints] | "none"
  stroke: "#hex", strokeWidth, strokeAlign: inside|center|outside, dash:[4,4]
  radius: number | [tl,tr,br,bl]; opacity; rotation; clip: bool; visible: false
  shadow: {x,y,blur,spread,color:"#00000033",inner} or an array; blur; backgroundBlur
  Auto layout: layout: "row" | "column", gap: number | "auto" (space-between),
    padding: n | [v,h] | [t,r,b,l], align/crossAlign: start|center|end|between|baseline,
    wrap: true, wrapGap
  TEXT: text (required), fontFamily (default Inter), fontWeight 100-900 or fontStyle "Semi Bold",
    italic, fontSize, lineHeight (px or "150%"), letterSpacing, textAlign: left|center|right|justified,
    color: "#hex", textCase: upper|lower|title, textDecoration: underline|strikethrough
    A text with width "fill" or a number wraps; otherwise it grows to fit.
  SVG: svg: "<svg ...>" markup
  INSTANCE: componentId or componentKey, properties: {variant/prop overrides}
  position: "absolute" — ignore parent auto layout; index — insert position within the parent
  props: {anyPluginApiProperty: value} — raw escape hatch applied last
  children: [node, ...]

Frames without fill are transparent, except a top-level frame (white by default). Top-level
nodes without x/y are placed to the right of existing content so nothing overlaps.

Example:
{"node":{"name":"Card","layout":"column","width":320,"padding":24,"gap":12,"fill":"#FFFFFF",
 "radius":16,"shadow":{"y":8,"blur":24,"color":"#1018281A"},"children":[
  {"type":"TEXT","text":"Welcome back","fontSize":24,"fontWeight":700,"color":"#101828"},
  {"type":"TEXT","text":"Sign in to continue","fontSize":14,"color":"#667085","width":"fill"},
  {"name":"Button","layout":"row","width":"fill","padding":[12,16],"align":"center",
   "fill":"#2B5CFF","radius":8,"children":[
    {"type":"TEXT","text":"Continue","fontWeight":600,"color":"#FFFFFF"}]}]}}`;

const NODE_SCHEMA = {
  type: 'object',
  description: 'Node spec — see the tool description for fields.',
  additionalProperties: true,
};

const TOOLS = [
  {
    name: 'figma_build',
    description: BUILD_DESCRIPTION,
    inputSchema: {
      type: 'object',
      properties: {
        node: NODE_SCHEMA,
        nodes: { type: 'array', items: NODE_SCHEMA, description: 'Several top-level trees, built in order.' },
        parentId: {
          type: 'string',
          description: 'Append into this existing node instead of the current page.',
        },
        stepDelay: {
          type: 'number',
          description: 'Milliseconds to pause after each node so the canvas repaints. Default 30; 0 is fastest.',
        },
        focus: {
          type: 'boolean',
          description: 'Follow the build with the viewport and select the result. Default true.',
        },
      },
    },
  },
  {
    name: 'figma_exec',
    description: EXEC_DESCRIPTION,
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JavaScript to run. Use `return` to send data back.' },
      },
      required: ['code'],
    },
  },
  {
    name: 'figma_screenshot',
    description:
      'Export a node as PNG and return it inline. Omit nodeId to capture the current selection. ' +
      'Use this to visually verify what you just built.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'Node id, e.g. "50:417". Defaults to selection.' },
        scale: { type: 'number', description: 'Export scale, default 1.' },
        maxSize: {
          type: 'number',
          description: 'Cap on the longest edge in pixels, default 1600. Large frames are scaled down to fit.',
        },
      },
    },
  },
  {
    name: 'figma_get_metadata',
    description:
      'Structural outline of a node — ids, names, types, positions, sizes, and text content. ' +
      'Omit nodeId to outline the current page. Cheaper than a screenshot for understanding hierarchy.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'Node id. Defaults to the current page.' },
        depth: { type: 'number', description: 'How many levels to descend, default 3.' },
      },
    },
  },
  {
    name: 'figma_get_selection',
    description: 'What the user currently has selected on canvas. Use this when they say "this frame".',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'figma_get_pages',
    description: 'List the pages in the open document, flagging the current one.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'figma_set_page',
    description: 'Switch the active page. Page content only loads once its page is current.',
    inputSchema: {
      type: 'object',
      properties: { pageId: { type: 'string', description: 'Page id from figma_get_pages.' } },
      required: ['pageId'],
    },
  },
  {
    name: 'figma_status',
    description: 'Check whether the plugin is connected, and which file and page it has open.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'figma_toggle_ui',
    description:
      'Show or hide the plugin window inside Figma. The plugin runs hidden by default; ' +
      'showing it is only useful for debugging the connection.',
    inputSchema: {
      type: 'object',
      properties: {
        visible: { type: 'boolean', description: 'true = show the plugin window, false = hide it.' },
      },
      required: ['visible'],
    },
  },
];

const server = new Server(
  { name: 'unofficial-figma-mcp', version: '0.2.1' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req, extra) => {
  const { name, arguments: args = {} } = req.params;

  // Forward plugin progress as MCP progress notifications when the client asked
  // for them. Clients show these as a live status while a build runs.
  const progressToken = req.params._meta?.progressToken;
  let lastProgress = 0;
  const onProgress = progressToken === undefined
    ? undefined
    : (p) => {
        const progress = Math.max(lastProgress + 1e-6, p.done ?? lastProgress + 1);
        lastProgress = progress;
        extra.sendNotification({
          method: 'notifications/progress',
          params: {
            progressToken,
            progress,
            ...(p.total ? { total: p.total } : {}),
            ...(p.message ? { message: p.message } : {}),
          },
        }).catch(() => {});
      };

  try {
    switch (name) {
      case 'figma_build':
        return text(
          await call(
            'build',
            {
              node: args.node,
              nodes: args.nodes,
              parentId: args.parentId,
              stepDelay: args.stepDelay,
              focus: args.focus,
            },
            onProgress
          )
        );

      case 'figma_exec':
        return text(await call('exec', { code: args.code }, onProgress));

      case 'figma_screenshot': {
        const r = await call('screenshot', { nodeId: args.nodeId, scale: args.scale, maxSize: args.maxSize });
        return {
          content: [
            { type: 'text', text: JSON.stringify(r.meta) },
            { type: 'image', data: r.base64, mimeType: 'image/png' },
          ],
        };
      }

      case 'figma_get_metadata':
        return text(await call('get_metadata', { nodeId: args.nodeId, depth: args.depth }));

      case 'figma_get_selection':
        return text(await call('get_selection'));

      case 'figma_get_pages':
        return text(await call('get_pages'));

      case 'figma_set_page':
        return text(await call('set_page', { pageId: args.pageId }));

      case 'figma_status': {
        if (!plugin || plugin.readyState !== 1) {
          return text({
            connected: false,
            hint: 'Open the file in Figma, run Plugins > Development > Unofficial Figma MCP, press Connect.',
          });
        }
        return text({ connected: true, ...(await call('ping')) });
      }

      case 'figma_toggle_ui':
        return text(await call(args.visible ? 'show_ui' : 'hide_ui'));

      default:
        throw new Error('Unknown tool: ' + name);
    }
  } catch (e) {
    return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
  }
});

const shutdown = () => {
  wss.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await server.connect(new StdioServerTransport());
log('MCP server ready on stdio');
