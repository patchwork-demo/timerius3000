import { component$, useStore, useTask$, $ } from "@builder.io/qwik";
import { isBrowser } from "@builder.io/qwik/build";
import type { DocumentHead } from "@builder.io/qwik-city";
import { TimerCard } from "~/components/timer-card/timer-card";
import { AddTimerModalSection } from "~/components/add-timer-modal/add-timer-modal-section";
import {
  type Timer,
  loadTimers,
  saveTimers,
  recordRecentPresetDuration,
  recordModalTimerStart,
  getRecentPresets,
  getMostUsedPresets,
} from "~/lib/storage";
import { playAlarm, stopAlarm } from "~/lib/alarm";

function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

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

function TimerPageSkeleton() {
  return (
    <div class="animate-pulse space-y-6" aria-hidden="true">
      <div class="-mx-4 border-b border-gray-100 bg-gray-50/80 px-4 py-3 dark:border-gray-800 dark:bg-gray-900/80">
        <div class="h-10 w-full rounded-xl bg-gray-200 dark:bg-gray-700" />
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div class="h-40 rounded-2xl bg-gray-100 dark:bg-gray-800" />
        <div class="h-40 rounded-2xl bg-gray-100 dark:bg-gray-800" />
        <div class="h-40 rounded-2xl bg-gray-100 dark:bg-gray-800" />
      </div>
    </div>
  );
}

export default component$(() => {
  const state = useStore<{
    booting: boolean;
    timers: Timer[];
    recentPresets: number[];
    popularPresets: number[];
  }>({
    booting: true,
    timers: [],
    recentPresets: [],
    popularPresets: [],
  });

  // SSR runs this task once with isBrowser false, then resumes the hook slot as "done" so the
  // body is skipped on the client. { eagerness: "load" } registers qinit during SSR so the task
  // runs again in the browser (localStorage + tick).
  useTask$(
    () => {
      if (!isBrowser) return;
      state.timers = loadTimers();
      state.recentPresets = getRecentPresets();
      state.popularPresets = getMostUsedPresets();
      state.booting = false;
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
    },
    { eagerness: "load" },
  );

  const requestNotifPermission = $(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  });

  const commitAddTimer$ = $(
    (opts: { duration: number; label: string; loop: boolean; startNow: boolean }) => {
      const status = opts.startNow ? "running" : "idle";
      const remaining = opts.duration;
      state.timers.push({
        id: makeId(),
        label: opts.label,
        duration: opts.duration,
        remaining,
        status,
        loop: opts.loop,
      });
      recordRecentPresetDuration(opts.duration);
      if (opts.startNow) {
        recordModalTimerStart(opts.duration);
        requestNotifPermission();
      }
      state.recentPresets = getRecentPresets();
      state.popularPresets = getMostUsedPresets();
      saveTimers(state.timers);
    },
  );

  return (
    <main class="mx-auto max-w-4xl px-4 py-6" aria-busy={state.booting}>
      {state.booting ? (
        <TimerPageSkeleton />
      ) : (
        <>
          <AddTimerModalSection
            recentPresets={state.recentPresets}
            popularPresets={state.popularPresets}
            onAddTimer$={commitAddTimer$}
          />

          {state.timers.length === 0 ? (
            <div class="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 py-16 text-gray-400 dark:border-gray-700 dark:text-gray-600">
              <span class="text-4xl">⏱</span>
              <p class="text-sm">No timers yet. Add one with the button above.</p>
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
                  onStopAudio$={$(() => stopAlarm())}
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
        </>
      )}
    </main>
  );
});

export const head: DocumentHead = {
  title: "Timerius 3000",
  meta: [{ name: "description", content: "Multiple simultaneous timers with custom audio" }],
};
