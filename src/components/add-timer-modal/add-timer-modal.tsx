import { component$, useSignal, useTask$, $, type Signal, type QRL } from "@builder.io/qwik";

function formatPreset(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (s === 0) return `${m}m`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDurationField(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function parseDurationInput(value: string): number | null {
  const parts = value.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 1) return parts[0] * 60;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

export interface AddTimerModalConfirm {
  duration: number;
  label: string;
  loop: boolean;
  startNow: boolean;
}

interface AddTimerModalProps {
  open: Signal<boolean>;
  fixedPresets: number[];
  recentPresets: number[];
  popularPresets: number[];
  onConfirm$: QRL<(opts: AddTimerModalConfirm) => void>;
  onDismiss$: QRL<() => void>;
}

export const AddTimerModal = component$((props: AddTimerModalProps) => {
  const selectedDuration = useSignal(5 * 60);
  const labelDraft = useSignal("");
  const loopDraft = useSignal(false);
  const customInput = useSignal("");
  const customError = useSignal(false);

  useTask$(({ track }) => {
    track(() => props.open.value);
    if (!props.open.value) return;
    const def = 5 * 60;
    selectedDuration.value = def;
    labelDraft.value = "";
    loopDraft.value = false;
    customError.value = false;
    customInput.value = formatDurationField(def);
  });

  const pickDuration$ = $((secs: number) => {
    selectedDuration.value = secs;
    customInput.value = formatDurationField(secs);
    customError.value = false;
  });

  const applyCustomBlur$ = $(() => {
    const trimmed = customInput.value.trim();
    if (trimmed === "") {
      customInput.value = formatDurationField(selectedDuration.value);
      customError.value = false;
      return;
    }
    const secs = parseDurationInput(trimmed);
    if (secs === null || secs <= 0) {
      customError.value = true;
      customInput.value = formatDurationField(selectedDuration.value);
      return;
    }
    customError.value = false;
    selectedDuration.value = secs;
    customInput.value = formatDurationField(secs);
  });

  const close$ = $(() => {
    props.onDismiss$();
  });

  const confirm$ = $((startNow: boolean) => {
    const trimmed = customInput.value.trim();
    const parsed = trimmed === "" ? selectedDuration.value : parseDurationInput(trimmed);
    if (parsed === null || parsed <= 0) {
      customError.value = true;
      return;
    }
    customError.value = false;
    selectedDuration.value = parsed;
    props.onConfirm$({
      duration: parsed,
      label: labelDraft.value.trim(),
      loop: loopDraft.value,
      startNow,
    });
  });

  return (
    <>
      {props.open.value && (
        <div class="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            class="absolute inset-0 bg-black/40 dark:bg-black/60"
            aria-label="Close dialog"
            onClick$={close$}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-timer-modal-title"
            class="relative z-10 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
          >
            <div class="mb-4 flex items-start justify-between gap-3">
              <h2 id="add-timer-modal-title" class="text-lg font-bold text-gray-900 dark:text-white">
                Add timer
              </h2>
              <button
                type="button"
                class="rounded-lg px-2 py-1 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                onClick$={close$}
              >
                Close
              </button>
            </div>

            <div class="mb-4 space-y-3">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Quick
                </span>
                {props.fixedPresets.map((secs) => (
                  <button
                    key={secs}
                    type="button"
                    class={[
                      "rounded-lg px-3 py-1 text-sm font-medium transition-colors",
                      selectedDuration.value === secs
                        ? "bg-indigo-600 text-white dark:bg-indigo-500"
                        : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/70",
                    ]}
                    onClick$={() => pickDuration$(secs)}
                  >
                    {formatPreset(secs)}
                  </button>
                ))}
              </div>

              {props.recentPresets.length > 0 && (
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    Recent
                  </span>
                  {props.recentPresets.map((secs) => (
                    <button
                      key={secs}
                      type="button"
                      class={[
                        "rounded-lg px-3 py-1 text-sm font-medium transition-colors",
                        selectedDuration.value === secs
                          ? "bg-gray-700 text-white dark:bg-gray-500"
                          : "bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600",
                      ]}
                      onClick$={() => pickDuration$(secs)}
                    >
                      {formatPreset(secs)}
                    </button>
                  ))}
                </div>
              )}

              {props.popularPresets.length > 0 && (
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    Popular
                  </span>
                  {props.popularPresets.map((secs) => (
                    <button
                      key={secs}
                      type="button"
                      class={[
                        "rounded-lg px-3 py-1 text-sm font-medium transition-colors",
                        selectedDuration.value === secs
                          ? "bg-amber-600 text-white dark:bg-amber-500"
                          : "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/60",
                      ]}
                      onClick$={() => pickDuration$(secs)}
                    >
                      {formatPreset(secs)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label class="mb-3 block">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Custom duration
              </span>
              <input
                type="text"
                class={[
                  "w-full rounded-lg border px-3 py-2 text-sm text-gray-900 dark:bg-gray-800 dark:text-white",
                  customError.value
                    ? "border-red-500 dark:border-red-500"
                    : "border-gray-200 dark:border-gray-600",
                ]}
                placeholder="mm:ss or minutes"
                bind:value={customInput}
                onInput$={() => {
                  customError.value = false;
                }}
                onBlur$={applyCustomBlur$}
              />
              {customError.value && (
                <span class="mt-1 block text-xs text-red-600 dark:text-red-400">Enter a valid duration.</span>
              )}
            </label>

            <label class="mb-3 block">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Label (optional)
              </span>
              <input
                type="text"
                class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                placeholder="e.g. Pasta"
                bind:value={labelDraft}
              />
            </label>

            <label class="mb-6 flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                class="size-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800"
                bind:checked={loopDraft}
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">Loop when time is up</span>
            </label>

            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                class="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                onClick$={close$}
              >
                Cancel
              </button>
              <button
                type="button"
                class="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200 dark:hover:bg-indigo-900"
                onClick$={() => confirm$(false)}
              >
                Add
              </button>
              <button
                type="button"
                class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-[0.98] dark:bg-indigo-500 dark:hover:bg-indigo-600"
                onClick$={() => confirm$(true)}
              >
                Add and start
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
