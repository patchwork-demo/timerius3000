import { component$, isDev } from "@builder.io/qwik";
import { QwikCityProvider, RouterOutlet } from "@builder.io/qwik-city";
import { RouterHead } from "./components/router-head/router-head";

import "./global.css";

export default component$(() => {
  /**
   * The root of a QwikCity site always start with the <QwikCityProvider> component,
   * immediately followed by the document's <head> and <body>.
   *
   * Don't remove the `<head>` and `<body>` elements.
   */

  return (
    <QwikCityProvider>
      <head>
        <meta charset="utf-8" />
        {!isDev && (
          <link
            rel="manifest"
            href={`${import.meta.env.BASE_URL}manifest.json`}
          />
        )}
        <RouterHead />
        {/* Runs synchronously before paint to prevent theme flash */}
        <script dangerouslySetInnerHTML={`(function(){try{var t=localStorage.getItem('t3k_theme');var d=matchMedia('(prefers-color-scheme:dark)').matches;if(t==='dark'||(t!=='light'&&d)){document.documentElement.classList.add('dark')}document.documentElement.style.colorScheme=(!t||t==='auto')?'light dark':t}catch(e){}})()`} />
      </head>
      <body lang="en" class="bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <RouterOutlet />
      </body>
    </QwikCityProvider>
  );
});
