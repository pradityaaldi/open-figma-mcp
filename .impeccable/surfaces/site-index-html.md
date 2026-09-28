---
version: 1
slug: "site-index-html"
primary_target: "site/index.html"
related_targets: []
---

# Guide site (GitHub Pages)

Scope: site/index.html, the public setup guide. Mode: Read (a tutorial that must end in a working connection), with a persuasive opening.

Audience: non-technical designers in Figma Desktop. Job: install, connect their AI app, confirm the plugin is connected, then ask for a first design. Must also understand why this exists (Figma's own MCP servers: desktop is read-only, remote write is remote-only, read tools are rate limited) with links to Figma's docs as proof, and where to learn to build their own MCP (MCP build-server guide, Figma Plugin API docs).

Constraints: English default with Indonesian toggle; realistic, animated UI illustrations for every step, honoring reduced motion; no invented claims; non-affiliation stated; static HTML on GitHub Pages (site/ is the deploy root). Seat and pricing terms for Figma's use_figma are only known from third-party sources, so the page links to Figma's docs instead of stating them.

Section order (decided after review): hero with the app picker at its fold edge, then setup, prompts, why, and the comparison. Setup precedes the comparison because the user ranked "install until connected" as the first goal; the hero carries a quiet link to the comparison and the nav reaches it on every width.

## Direction contract

THESIS: The guide is a path the reader tailors: pick your AI app once and every command, screen and illustration below speaks that app. It refuses the generic one-size tutorial where the reader translates instructions for their own tool.

OWN-WORLD: Warm paper ground (#F5F0E7) with ink (#171513) type; lime (#C8FF4A) marks action and "done", violet (#7657FF) marks the AI, coral (#FF6B55) marks warnings. Illustrations are faithful app windows (macOS Terminal, Figma's dark editor, AI chat) set on the paper like objects on a desk. Display in Bricolage Grotesque, code in JetBrains Mono. The 2x2 tile mark.

STORY: The visitor sees an AI build a Figma screen node by node, understands it works without Figma's quotas and why Figma's own servers are not enough, picks their app, follows five illustrated steps to a green "connected", and leaves with prompts to try and links to the primary docs.

FIRST VIEWPORT: Left five columns: headline, one-line promise, the install command with Copy as the primary action, a quiet link to the comparison. Right seven columns: a Figma editor window where a login card builds itself node by node while a layers panel fills and an AI chat bubble narrates. Below the fold edge: the app chips row.

FORM: Pick your AI app, get your path. Position 4 on the ordered list. Seed key f76a3cdd.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
