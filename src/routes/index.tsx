import { component$, useStore, useVisibleTask$, $ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { TimerCard } from "~/components/timer-card/timer-card";
import {
  type Timer,
  loadTimers,
  saveTimers,
  recordPresetUse,
  getRecentPresets,
  getMostUsedPresets,
} from "~/lib/storage";
import { playAlarm } from "~/lib/alarm";

function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function formatPreset(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (s === 0) return `${m}m`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const FIXED_PRESETS = [1, 5, 10, 25].map((m) => m * 60);


function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function updateTabTitle(timers: Timer[]) {
  const running = timers.filter((t) => t.status === "running");
  if (running.length === 0) {
    document.title = "Timerius 3000";
  } else {
    const closest = running.reduce((a, b) => (a.remaining <= b.remaining ? a : b));
    document.title = `${formatTime(closest.remaining)} · Timerius 3000`;
  }
}

function fireNotification(label: string) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "granted") {
    new Notification(label || "Timer done!", { body: "Time's up! ⏱" });
  }
}

export default component$(() => {
  const state = useStore<{
    timers: Timer[];
    recentPresets: number[];
    popularPresets: number[];
  }>({
    timers: [],
    recentPresets: [],
    popularPresets: [],
  });

  // Load from localStorage on mount, set up tick
  useVisibleTask$(() => {
    state.timers = loadTimers();
    state.recentPresets = getRecentPresets();
    state.popularPresets = getMostUsedPresets();
    updateTabTitle(state.timers);

    const tick = setInterval(() => {
      let changed = false;
      for (const t of state.timers) {
        if (t.status !== "running") continue;
        t.remaining -= 1;
        changed = true;
        if (t.remaining <= 0) {
          t.remaining = 0;
          if (t.loop) {
            t.remaining = t.duration;
          } else {
            t.status = "finished";
          }
          playAlarm();
          fireNotification(t.label);
        }
      }
      if (changed) saveTimers(state.timers);
      updateTabTitle(state.timers);
    }, 1000);

    return () => {
      clearInterval(tick);
      document.title = "Timerius 3000";
    };
  });

  const addTimer = $((duration: number) => {
    state.timers.push({
      id: makeId(),
      label: "",
      duration,
      remaining: duration,
      status: "idle",
      loop: false,
    });
    recordPresetUse(duration);
    state.recentPresets = getRecentPresets();
    state.popularPresets = getMostUsedPresets();
    saveTimers(state.timers);
  });

  const requestNotifPermission = $(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  });

  return (
    <main class="mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Timerius 3000</h1>
        <button
          class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-95 transition-transform dark:bg-indigo-500 dark:hover:bg-indigo-600"
          onClick$={() => addTimer(5 * 60)}
        >
          + Add Timer
        </button>
      </div>

      {/* Preset bar */}
      <div class="mb-6 space-y-2 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Quick
          </span>
          {FIXED_PRESETS.map((secs) => (
            <button
              key={secs}
              class="rounded-lg bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/70"
              onClick$={() => addTimer(secs)}
            >
              {formatPreset(secs)}
            </button>
          ))}
        </div>

        {state.recentPresets.length > 0 && (
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Recent
            </span>
            {state.recentPresets.map((secs) => (
              <button
                key={secs}
                class="rounded-lg bg-gray-50 px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                onClick$={() => addTimer(secs)}
              >
                {formatPreset(secs)}
              </button>
            ))}
          </div>
        )}

        {state.popularPresets.length > 0 && (
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Popular
            </span>
            {state.popularPresets.map((secs) => (
              <button
                key={secs}
                class="rounded-lg bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/60"
                onClick$={() => addTimer(secs)}
              >
                {formatPreset(secs)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Timer grid */}
      {state.timers.length === 0 ? (
        <div class="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 py-16 text-gray-400 dark:border-gray-700 dark:text-gray-600">
          <span class="text-4xl">⏱</span>
          <p class="text-sm">No timers yet. Add one above or pick a preset.</p>
        </div>
      ) : (
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state.timers.map((timer, i) => (
            <TimerCard
              key={timer.id}
              timer={timer}
              onStart$={$(() => {
                if (state.timers[i].remaining <= 0) {
                  state.timers[i].remaining = state.timers[i].duration;
                }
                state.timers[i].status = "running";
                saveTimers(state.timers);
                requestNotifPermission();
              })}
              onPause$={$(() => {
                state.timers[i].status = "paused";
                saveTimers(state.timers);
              })}
              onReset$={$(() => {
                state.timers[i].remaining = state.timers[i].duration;
                state.timers[i].status = "idle";
                saveTimers(state.timers);
              })}
              onDelete$={$(() => {
                state.timers.splice(i, 1);
                saveTimers(state.timers);
              })}
              onLoopToggle$={$(() => {
                state.timers[i].loop = !state.timers[i].loop;
                saveTimers(state.timers);
              })}
              onLabelChange$={$((label: string) => {
                state.timers[i].label = label;
                saveTimers(state.timers);
              })}
              onDurationChange$={$((seconds: number) => {
                state.timers[i].duration = seconds;
                state.timers[i].remaining = seconds;
                saveTimers(state.timers);
              })}
            />
          ))}
        </div>
      )}
    </main>
  );
});

export const head: DocumentHead = {
  title: "Timerius 3000",
  meta: [{ name: "description", content: "Multiple simultaneous timers with custom audio" }],
};
