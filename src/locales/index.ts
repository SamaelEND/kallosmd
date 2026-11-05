/**
 * Punto de entrada para el sistema de internacionalización (i18n).
 */

import { es, type TranslationSchema } from "./es";
import { en } from "./en";

export type SupportedLocale = "es" | "en";

export interface LocaleOption {
  id: SupportedLocale;
  label: string;
  flag: string;
}

export const SUPPORTED_LOCALES: LocaleOption[] = [
  { id: "es", label: "Español", flag: "ES" },
  { id: "en", label: "English", flag: "EN" },
];

export const translations: Record<SupportedLocale, TranslationSchema> = {
  es,
  en,
};

export type { TranslationSchema };

