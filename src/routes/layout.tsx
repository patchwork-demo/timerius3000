import { component$, Slot, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";

type Theme = "light" | "dark" | "auto";

const THEME_CYCLE: Theme[] = ["auto", "light", "dark"];
const THEME_ICON: Record<Theme, string> = { auto: "⚙", light: "☀︎", dark: "☾" };
const THEME_LABEL: Record<Theme, string> = { auto: "Auto", light: "Light", dark: "Dark" };

export default component$(() => {
  const loc = useLocation();
  const onAudio = loc.url.pathname.startsWith("/audio");
  const theme = useSignal<Theme>("auto");

  // Load stored preference and listen for OS changes
  useVisibleTask$(({ cleanup }) => {
    const stored = (localStorage.getItem("t3k_theme") as Theme) || "auto";
    theme.value = stored;

    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onMqChange = () => {
      if (theme.value === "auto") {
        document.documentElement.classList.toggle("dark", mq.matches);
      }
    };
    mq.addEventListener("change", onMqChange);
    cleanup(() => mq.removeEventListener("change", onMqChange));
  });

  // Apply class + color-scheme whenever theme signal changes
  useVisibleTask$(({ track }) => {
    const t = track(() => theme.value);
    const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = t === "dark" || (t === "auto" && prefersDark);
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme =
      t === "auto" ? "light dark" : t;
    localStorage.setItem("t3k_theme", t);
  });

  return (
    <>
      <div class="min-h-screen pb-16">
        <Slot />
      </div>
      <footer class="fixed bottom-0 left-0 right-0 z-10 flex items-center justify-between border-t border-gray-200 bg-white/90 px-4 py-2 text-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/90">
        {/* Nav links */}
        <div class="flex items-center gap-5">
          <Link
            href="/"
            class={[
              "flex items-center gap-1.5 font-medium transition-colors",
              !onAudio
                ? "text-indigo-500 dark:text-indigo-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
            ]}
          >
            <span>⏱</span> Timers
          </Link>
          <Link
            href="/audio"
            class={[
              "flex items-center gap-1.5 font-medium transition-colors",
              onAudio
                ? "text-indigo-500 dark:text-indigo-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
            ]}
          >
            <span>🔊</span> Audio
          </Link>
        </div>

        {/* Theme toggle */}
        <div class="flex items-center gap-0.5 rounded-xl bg-gray-100 p-0.5 dark:bg-gray-800">
          {THEME_CYCLE.map((t) => (
            <button
              key={t}
              title={THEME_LABEL[t]}
              aria-label={`${THEME_LABEL[t]} theme`}
              aria-pressed={theme.value === t}
              class={[
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
                theme.value === t
                  ? "bg-white text-indigo-600 shadow-sm dark:bg-gray-700 dark:text-indigo-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
              ]}
              onClick$={() => {
                theme.value = t;
              }}
            >
              {THEME_ICON[t]}
            </button>
          ))}
        </div>
      </footer>
    </>
  );
});
