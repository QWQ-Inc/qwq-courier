"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useI18n } from "./i18n-provider";

export function ThemeToggle({ className }: { className?: string }) {
  const { dict } = useI18n();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={dict.common.themeToggle}
      aria-label={dict.common.themeToggle}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-card text-slate-500 transition hover:text-slate-800 ${className ?? ""}`}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
