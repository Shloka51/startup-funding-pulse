"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "theme";

/** Dark is the default; light is stored as an explicit choice. */
const currentTheme = (): Theme => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => setTheme(currentTheme()), []);

  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    if (next === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode etc.): the switch still works for this visit.
    }
    setTheme(next);
  }

  const isDark = theme !== "light";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line text-muted transition hover:bg-surface-2 hover:text-ink"
    >
      {theme === null ? null : isDark ? (
        <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.6]">
          <circle cx="10" cy="10" r="3.5" />
          <path
            d="M10 1.75v2M10 16.25v2M1.75 10h2M16.25 10h2M4.17 4.17l1.41 1.41M14.42 14.42l1.41 1.41M4.17 15.83l1.41-1.41M14.42 5.58l1.41-1.41"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.6]">
          <path d="M16.5 12.2A6.75 6.75 0 0 1 7.8 3.5a6.75 6.75 0 1 0 8.7 8.7Z" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

/** Inline, runs before first paint: apply a saved light choice so there's no flash. */
export const themeInitScript = `try{if(localStorage.getItem("${STORAGE_KEY}")==="light")document.documentElement.dataset.theme="light"}catch(e){}`;
