/**
 * ES: Store reactivo dedicado exclusivamente a las preferencias de interfaz, vista y tema visual.
 * EN: Reactive store dedicated exclusively to UI preferences, view mode, and visual theme.
 */

import { DEFAULT_CODE_THEME, isCodeThemeId } from "../../shared/utils/codeThemes";
import {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
} from "../../core/markdown/defaultDocument";
import type { FontSize, Settings, ThemeMode, ViewMode } from "../../core/types";

class SettingsStore {
  settings = $state<Settings>(DEFAULT_SETTINGS);

  constructor() {
    this.loadSettings();
  }

  /**
   * ES: Carga la configuración del usuario desde localStorage al iniciar la aplicación.
   * EN: Loads user settings from localStorage on application startup.
   */
  public loadSettings(): void {
    if (typeof window === "undefined") return;

    try {
      const rawTheme = localStorage.getItem(STORAGE_KEYS.THEME);
      const savedTheme: ThemeMode = rawTheme === "light" ? "light" : "dark";
      const rawViewMode = localStorage.getItem(STORAGE_KEYS.VIEW_MODE);
      const savedViewMode: ViewMode =
        rawViewMode === "live" ||
        rawViewMode === "editor" ||
        rawViewMode === "split" ||
        rawViewMode === "preview"
          ? rawViewMode
          : "live";
      const savedFontSize =
        (localStorage.getItem(STORAGE_KEYS.FONT_SIZE) as FontSize) || "medium";
      const rawCodeTheme = localStorage.getItem(STORAGE_KEYS.CODE_THEME);
      const savedCodeTheme = isCodeThemeId(rawCodeTheme)
        ? rawCodeTheme
        : DEFAULT_CODE_THEME;
      const savedSyncScroll =
        localStorage.getItem(STORAGE_KEYS.SYNC_SCROLL) !== "false";
      const savedLineNumbers =
        localStorage.getItem(STORAGE_KEYS.LINE_NUMBERS) !== "false";
      const savedMinimap =
        localStorage.getItem(STORAGE_KEYS.MINIMAP) !== "false";
      const savedSplitRatio =
        parseFloat(localStorage.getItem(STORAGE_KEYS.SPLIT_RATIO) || "50") ||
        50;
      const rawPdfUrl = localStorage.getItem(STORAGE_KEYS.INCLUDE_PDF_URL);
      const savedIncludePdfUrl =
        rawPdfUrl !== null ? rawPdfUrl === "true" : true;

      this.settings = {
        theme: savedTheme,
        viewMode: savedViewMode,
        fontSize: savedFontSize,
        codeTheme: savedCodeTheme,
        syncScroll: savedSyncScroll,
        lineNumbers: savedLineNumbers,
        minimap: savedMinimap,
        splitRatio: Math.max(15, Math.min(85, savedSplitRatio)),
        wordWrap: true,
        includePdfUrl: savedIncludePdfUrl,
      };

      this.applyTheme(savedTheme);
    } catch (error) {
      console.error(
        "Error al cargar configuración inicial desde localStorage:",
        error,
      );
    }
  }

  /**
   * ES: Persiste las opciones de configuración en claves individuales de localStorage.
   * EN: Persists configuration options to individual keys in localStorage.
   */
  private persistSettings(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, this.settings.theme);
      localStorage.setItem(STORAGE_KEYS.VIEW_MODE, this.settings.viewMode);
      localStorage.setItem(STORAGE_KEYS.FONT_SIZE, this.settings.fontSize);
      localStorage.setItem(STORAGE_KEYS.CODE_THEME, this.settings.codeTheme);
      localStorage.setItem(
        STORAGE_KEYS.SYNC_SCROLL,
        String(this.settings.syncScroll),
      );
      localStorage.setItem(
        STORAGE_KEYS.LINE_NUMBERS,
        String(this.settings.lineNumbers),
      );
      localStorage.setItem(STORAGE_KEYS.MINIMAP, String(this.settings.minimap));
      localStorage.setItem(
        STORAGE_KEYS.SPLIT_RATIO,
        String(this.settings.splitRatio),
      );
      localStorage.setItem(
        STORAGE_KEYS.INCLUDE_PDF_URL,
        String(Boolean(this.settings.includePdfUrl)),
      );
    } catch (error) {
      console.error("Error al guardar configuración en localStorage:", error);
    }
  }

  get isDark(): boolean {
    return this.settings.theme === "dark";
  }

  /**
   * ES: Aplica el atributo data-theme y las clases CSS en el nodo raíz <html> sin parpadeos.
   * EN: Applies the data-theme attribute and CSS classes on the root <html> node without flickering.
   */
  applyTheme(theme: ThemeMode): void {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const isDark = theme === "dark";

    const currentTheme = root.getAttribute("data-theme");
    const hasCorrectClass = isDark
      ? root.classList.contains("dark")
      : root.classList.contains("light");
    if (currentTheme === theme && hasCorrectClass) return;

    root.classList.add("no-transitions");

    root.setAttribute("data-theme", theme);
    if (isDark) {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }

    void root.offsetHeight;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove("no-transitions");
      });
    });
  }

  updateSettings(partial: Partial<Settings>): void {
    this.settings = { ...this.settings, ...partial };
    if (partial.theme) {
      this.applyTheme(partial.theme);
    }
    this.persistSettings();
  }

  setViewMode(mode: ViewMode): void {
    this.updateSettings({ viewMode: mode });
  }

  setFontSize(size: FontSize): void {
    this.updateSettings({ fontSize: size });
  }

  toggleTheme(): ThemeMode {
    const nextMode: ThemeMode =
      this.settings.theme === "dark" ? "light" : "dark";
    this.updateSettings({ theme: nextMode });
    return nextMode;
  }

  cycleTheme(): ThemeMode {
    return this.toggleTheme();
  }

  resetSplitRatio(): void {
    this.updateSettings({ splitRatio: 50 });
  }
}

export const settingsStore = new SettingsStore();

