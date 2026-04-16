import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

export default component$(() => {
  return (
    <main class="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8">
      <h1 class="text-4xl font-bold text-gray-900">Hi 👋</h1>
      <p class="mt-4 text-lg text-gray-600">
        Can't wait to see what you build with qwik!
        <br />
        Happy coding.
      </p>
    </main>
  );
});

export const head: DocumentHead = {
  title: "Welcome to Qwik",
  meta: [
    {
      name: "description",
      content: "Qwik site description",
    },
  ],
};
