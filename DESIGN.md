---
name: Unofficial Figma MCP
description: Warm paper desk where an AI builds your Figma screen tile by tile.
colors:
  paper: "#F5F0E7"
  paper-deep: "#ECE4D5"
  sheet: "#FFFBF3"
  ink: "#171513"
  ink-soft: "#3A3631"
  ink-raised: "#211F1C"
  muted: "#655F56"
  paper-dim: "#D9D2C5"
  line: "#D8D0C4"
  lime: "#C8FF4A"
  lime-wash: "#E6F4CC"
  violet: "#7657FF"
  violet-deep: "#5238D6"
  coral: "#FF6B55"
  coral-wash: "#FFE3DD"
  green: "#1B7F45"
  fig-bg: "#1E1E1E"
  fig-panel: "#2C2C2C"
  fig-text: "#F0F0F0"
  fig-blue: "#0D99FF"
  term-bg: "#1A1917"
  term-text: "#E9E4DA"
typography:
  display:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.6rem, 4.5vw, 4.1rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.2rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.6rem, 2.6vw, 2.1rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
  lede:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.14rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.92rem"
    fontWeight: 600
    lineHeight: 1
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.86rem"
    fontWeight: 400
    lineHeight: 1.55
rounded:
  xs: "6px"
  sm: "10px"
  md: "12px"
  lg: "14px"
  xl: "16px"
  panel: "28px"
  pill: "999px"
spacing:
  gutter: "16px"
  container: "1180px"
  nav-height: "68px"
  step: "56px"
  section: "clamp(64px, 9vw, 112px)"
components:
  button-copy:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
  button-copy-hover:
    backgroundColor: "#D6FF74"
  button-copy-done:
    backgroundColor: "{colors.sheet}"
  command-block:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.mono}"
    rounded: "{rounded.lg}"
    padding: "15px 16px"
  prompt-card:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "15px 16px"
  chip:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "9px 15px"
  chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  nav-link:
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 12px"
  nav-link-hover:
    backgroundColor: "{colors.paper-deep}"
  callout-ok:
    backgroundColor: "{colors.lime-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
  callout-warn:
    backgroundColor: "{colors.coral-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
  callout-tip:
    backgroundColor: "{colors.paper-deep}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
  status-connected:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "7px 13px"
  step-number:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.lime}"
    typography: "{typography.title}"
    rounded: "13px"
    size: "44px"
  link-card:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px 18px"
---

# Design System: Unofficial Figma MCP

## Overview

**Creative North Star: "The Designer's Desk"**

