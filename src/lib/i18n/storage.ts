import type { Direction, Language } from "./types";

export const LANGUAGE_STORAGE_KEY = "lemon.language.v1";

export function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "ar";
}

export function getLanguageDirection(lang: Language): Direction {
  return lang === "ar" ? "rtl" : "ltr";
}

export function getStoredLanguage(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    // Storage restricted
  }
  return "en";
}

export function setStoredLanguage(lang: Language): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // Storage restricted
  }
}

// Runs before paint to set document direction and language attribute without layout flicker.
export const LANGUAGE_INIT_SCRIPT = `(function(){try{var l=localStorage.getItem("${LANGUAGE_STORAGE_KEY}");if(l!=="ar"&&l!=="en")l="en";document.documentElement.lang=l;document.documentElement.setAttribute("dir",l==="ar"?"rtl":"ltr");}catch(e){document.documentElement.lang="en";document.documentElement.setAttribute("dir","ltr");}})();`;
