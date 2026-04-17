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

This is a **Qwik City** SSR web app. Qwik's key distinction: apps are _resumable_ (no hydration step) — components serialize state to HTML and resume on the client without re-executing.

**Entry points** — three rendering modes, each with its own entry file:

- `src/entry.ssr.tsx` — primary SSR entry (used by dev, build, preview)
- `src/entry.dev.tsx` — client-only rendering for quick dev iteration
- `src/entry.preview.tsx` — Vite preview middleware

**Routing** is directory-based under `src/routes/`. A file at `src/routes/foo/index.tsx` maps to `/foo`. Shared layouts use `layout.tsx` files.

**Structure:**

- `src/root.tsx` — app shell (`QwikCityProvider` → `RouterHead` + `RouterOutlet`)
- `src/routes/layout.tsx` — shared layout: fixed footer nav linking `/` ↔ `/audio`, plus theme switcher (auto/light/dark) stored in `localStorage` key `t3k_theme`, toggling `dark` on `document.documentElement` and `color-scheme`
- `src/routes/index.tsx` — main timer page: sticky **+ Add Timer** opens `AddTimerModal`, timer grid, global 1s tick, `document.title` shows the shortest remaining time among **running** timers (default title when none)
- `src/components/add-timer-modal/add-timer-modal.tsx` (+ `duration-picker.tsx`) — Add Timer dialog: preset rows + iOS-style duration (scroll-snap columns for **hours, minutes, seconds** + numeric inputs, max 23:59:59). Wheels are `aria-hidden`; values are labeled inputs inside a `<fieldset>` / `<legend>`. Tab order follows DOM (no positive `tabIndex`); opening the modal focuses the hours field (`useVisibleTask$`)
- `src/routes/audio/index.tsx` — audio management: upload, snippet selection, preview, activate, volume, loop count / fade / gap settings
- `src/components/timer-card/timer-card.tsx` — individual timer card (idle/running/paused/finished); per-timer loop toggle; finished state **Stop** stops in-flight alarm audio then resets
- `src/lib/storage.ts` — localStorage: timers (`t3k_timers` as `{ timers, savedAt }` for wall-clock catch-up on load), settings (`t3k_settings`: `activeAudioId`, `volume`, `loopCount`, `loopFade`, `loopGapSeconds`), recent/freq preset history (`t3k_presets`)
- `src/lib/db.ts` — IndexedDB: audio blob storage (`timerius3000` DB, `audio` store); entries may include `snippetStart` / `snippetEnd`; `updateAudio()` patches duration/snippet fields
- `src/lib/alarm.ts` — shared `playAlarm()` / `stopAlarm()`: Web Audio playback (snippet slice, optional multi-loop with fade/gap from settings) or 880 Hz sine fallback; `stopAlarm()` closes the context and settles any in-flight `playAlarm()` promise

**Key patterns:**

- **Client-only work is split by route:** `src/routes/layout.tsx` uses `useVisibleTask$` for theme (localStorage + `matchMedia`). The timer and audio pages use **`useTask$` guarded with `isBrowser`** (from `@builder.io/qwik/build`) for localStorage, IndexedDB, `setInterval`, and alarms — not exclusively `useVisibleTask$`. The timer page uses `{ eagerness: "load" }` on that task so it registers during SSR and runs again in the browser after resume.
- Timer state is a `useStore` in `index.tsx`; one `setInterval` ticks running timers, updates tab title, persists via `saveTimers`, and calls `playAlarm()` + optional `Notification` when a non-looping timer hits zero (looping timers reset `remaining` to `duration`).
- On load, `loadTimers()` applies elapsed seconds since `savedAt` to **running** timers (handles finish and looping timers during downtime via `applyElapsed` in `storage.ts`).
- Alarm playback is centralized in `alarm.ts`; `stopAlarm()` is used from finished timer **Stop**, and before audio previews on the audio page so previews do not stack on an active alarm.
- The audio route keeps `AudioEntry` blobs in the UI store only through **`noSerialize`** wrappers (see `entriesForStore`) because Qwik stores must not hold raw `Blob` values for serialization.
- Preset history (`t3k_presets`, versioned JSON): `recordRecentPresetDuration(duration)` on modal **Add** / **Add and start** (last 3 unique recent, newest-first); `recordModalTimerStart(duration)` only on **Add and start** (popular top 6 by that count). Card **Start** does not update popular. Legacy preset files migrate to `version: 2` and reset `freq` so old add-counts do not mix with modal-start counts.

**TypeScript path alias:** `~/` resolves to `src/`.

**No server adapter is installed yet.** To deploy, run `bun run qwik add` and choose an adapter (Cloudflare, Netlify, Express, etc.).