The system is a warm paper desk with real app windows laid on it. The ground is uncoated paper, type is ink, and the only saturated colors are the three from the 2x2 tile mark: lime, violet and coral. Each one carries a fixed meaning, so color works as a signal rather than a decoration. Illustrations are faithful reproductions of the tools the reader will actually touch (macOS Terminal, Figma's dark editor, a code editor, an AI chat), each set on the paper as an object with a soft cast shadow, and small paper notes lie across them at a slight tilt.

Density is generous and reading-first: long single-column text measures (36-46em), wide section padding, and paired text-and-illustration rows that collapse to one column below 1020px. Display type is a heavy, tightly tracked Bricolage Grotesque; running text stays in the reader's system sans so instructions read like the operating system they are about. Motion is purposeful: illustrations assemble step by step with a single expo-out ease, and every animation resolves to its finished state under reduced motion.

The one full-bleed inversion is ink: a dark section flips the palette (paper type on ink, lime as the "yes" signal) for dense comparative material.

**Key Characteristics:**
- Paper ground, ink type, three signal colors from the tile mark.
- Lime means action and done; violet means the AI; coral means warning or "no".
- Illustrations are faithful app windows set on paper like desk objects.
- Heavy, tight grotesque display over system-sans body; JetBrains Mono for anything typed.
- Pills for choices, 12-14px corners for surfaces, a 28px corner for the one lime closing panel.
- Small deliberate tilts (-5deg for the mark and step numbers, -2deg for notes laid on windows).

## Colors

A warm neutral paper-and-ink palette carrying three saturated signal colors, each with one job.

### Primary
- **Signal Lime** (lime): the action and "done" color. Copy buttons, the "connected" status pill, the "$" prompt and source markers on ink, the highlighter stroke under the hero's emphasized words, the "yes" dot and the product's column header in the comparison, and the closing panel ground. Only ever sits under ink text or on an ink ground.
- **Lime Wash** (lime-wash): the ground of "it worked" callouts.

### Secondary
- **AI Violet** (violet): anything the AI says or does. The AI avatar dot, the AI's primary button inside illustrations, focus rings (3px outline, 3px offset).
- **Deep Violet** (violet-deep): violet as text, for tool names and code inside AI notes and tool-call pills where violet itself would be too light.

### Tertiary
- **Warning Coral** (coral): the "no" dot in comparisons and the coral tile of the mark.
- **Coral Wash** (coral-wash): the ground of warning callouts ("if you see this instead...").

### Neutral
- **Paper** (paper): page ground, nav backdrop at 88% with blur, text on ink.
- **Deep Paper** (paper-deep): alternate section band, tip callouts, nav hover, inline code in answers.
- **Sheet** (sheet): raised paper surfaces: chips, prompt cards, link cards, the language toggle, notes laid over windows.
- **Ink** (ink): all type, the command block ground, selected chips, step-number tiles, the comparison section ground, 2px rules that open lists.
- **Soft Ink** (ink-soft): lede, intros and body copy inside steps and answers.
- **Raised Ink** (ink-raised): header cells and the fairness note inside the ink section.
- **Muted** (muted): meta lines, captions, quiet links, footer.
- **Dim Paper** (paper-dim): secondary text on the ink ground.
- **Line** (line): 1px hairlines between steps, facts and FAQ rows; chip and card borders.
- **Status Green** (green): the live dot inside "connected" and tool-call pills.

### Illustration chrome
The fig-*, term-* colors belong to the reproduced apps, not the brand: Figma editor ground and panels (fig-bg, fig-panel, fig-text, fig-blue for selection) and the terminal (term-bg, term-text). Use them only inside app-window illustrations, and keep them faithful to the real app.

### Named Rules
**The Four Inks Rule.** Lime is action and done, violet is the AI, coral is warning. Never swap their meanings, and never introduce a fourth saturated brand hue.

**The Lime Needs Ink Rule.** Lime is a ground or a mark on ink, never text on paper. Text on lime is always ink.

## Typography

**Display Font:** Bricolage Grotesque (with ui-sans-serif, system-ui)
**Body Font:** the system sans stack (ui-sans-serif, -apple-system, Segoe UI)
**Label/Mono Font:** JetBrains Mono (with ui-monospace, SFMono-Regular, Menlo)

**Character:** A heavy, tightly tracked grotesque with some personality speaks the headlines; the reader's own system font carries instructions so they feel native; mono marks exactly what gets typed or pasted.

### Hierarchy
- **Display** (800, clamp(2.6rem, 4.5vw, 4.1rem), 1.05, -0.04em): the hero headline only. Emphasized words get a lime highlighter band (62-92% of the line) rather than italics or color.
- **Headline** (800, clamp(2rem, 4vw, 3.2rem), 1.05, -0.03em): section titles, balanced wrapping.
- **Title** (700, clamp(1.6rem, 2.6vw, 2.1rem), -0.02em): step titles; 1.35rem for definition terms, 1.08rem for link-card titles.
- **Body** (400, 17px / 16px under 640px, 1.6): running text. Intros cap at 40em, answers at 46em. Lede is 1.14rem in soft ink, max 36em.
- **Label** (600-700, 0.92rem): nav links, chips, picker label, button text (0.86-0.95rem, 700).
- **Mono** (400, 0.86rem, 1.55): command blocks, inline code (0.88em), terminal and code-editor bodies (0.8rem).

### Named Rules
**The Typed Things Are Mono Rule.** Anything the reader types, pastes or sees in a terminal is JetBrains Mono. Prompts meant for the AI chat are plain body text, because they are natural language.

## Layout

A centered container (min(100% - 32px, 1180px)) under a 68px sticky, blurred paper nav. Hero and setup steps use asymmetric two-column grids with the text column narrower than the illustration (roughly 5:6 to 5.6:6.4), gap clamp(28px, 5vw, 72px). Sections pad clamp(64px, 9vw, 112px); setup steps pad 56px and are separated by 1px hairlines. The app picker is a sticky bar under the nav (top 68px) so the reader's chosen app stays in reach while reading steps.

At 1020px all two-column grids and the prompt grid collapse to one column. At 640px body drops to 16px, nav links become a horizontally scrolling row under the brand, the picker unsticks, Figma's layers panel hides, and the comparison table turns into labeled stacked rows.

## Elevation & Depth

Surfaces are flat paper separated by tone (paper, deep paper, sheet) and hairlines. Shadow is reserved for things that sit on the desk: app windows cast a long soft shadow, and paper notes and the command block cast a lighter one. Nothing on the page itself (cards, chips, callouts) floats.

### Shadow Vocabulary
- **Desk object** (`box-shadow: 0 2px 2px rgba(0,0,0,.08), 0 30px 60px -24px rgba(23,21,19,.55)`): every app-window illustration.
- **Paper note** (`box-shadow: 0 1px 1px rgba(23,21,19,.06), 0 14px 34px -12px rgba(23,21,19,.28)`): notes laid over windows, the hero install command.

### Named Rules
**The Desk Object Rule.** Only illustrated windows and the notes laid on them cast shadows. Page components stay flat and use tone or a 1px line for separation.

## Shapes

Corners are soft but not bubbly: 12px for buttons and callouts, 14px for windows, command blocks and cards, 16px for the comparison table frame, 28px for the one lime closing panel. Choices and statuses (nav links, chips, language toggle, connected pill, tool pills) are full pills. Lists that open a block (definition rows, FAQ) start with a 2px ink rule and continue with 1px hairlines. The tile mark's geometry recurs: a rounded ink square rotated -5deg holds the step numbers in lime, and the mark itself (paper square, violet and coral circles, dashed lime square) appears in the nav, the illustrated login card and the closing panel.

## Components

### Buttons
Tactile and direct; the single primary action is always "Copy".
- **Shape:** gently rounded (10px for Copy inside a command block, 12px for standalone buttons).
- **Copy (primary):** lime ground, ink 700 label, sits inside the command block with a 6px inset. Hover lightens the lime; after copying it turns to sheet. On light prompt cards it inverts to ink with paper text and turns lime once copied.
- **Press:** 1px downward nudge on active; transitions use the expo-out ease at 0.2s.
- **Replay (tertiary):** muted text button under illustrations, paper wash on hover.

### Chips
- **Style:** sheet ground, 1.5px line border, pill, 600 label.
- **State:** hover darkens the border to ink; selected (radio semantics) fills ink with paper text. The app picker is the signature use: one choice re-speaks every command, screen and illustration.

### Cards / Containers
- **Corner Style:** 14px.
- **Background:** sheet on paper.
- **Shadow Strategy:** flat (see Elevation).
- **Border:** 1px line; link cards darken to ink and lift 2px on hover.
- **Internal Padding:** 16px 18px.

### Callouts
- **Ok / Warn / Tip:** 12px corners, 14px 16px padding, an icon column of 22px. Ok on lime wash, warn on coral wash, tip on deep paper. Each states the expected result or the fix in plain language.

### Command Block
Ink bar, paper mono text prefixed with a lime "$ ", Copy button on the right, paper-note shadow. The prompt variant is a sheet card with a line border and body-font text for things to say to the AI.

### Navigation
Sticky 68px bar, paper at 88% with blur, hairline appears once scrolled. Brand is the tile mark plus 800-weight display name. Links are 600 pills with a deep-paper hover; the EN/ID toggle is a pill group with the active language filled ink.

### App Window Illustrations (signature)
Faithful replicas of macOS Terminal, Figma's dark editor with layers panel and dotted canvas, a light code editor with line numbers, a Figma quick-actions palette, and an AI chat. Each has a 36px title bar with traffic lights, 14px corners and the desk-object shadow. Content builds in with a 0.45s rise on the expo-out ease, staggered per element; a sheet note tilted -2deg may lie across a window to narrate. Under reduced motion everything shows in its finished state.

## Do's and Don'ts

### Do:
- **Do** keep lime for action and done, violet for the AI, coral for warnings (The Four Inks Rule).
- **Do** put ink text on lime and lime only on ink or as a ground.
- **Do** draw illustrations as faithful app windows with a title bar, 14px corners and the desk-object shadow.
- **Do** set anything typed or pasted in JetBrains Mono inside an ink command block with a lime Copy button.
- **Do** use pills for choices and statuses, 12-14px corners for surfaces.
- **Do** tilt the tile mark and step-number tiles -5deg and laid-on notes -2deg, and no further.
- **Do** give every animation a finished, static state under prefers-reduced-motion.

### Don't:
- **Don't** use Figma's logo or imply affiliation with Figma, Inc.
- **Don't** add a fourth saturated brand hue or swap the meaning of lime, violet and coral.
- **Don't** set lime text on paper.
- **Don't** cast shadows on page components; shadows belong to desk objects only.
- **Don't** restyle the reproduced app chrome (fig-*, term-*) into brand colors; it must look like the real app.
