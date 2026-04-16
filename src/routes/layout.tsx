import { component$, Slot } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";

export default component$(() => {
  const loc = useLocation();
  const onAudio = loc.url.pathname.startsWith("/audio");

  return (
    <>
      <div class="min-h-screen pb-16">
        <Slot />
      </div>
      <footer class="fixed bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-6 border-t border-gray-200 bg-white/90 py-3 text-sm backdrop-blur">
        <Link
          href="/"
          class={[
            "flex items-center gap-1.5 font-medium transition-colors",
            !onAudio ? "text-indigo-600" : "text-gray-500 hover:text-gray-700",
          ]}
        >
          <span>⏱</span> Timers
        </Link>
        <Link
          href="/audio"
          class={[
            "flex items-center gap-1.5 font-medium transition-colors",
            onAudio ? "text-indigo-600" : "text-gray-500 hover:text-gray-700",
          ]}
        >
          <span>🔊</span> Audio Settings
        </Link>
      </footer>
    </>
  );
});
