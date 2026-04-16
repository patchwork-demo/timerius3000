import { component$, useSignal, $ } from "@builder.io/qwik";
import type { Timer } from "~/lib/storage";

interface TimerCardProps {
  timer: Timer;
  onStart$: () => void;
  onPause$: () => void;
  onReset$: () => void;
  onDelete$: () => void;
  onLoopToggle$: () => void;
  onLabelChange$: (label: string) => void;
  onDurationChange$: (seconds: number) => void;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function parseDurationInput(value: string): number | null {
  // Accept mm:ss, hh:mm:ss, or plain minutes
  const parts = value.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 1) return parts[0] * 60;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

export const TimerCard = component$((props: TimerCardProps) => {
  const { timer } = props;
  const editingDuration = useSignal(formatTime(timer.duration));
  const durationError = useSignal(false);

  const progress =
    timer.duration > 0
      ? Math.max(0, Math.min(1, (timer.duration - timer.remaining) / timer.duration))
      : 0;

  const isIdle = timer.status === "idle";
  const isRunning = timer.status === "running";
  const isPaused = timer.status === "paused";
  const isFinished = timer.status === "finished";

  const handleDurationBlur$ = $(() => {
    const secs = parseDurationInput(editingDuration.value);
    if (secs === null || secs <= 0) {
      durationError.value = true;
      editingDuration.value = formatTime(timer.duration);
      return;
    }
    durationError.value = false;
    props.onDurationChange$(secs);
  });

  return (
    <div
      class={[
        "flex flex-col gap-3 rounded-2xl border p-4 shadow-sm transition-all",
        isFinished
          ? "border-green-400 bg-green-50 animate-pulse dark:border-green-600 dark:bg-green-950"
          : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800",
      ]}
    >
      {/* Label */}
      <input
        type="text"
        value={timer.label}
        placeholder="Timer name"
        disabled={isRunning || isFinished}
        class="w-full rounded-lg border border-transparent bg-transparent text-sm font-semibold text-gray-700 placeholder-gray-300 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-default dark:text-gray-200 dark:placeholder-gray-600 dark:focus:border-indigo-500 dark:focus:ring-indigo-900"
        onInput$={(e) =>
          props.onLabelChange$((e.target as HTMLInputElement).value)
        }
      />

      {/* Countdown / Duration input */}
      {isIdle ? (
        <div class="flex flex-col gap-1">
          <input
            type="text"
            value={editingDuration.value}
            placeholder="mm:ss or minutes"
            class={[
              "w-full rounded-lg border px-2 py-1 text-center font-mono text-3xl font-bold tracking-widest focus:outline-none focus:ring-2 bg-transparent",
              durationError.value
                ? "border-red-400 text-red-500 focus:ring-red-200 dark:border-red-600 dark:text-red-400"
                : "border-gray-200 text-gray-800 focus:ring-indigo-100 dark:border-gray-600 dark:text-gray-100 dark:focus:ring-indigo-900",
            ]}
            onInput$={(e) => {
              editingDuration.value = (e.target as HTMLInputElement).value;
              durationError.value = false;
            }}
            onBlur$={handleDurationBlur$}
          />
          {durationError.value && (
            <span class="text-xs text-red-400">Use mm:ss or plain minutes</span>
          )}
        </div>
      ) : (
        <div
          class={[
            "text-center font-mono text-4xl font-bold tracking-widest",
            isFinished ? "text-green-600 dark:text-green-400" : "text-gray-800 dark:text-gray-100",
          ]}
        >
          {isFinished ? "Done!" : formatTime(timer.remaining)}
        </div>
      )}

      {/* Progress bar */}
      {!isIdle && (
        <div class="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
          <div
            class={[
              "h-full rounded-full transition-all duration-1000",
              isFinished ? "bg-green-400" : "bg-indigo-500",
            ]}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      {/* Controls */}
      <div class="flex items-center gap-2">
        {/* Start / Pause / Resume */}
        {(isIdle || isPaused) && (
          <button
            class="flex-1 rounded-xl bg-indigo-600 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-95 transition-transform dark:bg-indigo-500 dark:hover:bg-indigo-600"
            onClick$={props.onStart$}
          >
            {isPaused ? "Resume" : "Start"}
          </button>
        )}
        {isRunning && (
          <button
            class="flex-1 rounded-xl bg-amber-500 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 active:scale-95 transition-transform dark:bg-amber-600 dark:hover:bg-amber-700"
            onClick$={props.onPause$}
          >
            Pause
          </button>
        )}

        {/* Reset */}
        {(isPaused || isFinished) && (
          <button
            class="rounded-xl bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-200 active:scale-95 transition-transform dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            onClick$={props.onReset$}
          >
            Reset
          </button>
        )}

        {/* Loop toggle */}
        <button
          title={timer.loop ? "Loop on" : "Loop off"}
          class={[
            "rounded-xl px-2.5 py-1.5 text-sm transition-colors",
            timer.loop
              ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 dark:hover:bg-indigo-900"
              : "bg-gray-100 text-gray-400 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-500 dark:hover:bg-gray-600",
          ]}
          onClick$={props.onLoopToggle$}
        >
          ↻
        </button>

        {/* Delete */}
        <button
          title="Delete timer"
          class="rounded-xl bg-gray-100 px-2.5 py-1.5 text-sm text-gray-400 hover:bg-red-100 hover:text-red-500 transition-colors dark:bg-gray-700 dark:text-gray-500 dark:hover:bg-red-900/40 dark:hover:text-red-400"
          onClick$={props.onDelete$}
        >
          ✕
        </button>
      </div>
    </div>
  );
});
