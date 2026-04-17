import {
  component$,
  useSignal,
  useTask$,
  useVisibleTask$,
  $,
  type Signal,
  type QRL,
} from "@builder.io/qwik";
import { isBrowser } from "@builder.io/qwik/build";
import {
  DurationPicker,
  MAX_DURATION_SECONDS,
  clampTotalToParts,
  totalFromParts,
} from "~/components/add-timer-modal/duration-picker";

function formatPreset(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (s === 0) return `${m}m`;
  return `${m}:${String(s).padStart(2, "0")}`;
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
  const labelDraft = useSignal("");
  const loopDraft = useSignal(false);
  const customError = useSignal(false);

  const draftHours = useSignal(0);
  const draftMinutes = useSignal(5);
  const draftSeconds = useSignal(0);
  const hoursInputRef = useSignal<HTMLInputElement | undefined>();

  useTask$(({ track }) => {
    track(() => props.open.value);
    if (!props.open.value) return;
    const def = 5 * 60;
    const p = clampTotalToParts(def);
    draftHours.value = p.h;
    draftMinutes.value = p.m;
    draftSeconds.value = p.s;
    labelDraft.value = "";
    loopDraft.value = false;
    customError.value = false;
  });

  useTask$(({ track }) => {
    track(() => draftHours.value);
    track(() => draftMinutes.value);
    track(() => draftSeconds.value);
    if (
      totalFromParts(draftHours.value, draftMinutes.value, draftSeconds.value) >
      0
    ) {
      customError.value = false;
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task -- focus first duration field (hours) after dialog paints
  useVisibleTask$(({ track }) => {
    track(() => props.open.value);
    if (!props.open.value || !isBrowser) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        hoursInputRef.value?.focus();
      });
    });
  });

  const pickDuration$ = $((secs: number) => {
    const capped = Math.min(MAX_DURATION_SECONDS, Math.max(0, secs));
    const p = clampTotalToParts(capped);
    draftHours.value = p.h;
    draftMinutes.value = p.m;
    draftSeconds.value = p.s;
    customError.value = false;
  });

  const close$ = $(() => {
    props.onDismiss$();
  });

  const confirm$ = $((startNow: boolean) => {
    const total = totalFromParts(
      draftHours.value,
      draftMinutes.value,
      draftSeconds.value,
    );
    const duration = clampTotalToParts(total);
    const secs = totalFromParts(duration.h, duration.m, duration.s);
    if (secs <= 0) {
      customError.value = true;
      return;
    }
    draftHours.value = duration.h;
    draftMinutes.value = duration.m;
    draftSeconds.value = duration.s;
    customError.value = false;
    props.onConfirm$({
      duration: secs,
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
              <h2
                id="add-timer-modal-title"
                class="text-lg font-bold text-gray-900 dark:text-white"
              >
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
                      totalFromParts(
                        draftHours.value,
                        draftMinutes.value,
                        draftSeconds.value,
                      ) === secs
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
                        totalFromParts(
                          draftHours.value,
                          draftMinutes.value,
                          draftSeconds.value,
                        ) === secs
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
                        totalFromParts(
                          draftHours.value,
                          draftMinutes.value,
                          draftSeconds.value,
                        ) === secs
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

            <DurationPicker
              hours={draftHours}
              minutes={draftMinutes}
              seconds={draftSeconds}
              hoursInputRef={hoursInputRef}
            />

            {customError.value && (
              <span
                class="mb-3 block text-xs text-red-600 dark:text-red-400"
                role="status"
                aria-live="polite"
              >
                Enter a duration greater than zero.
              </span>
            )}

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
              <span class="text-sm text-gray-700 dark:text-gray-300">
                Loop when time is up
              </span>
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
