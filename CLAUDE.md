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

**Root structure:**
- `src/root.tsx` — app shell (`QwikCityProvider` → `RouterHead` + `RouterOutlet`)
- `src/components/router-head/` — dynamic `<head>` management (meta, links, scripts)
- `src/routes/` — page components; `index.tsx` is the home page

**TypeScript path alias:** `~/` resolves to `src/` (e.g. `import { X } from '~/components/...'`).

**No server adapter is installed yet.** To deploy, run `bun run qwik add` and choose an adapter (Cloudflare, Netlify, Express, etc.).
