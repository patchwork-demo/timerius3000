import { component$, useStore, useTask$, $, noSerialize } from "@builder.io/qwik";
import { isBrowser } from "@builder.io/qwik/build";
import type { DocumentHead } from "@builder.io/qwik-city";
import { type AudioEntry, getAllAudio, addAudio, deleteAudio, updateAudio } from "~/lib/db";
import { loadSettings, saveSettings } from "~/lib/storage";
import { playAlarm, stopAlarm } from "~/lib/alarm";

/** Mutable holder so split QRL chunks can update preview context without reassigning an ESM import binding. */
const previewCtxHolder = { active: null as AudioContext | null };

function stopPreview(state: Pick<AudioPageState, "previewingId" | "previewingSnippetId" | "previewingFull">): void {
  if (previewCtxHolder.active) {
    previewCtxHolder.active.close();
    previewCtxHolder.active = null;
  }
  state.previewingId = null;
  state.previewingSnippetId = null;
  state.previewingFull = false;
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Qwik stores must not hold raw Blobs (serialization); wrap for the UI store only. */
function entriesForStore(entries: AudioEntry[]): AudioEntry[] {
  return entries.map((e) => ({ ...e, blob: noSerialize(e.blob) as unknown as Blob }));
}

const ALLOWED_AUDIO_MIME = new Set([
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/webm",
  "audio/flac",
]);

const AUDIO_BY_EXTENSION = /\.(mp3|ogg|oga|wav|m4a|aac|webm|flac)$/i;

function isAllowedAudioFile(file: File): boolean {
  if (ALLOWED_AUDIO_MIME.has(file.type)) return true;
  if (file.type.startsWith("audio/")) return true;
  if (!file.type || file.type === "application/octet-stream") {
    return AUDIO_BY_EXTENSION.test(file.name);
  }
  return false;
}

interface AudioPageState {
  entries: AudioEntry[];
  activeAudioId: number | null;
  volume: number;
  loopCount: number;
  loopFade: boolean;
  loopGapSeconds: number;
  uploading: boolean;
  previewingId: number | null;
  previewingSnippetId: number | null;
  previewingFull: boolean;
  expandedSnippetId: number | null;
  loadingDurationId: number | null;
  error: string;
}

export default component$(() => {
  const state = useStore<AudioPageState>({
    entries: [],
    activeAudioId: null,
    volume: 0.7,
    loopCount: 1,
    loopFade: false,
    loopGapSeconds: 0,
    uploading: false,
    previewingId: null,
    previewingSnippetId: null,
    previewingFull: false,
    expandedSnippetId: null,
    loadingDurationId: null,
    error: "",
  });

  useTask$(async () => {
    if (!isBrowser) return;
    const s = loadSettings();
    state.activeAudioId = s.activeAudioId;
    state.volume = s.volume ?? 0.7;
    state.loopCount = s.loopCount ?? 1;
    state.loopFade = s.loopFade ?? false;
    state.loopGapSeconds = s.loopGapSeconds ?? 0;
    state.entries = entriesForStore(await getAllAudio());
  });

  // ── Upload ────────────────────────────────────────────────────────────────

  const handleUpload$ = $(async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!isAllowedAudioFile(file)) {
      state.error = "Unsupported format. Use mp3, ogg, wav, m4a, aac, webm, or flac.";
      input.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      state.error = "File too large (max 10 MB).";
      input.value = "";
      return;
    }

    state.error = "";
    state.uploading = true;
    try {
      let duration: number | undefined;
      try {
        const ctx = new AudioContext();
        const ab = await file.arrayBuffer();
        const buf = await ctx.decodeAudioData(ab);
        duration = buf.duration;
        ctx.close();
      } catch {
        void 0;
      }

      const id = await addAudio(file.name, file, duration);
      state.entries = entriesForStore(await getAllAudio());
      if (state.activeAudioId === null) {
        state.activeAudioId = id;
        saveSettings({ activeAudioId: id });
      }
    } catch {
      state.error = "Upload failed. Please try again.";
    } finally {
      state.uploading = false;
      input.value = "";
    }
  });

  // ── Sound list actions ────────────────────────────────────────────────────

  const handleDelete$ = $(async (id: number) => {
    await deleteAudio(id);
    if (state.activeAudioId === id) {
      state.activeAudioId = null;
      saveSettings({ activeAudioId: null });
    }
    if (state.expandedSnippetId === id) state.expandedSnippetId = null;
    state.entries = entriesForStore(await getAllAudio());
  });

  const handleActivate$ = $((id: number) => {
    state.activeAudioId = id;
    saveSettings({ activeAudioId: id });
  });

  const handlePreview$ = $(async (idx: number) => {
    const entry = state.entries[idx];
    if (!entry?.id) return;
    stopPreview(state);
    stopAlarm();
    state.previewingId = entry.id;
    try {
      const ctx = new AudioContext();
      previewCtxHolder.active = ctx;
      const ab = await entry.blob.arrayBuffer();
      const buf = await ctx.decodeAudioData(ab);
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = state.volume;
      source.buffer = buf;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
      source.onended = () => {
        ctx.close();
        if (previewCtxHolder.active === ctx) {
          previewCtxHolder.active = null;
          state.previewingId = null;
        }
      };
    } catch {
      state.previewingId = null;
    }
  });

  // ── Snippet ───────────────────────────────────────────────────────────────

  const handleExpandSnippet$ = $(async (idx: number) => {
    const entry = state.entries[idx];
    if (!entry?.id) return;
    const id = entry.id;

    if (state.expandedSnippetId === id) {
      state.expandedSnippetId = null;
      return;
    }

    state.expandedSnippetId = id;

    // Decode duration on demand for entries uploaded before this feature
    if (!state.entries[idx].duration) {
      state.loadingDurationId = id;
      try {
        const ctx = new AudioContext();
        const ab = await state.entries[idx].blob.arrayBuffer();
        const buf = await ctx.decodeAudioData(ab);
        ctx.close();
        state.entries[idx].duration = buf.duration;
        await updateAudio(id, { duration: buf.duration });
      } catch {
        void 0;
      }
      state.loadingDurationId = null;
    }
  });

  const handleSnippetStart$ = $(async (idx: number, value: number) => {
    const entry = state.entries[idx];
    if (!entry?.id || !entry.duration) return;
    stopPreview(state);
    const end = entry.snippetEnd ?? entry.duration;
    const clamped = Math.min(value, end - 0.5);
    state.entries[idx].snippetStart = clamped;
    await updateAudio(entry.id, { snippetStart: clamped });
  });

  const handleSnippetEnd$ = $(async (idx: number, value: number) => {
    const entry = state.entries[idx];
    if (!entry?.id || !entry.duration) return;
    stopPreview(state);
    const start = entry.snippetStart ?? 0;
    const clamped = Math.max(value, start + 0.5);
    state.entries[idx].snippetEnd = clamped;
    await updateAudio(entry.id, { snippetEnd: clamped });
  });

  const handlePreviewSnippet$ = $(async (idx: number) => {
    const entry = state.entries[idx];
    if (!entry?.id) return;
    stopPreview(state);
    stopAlarm();
    state.previewingSnippetId = entry.id;
    try {
      const ctx = new AudioContext();
      previewCtxHolder.active = ctx;
      const ab = await entry.blob.arrayBuffer();
      const buf = await ctx.decodeAudioData(ab);
      const start = entry.snippetStart ?? 0;
      const end = entry.snippetEnd ?? buf.duration;
      const dur = Math.max(0.1, end - start);
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = state.volume;
      source.buffer = buf;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0, start, dur);
      source.onended = () => {
        ctx.close();
        if (previewCtxHolder.active === ctx) {
          previewCtxHolder.active = null;
          state.previewingSnippetId = null;
        }
      };
    } catch {
      state.previewingSnippetId = null;
    }
  });

  const handleStop$ = $(() => {
    stopPreview(state);
    stopAlarm();
  });

  // ── Volume & Loop settings ────────────────────────────────────────────────

  const handleVolumeChange$ = $((v: number) => {
    state.volume = v;
    saveSettings({ volume: v });
  });

  const handleLoopCount$ = $((v: number) => {
    const n = Math.max(1, Math.min(20, Math.floor(v)));
    state.loopCount = n;
    if (n <= 1) state.loopFade = false;
    saveSettings({ loopCount: n, loopFade: n <= 1 ? false : state.loopFade });
  });

  const handleLoopFade$ = $(() => {
    state.loopFade = !state.loopFade;
    saveSettings({ loopFade: state.loopFade });
  });

  const handleLoopGap$ = $((v: number) => {
    const n = Math.max(0, Math.min(30, v));
    state.loopGapSeconds = n;
    saveSettings({ loopGapSeconds: n });
  });

  const handlePreviewFull$ = $(async () => {
    stopPreview(state);
    state.previewingFull = true;
    try {
      await playAlarm();
    } finally {
      state.previewingFull = false;
    }
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main class="mx-auto max-w-lg px-4 py-6">
      <h1 class="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Audio Settings</h1>

      {/* ── Upload ── */}
      <section class="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Upload Sound
        </h2>
        <label class="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 p-6 text-sm text-gray-500 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-600 dark:text-gray-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400">
          <span class="text-2xl">🎵</span>
          <span>{state.uploading ? "Uploading…" : "Click to choose mp3 / ogg / wav"}</span>
          <span class="text-xs text-gray-400 dark:text-gray-500">Max 10 MB</span>
          <input type="file" accept="audio/*" class="hidden" disabled={state.uploading} onChange$={handleUpload$} />
        </label>
        {state.error && <p class="mt-2 text-sm text-red-500">{state.error}</p>}
      </section>

      {/* ── Volume ── */}
      <section class="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Alarm Volume
        </h2>
        <div class="flex items-center gap-3">
          <span class="text-lg">🔈</span>
          <input
            type="range" min={0} max={1} step={0.01} value={state.volume}
            class="flex-1 accent-indigo-500"
            onInput$={(e) => handleVolumeChange$(Number((e.target as HTMLInputElement).value))}
          />
          <span class="w-10 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
            {Math.round(state.volume * 100)}%
          </span>
          <span class="text-lg">🔊</span>
        </div>
      </section>

      {/* ── Loop Settings ── */}
      <section class="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Loop Settings
        </h2>

        <div class="space-y-3">
          {/* Count */}
          <div class="flex items-center justify-between gap-3">
            <label class="text-sm text-gray-700 dark:text-gray-300">Play count</label>
            <div class="flex items-center gap-2">
              <input
                type="number" min={1} max={20} value={state.loopCount}
                class="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1 text-center text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                onInput$={(e) => handleLoopCount$(Number((e.target as HTMLInputElement).value))}
              />
              <span class="text-sm text-gray-500 dark:text-gray-400">times</span>
            </div>
          </div>

          {/* Fade */}
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm text-gray-700 dark:text-gray-300">Fade effect</p>
              <p class="text-xs text-gray-400 dark:text-gray-500">Volume decreases each loop (100% → 50%)</p>
            </div>
            <button
              disabled={state.loopCount <= 1}
              class={[
                "relative h-6 w-11 rounded-full transition-colors disabled:opacity-40",
                state.loopFade ? "bg-indigo-600 dark:bg-indigo-500" : "bg-gray-200 dark:bg-gray-600",
              ]}
              onClick$={handleLoopFade$}
            >
              <span
                class={[
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                  state.loopFade ? "left-5.5 translate-x-0" : "left-0.5",
                ]}
              />
            </button>
          </div>

          {/* Gap */}
          <div class="flex items-center justify-between gap-3">
            <label class="text-sm text-gray-700 dark:text-gray-300">Gap between loops</label>
            <div class="flex items-center gap-2">
              <input
                type="number" min={0} max={30} step={0.5} value={state.loopGapSeconds}
                class="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1 text-center text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                onInput$={(e) => handleLoopGap$(Number((e.target as HTMLInputElement).value))}
              />
              <span class="text-sm text-gray-500 dark:text-gray-400">sec</span>
            </div>
          </div>

          {/* Preview full alarm — two buttons so each `onClick$` is a plain QRL (no QRL/plain ternary). */}
          {state.previewingFull ? (
            <button
              class={[
                "w-full rounded-xl py-2 text-sm font-semibold text-white transition-colors",
                "bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700",
              ]}
              onClick$={handleStop$}
            >
              ■ Stop
            </button>
          ) : (
            <button
              class={[
                "w-full rounded-xl py-2 text-sm font-semibold text-white transition-colors",
                "bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600",
              ]}
              onClick$={handlePreviewFull$}
            >
              ▶ Preview Alarm
            </button>
          )}
        </div>
      </section>

      {/* ── Saved Sounds ── */}
      <section class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Saved Sounds
        </h2>

        {state.entries.length === 0 ? (
          <div class="flex flex-col items-center gap-2 py-8 text-gray-400 dark:text-gray-600">
            <span class="text-3xl">🎵</span>
            <p class="text-sm">No audio uploaded yet. A beep will play as fallback.</p>
          </div>
        ) : (
          <ul class="divide-y divide-gray-100 dark:divide-gray-700">
            {state.entries.map((entry, idx) => {
              const audioId = entry.id;
              if (audioId == null) return null;

              const isActive = audioId === state.activeAudioId;
              const isPreviewing = audioId === state.previewingId;
              const isExpanded = audioId === state.expandedSnippetId;
              const isLoadingDur = audioId === state.loadingDurationId;

              const dur = entry.duration ?? 0;
              const snipStart = entry.snippetStart ?? 0;
              const snipEnd = entry.snippetEnd ?? dur;
              const startPct = dur > 0 ? (snipStart / dur) * 100 : 0;
              const endPct = dur > 0 ? (snipEnd / dur) * 100 : 100;
              const snippetSet = entry.snippetStart !== undefined || entry.snippetEnd !== undefined;

              return (
                <li key={audioId} class="py-3">
                  {/* Main row */}
                  <div class="flex items-center gap-2">
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{entry.name}</p>
                      <p class="text-xs text-gray-400 dark:text-gray-500">
                        {formatSize(entry.size)}
                        {entry.duration ? ` · ${fmtTime(entry.duration)}` : ""}
                        {snippetSet ? ` · snippet ${fmtTime(snipStart)}–${fmtTime(snipEnd)}` : ""}
                      </p>
                    </div>
                    {isPreviewing ? (
                      <button
                        class={[
                          "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                          "bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/70",
                        ]}
                        onClick$={handleStop$}
                      >
                        ■ Stop
                      </button>
                    ) : (
                      <button
                        class={[
                          "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                          "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600",
                        ]}
                        onClick$={() => handlePreview$(idx)}
                      >
                        ▶ Full
                      </button>
                    )}
                    <button
                      class={[
                        "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                        isActive
                          ? "bg-indigo-600 text-white dark:bg-indigo-500"
                          : "bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-indigo-900/40 dark:hover:text-indigo-300",
                      ]}
                      onClick$={() => handleActivate$(audioId)}
                    >
                      {isActive ? "✓ Active" : "Use"}
                    </button>
                    <button
                      class="rounded-lg px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-gray-500 dark:hover:bg-red-900/40 dark:hover:text-red-400"
                      onClick$={() => handleDelete$(audioId)}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Snippet toggle */}
                  <button
                    class="mt-1.5 flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-indigo-600 dark:text-gray-500 dark:hover:text-indigo-400"
                    onClick$={() => handleExpandSnippet$(idx)}
                  >
                    <span>{isExpanded ? "▲" : "▼"}</span>
                    <span>Snippet</span>
                    {snippetSet && !isExpanded && (
                      <span class="ml-1 rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                        set
                      </span>
                    )}
                  </button>

                  {/* Snippet editor */}
                  {isExpanded && (
                    <div class="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
                      {isLoadingDur ? (
                        <p class="text-center text-xs text-gray-400 dark:text-gray-500">Analysing audio…</p>
                      ) : !dur ? (
                        <p class="text-center text-xs text-gray-400 dark:text-gray-500">
                          Duration unavailable. Try re-uploading this file.
                        </p>
                      ) : (
                        <>
                          {/* Range visualization */}
                          <div class="relative mb-3 h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                            <div
                              class="absolute h-full rounded-full bg-indigo-400 dark:bg-indigo-600"
                              style={{ left: `${startPct}%`, right: `${100 - endPct}%` }}
                            />
                          </div>

                          {/* Start slider */}
                          <div class="mb-2 flex items-center gap-2">
                            <span class="w-8 text-right text-xs text-gray-500 dark:text-gray-400">Start</span>
                            <input
                              type="range"
                              min={0}
                              max={Math.max(0, (entry.snippetEnd ?? dur) - 0.5)}
                              step={0.1}
                              value={snipStart}
                              class="flex-1 accent-indigo-500"
                              onInput$={(e) =>
                                handleSnippetStart$(idx, Number((e.target as HTMLInputElement).value))
                              }
                            />
                            <span class="w-10 text-xs font-medium text-gray-600 dark:text-gray-300">
                              {fmtTime(snipStart)}
                            </span>
                          </div>

                          {/* End slider */}
                          <div class="mb-3 flex items-center gap-2">
                            <span class="w-8 text-right text-xs text-gray-500 dark:text-gray-400">End</span>
                            <input
                              type="range"
                              min={Math.min(dur, (entry.snippetStart ?? 0) + 0.5)}
                              max={dur}
                              step={0.1}
                              value={snipEnd}
                              class="flex-1 accent-indigo-500"
                              onInput$={(e) =>
                                handleSnippetEnd$(idx, Number((e.target as HTMLInputElement).value))
                              }
                            />
                            <span class="w-10 text-xs font-medium text-gray-600 dark:text-gray-300">
                              {fmtTime(snipEnd)}
                            </span>
                          </div>

                          {/* Info + preview row */}
                          <div class="flex items-center justify-between">
                            <span class="text-xs text-gray-400 dark:text-gray-500">
                              {fmtTime(Math.max(0, snipEnd - snipStart))} of {fmtTime(dur)}
                            </span>
                            {state.previewingSnippetId === audioId ? (
                              <button
                                class={[
                                  "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                                  "bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/70",
                                ]}
                                onClick$={handleStop$}
                              >
                                ■ Stop
                              </button>
                            ) : (
                              <button
                                class={[
                                  "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                                  "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/70",
                                ]}
                                onClick$={() => handlePreviewSnippet$(idx)}
                              >
                                ▶ Preview snippet
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p class="mt-3 text-xs text-gray-400 dark:text-gray-500">
          {state.activeAudioId === null
            ? "No custom sound active — fallback beep will play."
            : "Custom sound active."}
        </p>
      </section>
    </main>
  );
});

export const head: DocumentHead = {
  title: "Audio Settings — Timerius 3000",
};
