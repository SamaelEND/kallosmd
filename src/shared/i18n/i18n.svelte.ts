/**
 * Store reactivo nativo de internacionalización (i18n) para markdown Studio.
 * Construido con runas reactivas de Svelte 5 ($state, $derived) sin dependencias externas.
 */

import {
  translations,
  SUPPORTED_LOCALES,
  type SupportedLocale,
  type TranslationSchema,
  type LocaleOption,
} from "./index";

const LOCALE_STORAGE_KEY = "md_studio_locale";

class I18nStore {
  locale = $state<SupportedLocale>("es");

  /**
   * Retorna el esquema completo de cadenas para el idioma activo de forma reactiva.
   */
  current = $derived<TranslationSchema>(translations[this.locale]);

  readonly supportedLocales: LocaleOption[] = SUPPORTED_LOCALES;

  constructor() {
    this.initLocale();
  }

  /**
   * Inicializa el idioma desde parámetro URL (?lang=en|es), localStorage o el navegador.
   */
  private initLocale(): void {
    if (typeof window === "undefined") return;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlLang = urlParams.get("lang");
      if (urlLang === "es" || urlLang === "en") {
        this.locale = urlLang;
        localStorage.setItem(LOCALE_STORAGE_KEY, urlLang);
        this.applyDocumentLang(urlLang);
        urlParams.delete("lang");
        const newQuery = urlParams.toString();
        const cleanUrl = window.location.pathname + (newQuery ? `?${newQuery}` : "") + window.location.hash;
        window.history.replaceState({}, "", cleanUrl);
        return;
      }

      const saved = localStorage.getItem(LOCALE_STORAGE_KEY) as SupportedLocale | null;
      if (saved === "es" || saved === "en") {
        this.locale = saved;
        this.applyDocumentLang(saved);
        return;
      }

      // Si no existe valor guardado, detectar el idioma del navegador
      const browserLang = (navigator.language || "").toLowerCase();
      const detected: SupportedLocale = browserLang.startsWith("es") ? "es" : "en";
      this.locale = detected;
      this.applyDocumentLang(detected);
    } catch (e) {
      console.warn("No se pudo acceder a localStorage para i18n:", e);
      this.locale = "es";
    }
  }

  /**
   * Establece un nuevo idioma activo y lo persiste en localStorage.
   */
  setLocale(newLocale: SupportedLocale): void {
    if (this.locale === newLocale) return;
    this.locale = newLocale;

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
      } catch (e) {
        console.warn("Error guardando locale en localStorage:", e);
      }
      this.applyDocumentLang(newLocale);
    }
  }

  /**
   * Alterna rápidamente entre 'es' y 'en'.
   */
  toggleLocale(): void {
    this.setLocale(this.locale === "es" ? "en" : "es");
  }

  /**
   * Actualiza el atributo lang del elemento raíz <html>.
   */
  private applyDocumentLang(lang: SupportedLocale): void {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }

  /**
   * Obtiene una traducción por sección y clave tipada.
   */
  t<S extends keyof TranslationSchema, K extends keyof TranslationSchema[S]>(
    section: S,
    key: K,
  ): TranslationSchema[S][K] {
    return this.current[section][key];
  }

  /**
   * Interpola variables dentro de una plantilla de texto (p.ej. {name}, {count}).
   */
  interpolate(template: string, params: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => {
      return params[key] !== undefined ? String(params[key]) : `{${key}}`;
    });
  }
}

export const i18n = new I18nStore();
