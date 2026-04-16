import { component$, useStore, useVisibleTask$, $ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { type AudioEntry, getAllAudio, addAudio, deleteAudio } from "~/lib/db";
import { loadSettings, saveSettings } from "~/lib/storage";

interface AudioPageState {
  entries: AudioEntry[];
  activeAudioId: number | null;
  volume: number;
  uploading: boolean;
  previewingId: number | null;
  error: string;
}

export default component$(() => {
  const state = useStore<AudioPageState>({
    entries: [],
    activeAudioId: null,
    volume: 0.7,
    uploading: false,
    previewingId: null,
    error: "",
  });

  useVisibleTask$(async () => {
    const settings = loadSettings();
    state.activeAudioId = settings.activeAudioId;
    state.volume = settings.volume ?? 0.7;
    state.entries = await getAllAudio();
  });

  const handleUpload$ = $(async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const allowed = ["audio/mpeg", "audio/ogg", "audio/wav", "audio/mp4", "audio/aac", "audio/webm"];
    if (!allowed.includes(file.type)) {
      state.error = "Unsupported format. Use mp3, ogg, or wav.";
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
      const id = await addAudio(file.name, file);
      state.entries = await getAllAudio();
      // Auto-activate if it's the first upload
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

  const handleDelete$ = $(async (id: number) => {
    await deleteAudio(id);
    if (state.activeAudioId === id) {
      state.activeAudioId = null;
      saveSettings({ activeAudioId: null });
    }
    state.entries = await getAllAudio();
  });

  const handleActivate$ = $((id: number) => {
    state.activeAudioId = id;
    saveSettings({ activeAudioId: id });
  });

  const handleVolumeChange$ = $((value: number) => {
    state.volume = value;
    saveSettings({ volume: value });
  });

  const handlePreview$ = $(async (entry: AudioEntry) => {
    if (!entry.id) return;
    state.previewingId = entry.id;
    try {
      const ctx = new AudioContext();
      const arrayBuf = await entry.blob.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = state.volume;
      source.buffer = audioBuf;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
      source.onended = () => {
        ctx.close();
        state.previewingId = null;
      };
    } catch {
      state.previewingId = null;
    }
  });

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <main class="mx-auto max-w-lg px-4 py-6">
      <h1 class="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Audio Settings</h1>

      {/* Upload */}
      <section class="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Upload Sound
        </h2>
        <label class="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 p-6 text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors dark:border-gray-600 dark:text-gray-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400">
          <span class="text-2xl">🎵</span>
          <span>{state.uploading ? "Uploading…" : "Click to choose mp3 / ogg / wav"}</span>
          <span class="text-xs text-gray-400 dark:text-gray-500">Max 10 MB</span>
          <input
            type="file"
            accept="audio/*"
            class="hidden"
            disabled={state.uploading}
            onChange$={handleUpload$}
          />
        </label>
        {state.error && (
          <p class="mt-2 text-sm text-red-500">{state.error}</p>
        )}
      </section>

      {/* Volume */}
      <section class="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Alarm Volume
        </h2>
        <div class="flex items-center gap-3">
          <span class="text-lg">🔈</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={state.volume}
            class="flex-1 accent-indigo-500"
            onInput$={(e) =>
              handleVolumeChange$(Number((e.target as HTMLInputElement).value))
            }
          />
          <span class="w-10 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
            {Math.round(state.volume * 100)}%
          </span>
          <span class="text-lg">🔊</span>
        </div>
      </section>

      {/* Saved sounds */}
      <section class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Saved Sounds
        </h2>

        {state.entries.length === 0 ? (
          <div class="flex flex-col items-center gap-2 py-8 text-gray-400 dark:text-gray-600">
            <span class="text-3xl">🎵</span>
            <p class="text-sm">No audio uploaded yet. A beep will play as fallback.</p>
          </div>
        ) : (
          <ul class="divide-y divide-gray-100 dark:divide-gray-700">
            {state.entries.map((entry) => {
              const isActive = entry.id === state.activeAudioId;
              const isPreviewing = entry.id === state.previewingId;
              return (
                <li key={entry.id} class="flex items-center gap-2 py-3">
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{entry.name}</p>
                    <p class="text-xs text-gray-400 dark:text-gray-500">{formatSize(entry.size)}</p>
                  </div>
                  <button
                    class="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50 transition-colors dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    disabled={isPreviewing}
                    onClick$={() => handlePreview$(entry)}
                  >
                    {isPreviewing ? "▶ …" : "▶ Preview"}
                  </button>
                  <button
                    class={[
                      "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                      isActive
                        ? "bg-indigo-600 text-white dark:bg-indigo-500"
                        : "bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-indigo-900/40 dark:hover:text-indigo-300",
                    ]}
                    onClick$={() => handleActivate$(entry.id!)}
                  >
                    {isActive ? "✓ Active" : "Use"}
                  </button>
                  <button
                    class="rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors dark:text-gray-500 dark:hover:bg-red-900/40 dark:hover:text-red-400"
                    onClick$={() => handleDelete$(entry.id!)}
                  >
                    ✕
                  </button>
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
