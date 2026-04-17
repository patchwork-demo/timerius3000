import {
  component$,
  useSignal,
  useVisibleTask$,
  $,
  type Signal,
  type QRL,
} from "@builder.io/qwik";
import { isBrowser } from "@builder.io/qwik/build";

/** Max duration: 23:59:59 */
export const MAX_DURATION_SECONDS = 23 * 3600 + 59 * 60 + 59;

const ITEM_PX = 40;
const VIEW_PX = 192;
const SPACER_PX = (VIEW_PX - ITEM_PX) / 2;

export function totalFromParts(h: number, m: number, s: number): number {
  return h * 3600 + m * 60 + s;
}

export function clampTotalToParts(total: number): {
  h: number;
  m: number;
  s: number;
} {
  const t = Math.max(0, Math.min(MAX_DURATION_SECONDS, Math.floor(total)));
  return {
    h: Math.floor(t / 3600),
    m: Math.floor((t % 3600) / 60),
    s: t % 60,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function wheelIndex(value: number, max: number): number {
  return Math.min(max, Math.max(0, value));
}

interface WheelColumnProps {
  label: string;
  inputId: string;
  max: number;
  value: Signal<number>;
  inputRef?: Signal<HTMLInputElement | undefined>;
  normalizeAll$: QRL<() => void>;
  onStepUp$: QRL<() => void>;
  onStepDown$: QRL<() => void>;
}

const WheelColumn = component$((props: WheelColumnProps) => {
  const scrollRef = useSignal<HTMLDivElement>();
  const programmatic = useSignal(false);
  const editStr = useSignal<string | null>(null);

  // eslint-disable-next-line qwik/no-use-visible-task -- sync wheel scrollTop (needs mounted ref + layout)
  useVisibleTask$(({ track }) => {
    track(() => props.value.value);
    if (!isBrowser) return;
    const el = scrollRef.value;
    if (!el) return;
    programmatic.value = true;
    const idx = wheelIndex(props.value.value, props.max);
    el.scrollTop = idx * ITEM_PX;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        programmatic.value = false;
      });
    });
  });

  const onScroll$ = $(() => {
    if (programmatic.value) return;
    const el = scrollRef.value;
    if (!el) return;
    const idx = Math.min(
      props.max,
      Math.max(0, Math.round(el.scrollTop / ITEM_PX)),
    );
    if (idx !== props.value.value) {
      props.value.value = idx;
      props.normalizeAll$();
    }
  });

  const wIdx = wheelIndex(props.value.value, props.max);

  const inputAttrs: { ref?: Signal<HTMLInputElement | undefined> } = {};
  if (props.inputRef) {
    inputAttrs.ref = props.inputRef;
  }

  return (
    <div class="flex min-w-0 flex-1 flex-col items-center gap-1">
      <label
        for={props.inputId}
        class="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500"
      >
        {props.label}
      </label>
      <div
        ref={scrollRef}
        aria-hidden="true"
        class="w-full max-w-[5.5rem] snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-800/80"
        style={{ height: `${VIEW_PX}px` }}
        onScroll$={onScroll$}
      >
        <div class="snap-none shrink-0" style={{ height: `${SPACER_PX}px` }} />
        {Array.from({ length: props.max + 1 }, (_, i) => (
          <div
            key={i}
            class={[
              "flex h-10 shrink-0 snap-center items-center justify-center text-lg font-semibold tabular-nums",
              i === wIdx
                ? "text-indigo-700 dark:text-indigo-300"
                : "text-gray-400 dark:text-gray-500",
            ]}
          >
            {pad2(i)}
          </div>
        ))}
        <div class="snap-none shrink-0" style={{ height: `${SPACER_PX}px` }} />
      </div>
      <input
        {...inputAttrs}
        id={props.inputId}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        autoComplete="off"
        class="mt-1 w-full max-w-[5.5rem] rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-center text-sm font-semibold tabular-nums text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        value={editStr.value !== null ? editStr.value : pad2(props.value.value)}
        onFocus$={() => {
          editStr.value = String(props.value.value);
        }}
        onInput$={(ev) => {
          const raw = (ev.target as HTMLInputElement).value
            .replace(/\D/g, "")
            .slice(0, 2);
          editStr.value = raw;
          if (raw === "") {
            props.value.value = 0;
          } else {
            const n = parseInt(raw, 10);
            if (!isNaN(n)) {
              props.value.value = n;
            }
          }
        }}
        onBlur$={() => {
          editStr.value = null;
          props.normalizeAll$();
        }}
        onKeyDown$={(ev) => {
          const e = ev as KeyboardEvent;
          if (e.key === "ArrowUp") {
            e.preventDefault();
            props.onStepUp$();
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            props.onStepDown$();
          }
        }}
      />
    </div>
  );
});

export interface DurationPickerProps {
  minutes: Signal<number>;
  seconds: Signal<number>;
  hours: Signal<number>;
  /** First duration field in DOM (hours); focused when the modal opens. */
  hoursInputRef: Signal<HTMLInputElement | undefined>;
}

export const DurationPicker = component$((props: DurationPickerProps) => {
  const normalizeAll$ = $(() => {
    const t = totalFromParts(
      props.hours.value,
      props.minutes.value,
      props.seconds.value,
    );
    const p = clampTotalToParts(t);
    props.hours.value = p.h;
    props.minutes.value = p.m;
    props.seconds.value = p.s;
  });

  const stepMinutesUp$ = $(() => {
    props.minutes.value += 1;
    normalizeAll$();
  });
  const stepMinutesDown$ = $(() => {
    props.minutes.value -= 1;
    normalizeAll$();
  });
  const stepSecondsUp$ = $(() => {
    props.seconds.value += 1;
    normalizeAll$();
  });
  const stepSecondsDown$ = $(() => {
    props.seconds.value -= 1;
    normalizeAll$();
  });
  const stepHoursUp$ = $(() => {
    props.hours.value += 1;
    normalizeAll$();
  });
  const stepHoursDown$ = $(() => {
    props.hours.value -= 1;
    normalizeAll$();
  });

  return (
    <fieldset
      class="mb-3 min-w-0 border-0 p-0"
      aria-describedby="add-timer-duration-hint"
    >
      <legend
        id="add-timer-duration-legend"
        class="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500"
      >
        Custom duration
      </legend>
      <div class="flex items-start justify-center gap-2 sm:gap-3">
        <WheelColumn
          label="Hours"
          inputId="add-timer-duration-hours"
          max={23}
          value={props.hours}
          inputRef={props.hoursInputRef}
          normalizeAll$={normalizeAll$}
          onStepUp$={stepHoursUp$}
          onStepDown$={stepHoursDown$}
        />
        <WheelColumn
          label="Minutes"
          inputId="add-timer-duration-minutes"
          max={59}
          value={props.minutes}
          normalizeAll$={normalizeAll$}
          onStepUp$={stepMinutesUp$}
          onStepDown$={stepMinutesDown$}
        />
        <WheelColumn
          label="Seconds"
          inputId="add-timer-duration-seconds"
          max={59}
          value={props.seconds}
          normalizeAll$={normalizeAll$}
          onStepUp$={stepSecondsUp$}
          onStepDown$={stepSecondsDown$}
        />
      </div>
      <p
        id="add-timer-duration-hint"
        class="mt-2 text-center text-[10px] text-gray-400 dark:text-gray-500"
      >
        Scroll each column or type below. Maximum 23 hours, 59 minutes, 59 seconds.
      </p>
    </fieldset>
  );
});
