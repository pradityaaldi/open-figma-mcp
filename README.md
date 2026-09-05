# Open Figma MCP

A self-hosted replacement for Figma's official MCP server. It talks to Figma
through a local development plugin instead of Figma's cloud API, so the Starter
plan's 20-calls-per-month quota does not apply.

```
Claude Code  <--stdio-->  mcp/server.js  <--ws://localhost:3055-->  plugin/ui.html
                                                                          |
                                                                    postMessage
                                                                          |
                                                                    plugin/code.js
                                                                    (figma global)
```

The plugin main thread owns the `figma` global but has no network access, and the
plugin UI iframe has network access but no `figma` global. The bridge uses both:
the UI holds the socket, the main thread does the work, `postMessage` joins them.

## Quick start

> **New to Terminal or MCP?** Follow the visual, step-by-step guide for
> designers at [pradityaaldi.github.io/open-figma-mcp](https://pradityaaldi.github.io/open-figma-mcp/).

```bash
# Install the server and register the plugin in Figma desktop
curl -fsSL https://pradityaaldi.github.io/open-figma-mcp/install.sh | bash
```

The installer prints the exact MCP configuration for your machine. Add it to
your client, then open a Figma file and run
**Plugins → Development → Open Figma MCP**. Call `figma_status` from your MCP
client; the dot in the plugin window turns green when the bridge is connected.

Leave the plugin window open — closing it drops the socket. Reopening reconnects.

Running the install command again updates to the latest GitHub release. To
remove both the installed command and the development plugin:

```bash
curl -fsSL https://pradityaaldi.github.io/open-figma-mcp/install.sh | bash -s -- --uninstall
```

Install a specific tag with `--ref v0.1.0`, or add `--no-plugin` when you only
want to install/update the MCP server runtime.

Maintainers can publish an update by pushing a `v*` tag. The release workflow
runs the test suite and creates the GitHub Release consumed by the installer.

Requirements: macOS or Linux, Node.js 20 or newer, `curl`, and `npm`. The
installer writes only to user-owned directories (`~/.local` and
`~/.open-figma-mcp`) and does not need `sudo`.

### What `install-plugin` does

Figma desktop keeps its development plugins in a local `settings.json`
(`~/Library/Application Support/Figma/` on macOS, `%APPDATA%\Figma\` on
Windows). The command copies the plugin to `~/.open-figma-mcp/plugin/`, quits
Figma, adds the plugin to that file, writes a `.bak-open-figma-mcp` backup next
to it, and relaunches Figma. The plugin then shows up under
**Plugins → Development** without the manual import step.

Flags: `--no-quit` (you close Figma yourself), `--no-relaunch`.
`open-figma-mcp uninstall-plugin` reverses it.

If the settings file cannot be found or Figma will not quit, the command falls
back to printing the manifest path so you can use
**Plugins → Development → Import plugin from manifest…** instead. That path
always works; only the desktop app can load a local development plugin.

### Other MCP clients

Any client that speaks stdio MCP works. Cursor / Windsurf / Claude Desktop:

```json
{
  "mcpServers": {
    "open-figma-mcp": {
      "command": "/Users/YOU/.local/bin/open-figma-mcp"
    }
  }
}
```

Use the absolute command path printed by the installer. Absolute paths are more
reliable for desktop MCP clients, which may not inherit your terminal's `PATH`.

### From a clone

`npm install`, then the shipped `.mcp.json` makes `claude` pick the server up
when run from this directory. `npm start` runs the server directly.

## Tools

| Tool | What it does |
| --- | --- |
| `figma_exec` | Run arbitrary Plugin API JavaScript. This is the workhorse. |
| `figma_screenshot` | Export a node as PNG, returned inline. |
| `figma_get_metadata` | Structural outline — ids, names, types, sizes, text. |
| `figma_get_selection` | What the user has selected right now. |
| `figma_get_pages` | List document pages. |
| `figma_set_page` | Switch the active page. |
| `figma_status` | Connection state plus the open file and page. |

### Writing `figma_exec` code

The body is wrapped in an async function, so `await` and `return` both work at the
top level. The returned value is the only output channel — `console.log` is not
captured.

```js
await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

const frame = figma.createFrame();
frame.resize(400, 300);
frame.fills = [{ type: 'SOLID', color: color('#101828') }];
figma.currentPage.appendChild(frame);

return { createdNodeIds: [frame.id] };
```

Three helpers are injected:

- `color('#2B5CFF')` — hex to Figma's 0–1 RGB.
- `await loadFontsFor(textNode)` — loads every font a text node already uses,
  which is what you need before editing existing text.
- `outline(node, depth)` — structural dump of a subtree.

The Plugin API rules that cause most failures:

- Colors are 0–1, not 0–255.
- Load fonts before touching any text node.
- `fills` and `strokes` are read-only arrays — build a new array and reassign.
- Switch pages with `await figma.setCurrentPageAsync(page)`; the sync setter throws.
- `figma.notify()` is not available in this environment.
- Set `layoutSizingHorizontal` / `layoutSizingVertical` only after `appendChild`.

## Verify before relying on it

`figma_exec` compiles the incoming string with `new Function`. Figma's plugin
sandbox is expected to allow this — it is how scripting plugins such as Scripter
work — but it has not been exercised against a live Figma instance in this repo.
The first thing to run after connecting is:

```
figma_exec: return 1 + 1
```

If that returns `2`, dynamic execution works and every other tool follows. If it
throws about `Function` or `eval`, the sandbox is blocking compilation and the
plugin needs a fixed command set (`create_frame`, `set_fill`, …) instead of
arbitrary code.

## Tests

```bash
node test/smoke.js
```

Spawns the MCP server, attaches a fake plugin over WebSocket, and exercises the
full request path — including a plugin-side throw and a mid-session disconnect.
No Figma instance required.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `BRIDGE_PORT` | `3055` | WebSocket port the plugin dials. |
| `BRIDGE_TIMEOUT` | `30000` | Milliseconds before a pending command gives up. |

Change the port in both your MCP client config (`BRIDGE_PORT`) and the plugin's URL field if 3055 is taken.

## Limits

- One Figma file at a time — whichever file has the plugin open.
- The plugin window must stay open.
- Long-running scripts hit `BRIDGE_TIMEOUT`; split large jobs into several calls.
- Only the desktop app can load a local development plugin.

## Relationship to the official server

This does not replace everything Figma's own MCP server does. Code Connect,
design-system search across published libraries, and Figma Make support all live
in the official server and are not reimplemented here. What this covers is
reading and writing the file that is open in front of you, without a quota.
