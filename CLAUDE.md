# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun start          # Dev server with SSR + auto-open browser
bun run dev        # Dev server with SSR (no browser open)
bun run build      # Production build (client + server + type check)
bun run build.types  # Type check only
bun run lint       # ESLint on src/**/*.ts*
bun run fmt        # Prettier format (write)
bun run fmt.check  # Prettier format (check only)
bun run preview    # Local production preview
```

No test runner is configured.

## Architecture

This is a **Qwik City** SSR web app. Qwik's key distinction: apps are *resumable* (no hydration step) — components serialize state to HTML and resume on the client without re-executing.

**Entry points** — three rendering modes, each with its own entry file:
- `src/entry.ssr.tsx` — primary SSR entry (used by dev, build, preview)
- `src/entry.dev.tsx` — client-only rendering for quick dev iteration
- `src/entry.preview.tsx` — Vite preview middleware

**Routing** is directory-based under `src/routes/`. A file at `src/routes/foo/index.tsx` maps to `/foo`. Shared layouts use `layout.tsx` files.

**Structure:**
- `src/root.tsx` — app shell (`QwikCityProvider` → `RouterHead` + `RouterOutlet`)
- `src/routes/layout.tsx` — shared layout: fixed footer nav linking `/` ↔ `/audio`
- `src/routes/index.tsx` — main timer page: timer grid, preset bar, global 1s tick
- `src/routes/audio/index.tsx` — audio management: upload, preview, activate, volume
- `src/components/timer-card/timer-card.tsx` — individual timer card (idle/running/paused/finished)
- `src/lib/storage.ts` — localStorage helpers: timers, settings, recent/freq preset history
- `src/lib/db.ts` — IndexedDB helpers: audio blob storage (`timerius3000` DB, `audio` store)

**Key patterns:**
- All browser API access (IndexedDB, AudioContext, Notification, setInterval) lives inside `useVisibleTask$` — this is Qwik's hook for client-only side effects.
- Timer state is a `useStore({ timers: Timer[] })` in `index.tsx`; a single `setInterval` ticks all running timers and saves to localStorage on each change.
- Audio on finish: loads blob from IndexedDB → Web Audio API with GainNode for volume; falls back to a 440 Hz oscillator beep if no custom audio is set.
- Preset history: `recordPresetUse(duration)` in `src/lib/storage.ts` maintains both a `recent[]` (last 3 unique, newest-first) and a `freq{}` map (duration → count) in localStorage key `t3k_presets`.

**TypeScript path alias:** `~/` resolves to `src/`.

**No server adapter is installed yet.** To deploy, run `bun run qwik add` and choose an adapter (Cloudflare, Netlify, Express, etc.).
