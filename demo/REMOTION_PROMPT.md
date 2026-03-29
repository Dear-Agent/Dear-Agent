# Remotion Video - DEAR Agent Demo

## Prompt to generate the Remotion project

Create a Remotion video project that showcases an autonomous blockchain agent called "DEAR" (Detect, Attest, Govern, Bridge, List). The video reads a timeline JSON file and renders an animated terminal overlay on top of a painterly background.

### Setup

```bash
npx create-video@latest dear-demo --template blank
cd dear-demo
npm install
```

Copy `demo/timeline-mock.json` (or `demo/timeline.json` from a real capture) into the Remotion `public/` folder.

### Video Specs

- Duration: 45 seconds (1350 frames at 30fps)
- Resolution: 1920x1080
- FPS: 30

### Color Palette (Romantic oil painting)

```ts
const PALETTE = {
  gold: "#C6A84B",      // aged gold - headings, APPROVED
  sienna: "#6B3222",    // burnt sienna - attestation, LLM
  amber: "#B8863A",     // warm amber - detect, list, body text
  green: "#2C3A2A",     // forest green - bridge, guardrails
  umber: "#3A2518",     // deep umber - timestamps, dim text
  charcoal: "#1C1C1C",  // smoky black - backgrounds
  cream: "#D4C4A0",     // parchment - default text
  red: "#8B3A3A",       // muted burgundy - errors, rejections
};
```

### Font

Use a monospace font: "JetBrains Mono", "Fira Code", or "IBM Plex Mono". Load via Google Fonts in Remotion.

### Structure

The video has 3 layers:

#### Layer 1: Background
The Romantic oil painting background image (generated separately). Full bleed, slightly darkened (opacity 0.85 black overlay) so the terminal text is readable. Subtle slow zoom-in (1.0 to 1.03 scale over 45s) for a cinematic feel.

#### Layer 2: ASCII Banner (frames 0-150, ~5 seconds)
Centered on screen, fade in letter by letter:

```
  ____  _____    _    ____
 |  _ \| ____|  / \  |  _ \
 | | | |  _|   / _ \ | |_) |
 | |_| | |___ / ___ \|  _ <
 |____/|_____/_/   \_\_| \_\
```

Color: gold (#C6A84B). Below it, fade in subtitle:
"Autonomous Institutional Treasury Agent" in amber (#B8863A).
Then "Detect . Attest . Govern . Bridge . List" in sienna (#6B3222).

The banner fades out at frame 150, transitioning to the terminal.

#### Layer 3: Terminal Window (frames 90 onwards)

A terminal window component positioned center-screen with:
- Rounded corners (8px), no window chrome/buttons
- Background: charcoal (#1C1C1C) at 92% opacity
- Subtle border: 1px solid umber (#3A2518)
- Padding: 24px
- Width: 80% of viewport, height: 70%
- Subtle box-shadow with umber tones

The terminal reads `timeline.json` and renders each entry when `currentFrame >= entry.t * fps / 1000`.

Each log line renders as:

```tsx
<div style={{ fontFamily: "monospace", fontSize: 14, lineHeight: 1.6 }}>
  <span style={{ color: PALETTE.umber, opacity: 0.6 }}>{timestamp}</span>
  {" "}
  <span style={{ color: phaseColor, fontWeight: "bold" }}>[{phase}]</span>
  {" "}
  <span style={{ color: messageColor }}>{message}</span>
</div>
```

Phase colors:
- INIT, AGENT, GOVERN -> gold
- DETECT, LIST -> amber
- ATTEST, LLM -> sienna
- BRIDGE, GUARDRAILS -> green
- ERROR, FATAL -> red

Message colors by type:
- "success" -> gold, slightly brighter
- "error" -> red
- "decision" -> gold
- "tx" -> green
- "status" -> cream

#### Animations

1. **Line appear**: Each new log line slides in from bottom with spring animation (damping: 20, stiffness: 120). Opacity 0 to 1 over 10 frames.

2. **Phase tag pulse**: When a new phase starts (phase changes from previous line), the [PHASE] tag briefly scales to 1.1x and back with a glow effect matching the phase color.

3. **Data reveal**: If an entry has `data`, render it on the next line indented, with a slight delay (5 frames after the main line). Use dim cream color. Format key=value pairs.

4. **Auto-scroll**: The terminal auto-scrolls to keep the latest line visible. Show max 18 lines at a time. Older lines scroll up and fade out.

5. **Cursor blink**: A blinking block cursor (gold) at the end of the last line. 500ms on/off cycle.

6. **LLM thinking**: When phase is "LLM", show a subtle pulsing dots animation "..." in amber to indicate the AI is processing.

#### Special Moments

- **APPROVED** (t=33000): Brief gold flash overlay (opacity 0 to 0.08 to 0 over 15 frames). The word "APPROVED" renders in bold gold with a subtle glow.

- **Asset detected** (t=6200): The token address fades in with a typewriter effect, character by character.

- **Cycle complete** (t=40000): All terminal text briefly brightens, then dims to normal. Satisfying visual punctuation.

#### Outro (last 3 seconds)

Terminal fades to 30% opacity. Centered text appears:

"Humans watch. The agent operates."

In gold (#C6A84B), italic, with a slow fade-in. Below in small dim text:
"Built for Rayls Hackathon #2 - Cannes 2026"

### Timeline JSON Format

```ts
interface TimelineEntry {
  t: number;       // milliseconds from start
  phase: string;   // INIT, DETECT, ATTEST, GOVERN, BRIDGE, LIST, MONITOR, LLM, AGENT, BANNER
  message: string;
  data?: Record<string, unknown>;
  type: "status" | "success" | "error" | "decision" | "tx" | "banner";
}

interface Timeline {
  meta: { totalDurationMs: number; entryCount: number };
  palette: Record<string, string>;
  timeline: TimelineEntry[];
}
```

### Remotion Component Structure

```
src/
  Root.tsx              # RegisterRoot with composition
  Timeline.tsx          # Main composition, reads JSON, orchestrates layers
  components/
    Background.tsx      # Painting background with slow zoom
    Banner.tsx          # ASCII art intro
    Terminal.tsx         # Terminal window container
    LogLine.tsx          # Single animated log line
    Cursor.tsx           # Blinking cursor
    Outro.tsx            # Closing text
  lib/
    colors.ts           # Palette constants
    useTimeline.ts      # Hook to read and filter timeline entries by frame
```

### Key Remotion APIs to use

- `useCurrentFrame()` and `useVideoConfig()` for timing
- `interpolate()` for opacity/position animations
- `spring()` for bouncy line entrance
- `Sequence` for section timing
- `staticFile()` to load timeline.json and background image

### Render command

```bash
npx remotion render Timeline out/dear-demo.mp4
```
