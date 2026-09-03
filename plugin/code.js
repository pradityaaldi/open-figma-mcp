// Open Figma MCP — Figma plugin main thread.
// Owns the `figma` global. Receives commands from ui.html (which holds the
// WebSocket, since the main thread has no network access) and posts results back.

// The UI iframe must exist (it owns the WebSocket) but does not need to be
// visible. Hidden by default so the plugin runs without a floating window;
// the `show_ui` bridge command brings it back for debugging.
figma.showUI(__html__, { width: 320, height: 260, themeColors: true, visible: false });

// ---------------------------------------------------------------- serializing

// Figma nodes are live proxies with cyclic parent/child references and getters
// that throw on some node types. Anything crossing postMessage must be flattened
// to plain JSON first.
function safeValue(v, depth) {
  if (v === null || v === undefined) return v;
  const t = typeof v;
  if (t === 'string' || t === 'number' || t === 'boolean') return v;
  if (t === 'function') return '[function]';
  if (t === 'symbol') return String(v);
  if (v === figma.mixed) return 'MIXED';
  if (depth > 8) return '[max depth]';

  if (Array.isArray(v)) return v.map((x) => safeValue(x, depth + 1));

  // A node proxy: identify it rather than walking the whole tree.
  if (v.id && v.type && typeof v.id === 'string') {
    const out = { id: v.id, name: v.name, type: v.type };
    if (typeof v.width === 'number') {
      out.x = Math.round(v.x);
      out.y = Math.round(v.y);
      out.width = Math.round(v.width);
      out.height = Math.round(v.height);
    }
    return out;
  }

  const out = {};
  for (const k in v) {
    try {
      out[k] = safeValue(v[k], depth + 1);
    } catch (e) {
      out[k] = '[unreadable: ' + e.message + ']';
    }
  }
  return out;
}

// -------------------------------------------------------------------- helpers

// Injected into every exec script so common tasks don't need boilerplate.
function buildHelpers() {
  return {
    // Hex string -> Figma RGB (0..1).
    color(hex) {
      const n = parseInt(hex.replace('#', ''), 16);
      return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
    },
    // Load every font used by a text node before mutating it.
    async loadFontsFor(node) {
      const segs = node.getStyledTextSegments(['fontName']);
      const seen = {};
      for (const s of segs) {
        const key = s.fontName.family + '|' + s.fontName.style;
        if (!seen[key]) {
          seen[key] = true;
          await figma.loadFontAsync(s.fontName);
        }
      }
    },
    // Depth-limited structural dump — the metadata tool builds on this.
    outline(node, maxDepth) {
      const walk = (n, d) => {
        const o = { id: n.id, name: n.name, type: n.type };
        if (typeof n.width === 'number') {
          o.x = Math.round(n.x);
          o.y = Math.round(n.y);
          o.w = Math.round(n.width);
          o.h = Math.round(n.height);
        }
        if (n.type === 'TEXT') o.characters = n.characters;
        if (n.children && d < maxDepth) o.children = n.children.map((c) => walk(c, d + 1));
        else if (n.children) o.childCount = n.children.length;
        return o;
      };
      return walk(node, 0);
    },
  };
}

// ------------------------------------------------------------------ execution

async function exec(code) {
  const helpers = buildHelpers();
  // Same contract as Figma's own use_figma: plain JS body, top-level await and
  // return both work because the body is wrapped in an async function.
  const fn = new Function(
    'figma',
    'helpers',
    'color',
    'loadFontsFor',
    'outline',
    '"use strict"; return (async () => {\n' + code + '\n})();'
  );
  const result = await fn(figma, helpers, helpers.color, helpers.loadFontsFor, helpers.outline);
  return safeValue(result, 0);
}

async function resolveNode(nodeId) {
  const id = String(nodeId).replace('-', ':');
  const node = await figma.getNodeByIdAsync(id);
  if (!node) throw new Error('Node not found: ' + id);
  return node;
}

async function screenshot(nodeId, scale) {
  const node = nodeId ? await resolveNode(nodeId) : figma.currentPage.selection[0];
  if (!node) throw new Error('No nodeId given and nothing selected');
  if (typeof node.exportAsync !== 'function') throw new Error(node.type + ' cannot be exported');

  const bytes = await node.exportAsync({
    format: 'PNG',
    constraint: { type: 'SCALE', value: scale || 1 },
  });
  return {
    bytes: Array.from(bytes),
    meta: {
      id: node.id,
      name: node.name,
      width: Math.round(node.width),
      height: Math.round(node.height),
    },
  };
}

// --------------------------------------------------------------- command loop

const commands = {
  async ping() {
    return { ok: true, file: figma.root.name, page: figma.currentPage.name };
  },

  async exec(p) {
    return exec(p.code);
  },

  async get_pages() {
    return figma.root.children.map((p) => ({
      id: p.id,
      name: p.name,
      isCurrent: p.id === figma.currentPage.id,
    }));
  },

  async get_metadata(p) {
    const node = p.nodeId ? await resolveNode(p.nodeId) : figma.currentPage;
    return buildHelpers().outline(node, p.depth === undefined ? 3 : p.depth);
  },

  async get_selection() {
    const sel = figma.currentPage.selection;
    if (!sel.length) return { count: 0, nodes: [] };
    const o = buildHelpers().outline;
    return { count: sel.length, nodes: sel.map((n) => o(n, 1)) };
  },

  async screenshot(p) {
    return screenshot(p.nodeId, p.scale);
  },

  async set_page(p) {
    const page = await resolveNode(p.pageId);
    if (page.type !== 'PAGE') throw new Error('Not a page: ' + p.pageId);
    await figma.setCurrentPageAsync(page);
    return { currentPage: page.name, id: page.id };
  },

  async show_ui() {
    figma.ui.show();
    return { visible: true };
  },

  async hide_ui() {
    figma.ui.hide();
    return { visible: false };
  },
};

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'status') return; // UI-only chatter

  const { id, command, params } = msg;
  const handler = commands[command];

  if (!handler) {
    figma.ui.postMessage({ type: 'result', id, ok: false, error: 'Unknown command: ' + command });
    return;
  }

  try {
    const data = await handler(params || {});
    figma.ui.postMessage({ type: 'result', id, ok: true, data });
  } catch (e) {
    figma.ui.postMessage({
      type: 'result',
      id,
      ok: false,
      error: e && e.message ? e.message : String(e),
      stack: e && e.stack ? String(e.stack).split('\n').slice(0, 4).join('\n') : undefined,
    });
  }
};
