# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: non-technical designers who work in Figma Desktop and want an AI assistant (Claude Code, Command Code, Cursor, Claude Desktop, other MCP clients) to read and build designs in their open file. Many have never used Terminal or configured MCP. They follow the GitHub Pages guide step by step, usually with Figma open beside it.

The repository README serves developers; the guide site does not need a developer track.

## Product Purpose

Unofficial Figma MCP is a self-hosted MCP server plus a Figma development plugin. The AI client talks to a local server over stdio; the server talks to the plugin over a WebSocket on localhost; the plugin runs Figma Plugin API calls in the open file. Success for the guide: the visitor installs it, sees the plugin connect, understands why it is useful, and knows what to ask the AI once connected.

## Positioning

- Works through the Figma Plugin API inside the user's own Figma Desktop, not Figma's cloud API, so Figma's hosted MCP server rate limits do not apply to it.
- Builds designs live on canvas: `figma_build` creates nodes one at a time so the user watches the layout assemble.
- Everything runs locally; design data does not pass through a third-party server beyond the AI client the user already chose.
- Not affiliated with Figma, Inc. Previously named Open Figma MCP.

## Operating Context

- Install: `curl -fsSL https://pradityaaldi.github.io/unofficial-figma-mcp/install.sh | bash` (macOS/Linux). It uses Node.js 20+ when present, otherwise installs a private official Node.js LTS under ~/.local/share/unofficial-figma-mcp/node without sudo; the command is a wrapper that calls that node by absolute path. The installer registers the plugin in Figma Desktop, which may quit and relaunch Figma once.
- Connect: add the printed command path to the AI client (JSON config, or `claude mcp add` / `cmd mcp add`), then run Plugins → Development → Unofficial Figma MCP in Figma. Development plugins always show Figma's generic icon and a "Development" label.
- Use: ask the AI to check `figma_status`, read the selection, or build screens.

## Capabilities and Constraints

- Tools: figma_build, figma_exec, figma_upload_image, figma_screenshot, figma_get_metadata, figma_get_selection, figma_get_pages, figma_set_page, figma_status, figma_toggle_ui.
- One Figma file at a time (whichever file runs the plugin); the plugin must stay running; Figma Desktop only.
- Several AI clients can share one plugin connection (the first owns port 3055, others relay).
- Figma's official MCP server limits (from developers.figma.com/docs/figma-mcp-server/rate-limits-access/): View/Collab seats get up to 20 calls/month on Starter and up to 6/month on paid plans; Dev/Full seats get daily and per-minute caps; limits apply to read tools, some write tools are exempt. State these only with a link to that page.
- Not yet published to Figma Community.

## Brand Commitments

- Name: Unofficial Figma MCP. Always make non-affiliation with Figma, Inc. clear; never use Figma's logo.
- Icon: `assets/icon.svg` — a 2x2 tile grid (paper square, violet circle, coral circle, dashed lime square under a cursor) on ink, rotated -5°. Palette: ink #171513, paper #F5F0E7, violet #7657FF, coral #FF6B55, lime #C8FF4A.
- Guide site languages: English (default) and Indonesian, switchable.

## Evidence on Hand

- Real designs built through the MCP in this project's testing: a mobile login screen, a desktop analytics dashboard, and its mobile version (built with figma_build in one call each).
  figma_build returned counts of 35 (mobile login), 151 (desktop dashboard) and 125 (mobile dashboard) nodes on 28 Sep 2026; these are the layer counts shown in the guide's step 6.
- Release v0.2.0: https://github.com/pradityaaldi/unofficial-figma-mcp/releases/tag/v0.2.0. The public installer run for v0.2.0 on macOS printed "added 95 packages in 1s" and the registration and success lines quoted in the guide's step 2.
- No testimonials, user counts, or benchmarks exist; do not invent them.

## Product Principles

1. A designer who has never opened Terminal must reach "connected" without help.
2. Show the thing happening; the live, node-by-node build is the product's signature.
3. Be honest about limits: development-plugin label, desktop-only, one file at a time, unofficial status.
4. Point to primary sources: Figma's MCP rate-limit docs, Figma Plugin API docs, and the MCP "build a server" guide for people who want to make their own.

## Accessibility & Inclusion

Readers include people unfamiliar with technical vocabulary; every command needs a plain-language explanation and an expected result. Animated illustrations must respect reduced-motion preferences.
