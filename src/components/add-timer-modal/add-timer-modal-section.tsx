import { component$, useSignal, $, type QRL } from "@builder.io/qwik";
import { AddTimerModal, type AddTimerModalConfirm } from "~/components/add-timer-modal/add-timer-modal";

const FIXED_PRESETS = [1, 5, 10, 25].map((m) => m * 60);

interface AddTimerModalSectionProps {
  recentPresets: number[];
  popularPresets: number[];
  onAddTimer$: QRL<(opts: AddTimerModalConfirm) => void>;
}

export const AddTimerModalSection = component$((props: AddTimerModalSectionProps) => {
  const addModalOpen = useSignal(false);

  const closeAddModal$ = $(() => {
    addModalOpen.value = false;
  });

  const confirmAddTimer$ = $((opts: AddTimerModalConfirm) => {
    props.onAddTimer$(opts);
    addModalOpen.value = false;
  });

  return (
    <>
      <AddTimerModal
        open={addModalOpen}
        fixedPresets={FIXED_PRESETS}
        recentPresets={props.recentPresets}
        popularPresets={props.popularPresets}
        onDismiss$={closeAddModal$}
        onConfirm$={confirmAddTimer$}
      />

      <div class="sticky top-0 z-20 -mx-4 mb-6 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-white/80 dark:border-gray-700 dark:bg-gray-950/95 dark:supports-backdrop-filter:bg-gray-950/80">
        <button
          type="button"
          class="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-[0.99] transition-transform dark:bg-indigo-500 dark:hover:bg-indigo-600"
          onClick$={() => {
            addModalOpen.value = true;
          }}
        >
          + Add Timer
        </button>
      </div>
    </>
  );
});
