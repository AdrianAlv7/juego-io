import catalog from "./translations.json";

export const LANGUAGE_STORAGE_KEY = "deliver_language";
const LEGACY_LANGUAGE_STORAGE_KEY = "repartidor_language";

const defaultLanguage = String(catalog?.meta?.defaultLanguage || "es");
const availableLanguages = Array.isArray(catalog?.meta?.availableLanguages)
  ? catalog.meta.availableLanguages.map((entry) => String(entry || "").trim())
  : [defaultLanguage];

let activeLanguage = loadLanguageFromStorage();

function loadLanguageFromStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return normalizeLanguage(defaultLanguage);
  }
  const stored =
    window.localStorage.getItem(LANGUAGE_STORAGE_KEY) ||
    window.localStorage.getItem(LEGACY_LANGUAGE_STORAGE_KEY) ||
    defaultLanguage;
  return normalizeLanguage(stored);
}

function normalizeLanguage(languageCode) {
  const normalized = String(languageCode || "").trim().toLowerCase();
  if (availableLanguages.includes(normalized)) return normalized;
  return defaultLanguage;
}

function getByPath(root, path) {
  if (!root || !path) return undefined;
  const parts = String(path).split(".");
  let cursor = root;
  for (const part of parts) {
    if (!cursor || typeof cursor !== "object" || !(part in cursor)) {
      return undefined;
    }
    cursor = cursor[part];
  }
  return cursor;
}

function interpolate(template, params = {}) {
  if (typeof template !== "string") return "";
  return template.replace(/\{([^}]+)\}/g, (_match, key) => {
    const value = params[key];
    return value === undefined || value === null ? `{${key}}` : String(value);
  });
}

export function getLanguage() {
  return activeLanguage;
}

export function getAvailableLanguages() {
  return [...availableLanguages];
}

export function getLanguageLabel(languageCode, fallback = "") {
  const normalized = normalizeLanguage(languageCode);
  const localized =
    getByPath(catalog?.[activeLanguage], `languages.${normalized}`) ||
    getByPath(catalog?.[defaultLanguage], `languages.${normalized}`) ||
    "";
  if (localized) return String(localized);
  return fallback || normalized.toUpperCase();
}

export function setLanguage(languageCode) {
  const normalized = normalizeLanguage(languageCode);
  activeLanguage = normalized;
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
  }
  return normalized;
}

export function t(path, params = {}, fallback = "") {
  const localized =
    getByPath(catalog?.[activeLanguage], path) ||
    getByPath(catalog?.[defaultLanguage], path);
  if (typeof localized !== "string") {
    return String(fallback || path);
  }
  return interpolate(localized, params);
}

export function getLanguageTemplate() {
  return catalog?.template || {};
}
