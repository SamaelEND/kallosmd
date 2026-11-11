/**
 * ES: Store reactivo dedicado exclusivamente a las preferencias de interfaz, vista y tema visual.
 * EN: Reactive store dedicated exclusively to UI preferences, view mode, and visual theme.
 */

import { DEFAULT_CODE_THEME, isCodeThemeId } from "../../shared/utils/codeThemes";
import {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
} from "../../core/markdown/defaultDocument";
import type {
  FontSize,
  PdfCvMargin,
  PdfFontFamily,
  PdfFormatPreset,
  PdfPaperSize,
  Settings,
  ThemeMode,
  ViewMode,
} from "../../core/types";

/**
 * ES: Breakpoint en píxeles para alternancia automática entre vista Split y Live.
 * EN: Breakpoint in pixels for automatic switching between Split and Live view.
 */
export const VIEW_MODE_BREAKPOINT = 640;

export class SettingsStore {
  settings = $state<Settings>(DEFAULT_SETTINGS);
  hasExplicitViewMode = $state<boolean>(false);
  private cleanupViewportListener?: () => void;

  constructor() {
    this.initViewMode();
    this.loadSettings();
    this.setupViewportListener();
  }

  /**
   * ES: Determina la vista automática según el breakpoint de pantalla (split en amplia, live en pequeña).
   * EN: Determines automatic view mode based on screen breakpoint (split on wide, live on small).
   */
  public computeAutomaticViewMode(): ViewMode {
    if (typeof window !== "undefined") {
      if (typeof window.matchMedia === "function") {
        return window.matchMedia(`(max-width: ${VIEW_MODE_BREAKPOINT}px)`).matches
          ? "live"
          : "split";
      }
      if (typeof window.innerWidth === "number") {
        return window.innerWidth <= VIEW_MODE_BREAKPOINT ? "live" : "split";
      }
    }
    return "split";
  }

  /**
   * ES: Inicializa la vista por defecto basada en el breakpoint antes de cargar persistencia.
   * EN: Initializes default view based on breakpoint before loading persistence.
   */
  private initViewMode(): void {
    const initialViewMode = this.computeAutomaticViewMode();
    this.settings = {
      ...this.settings,
      viewMode: initialViewMode,
    };
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

      let rawViewMode: string | null = null;
      try {
        rawViewMode = localStorage.getItem(STORAGE_KEYS.VIEW_MODE);
      } catch {
        rawViewMode = null;
      }

      const isExplicit =
        rawViewMode === "live" ||
        rawViewMode === "editor" ||
        rawViewMode === "split" ||
        rawViewMode === "preview";

      this.hasExplicitViewMode = isExplicit;
      const savedViewMode: ViewMode = isExplicit
        ? (rawViewMode as ViewMode)
        : this.computeAutomaticViewMode();

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
      const rawPdfPreset = localStorage.getItem(STORAGE_KEYS.PDF_PRESET);
      const savedPdfPreset: PdfFormatPreset =
        rawPdfPreset === "cv" || rawPdfPreset === "apa7"
          ? rawPdfPreset
          : "standard";
      const rawPaperSize = localStorage.getItem(STORAGE_KEYS.PDF_PAPER_SIZE);
      const savedPdfPaperSize: PdfPaperSize =
        rawPaperSize === "a4" ? "a4" : "letter";
      const rawPdfFont = localStorage.getItem(STORAGE_KEYS.PDF_FONT_FAMILY);
      const savedPdfFontFamily: PdfFontFamily =
        rawPdfFont === "arial" ||
        rawPdfFont === "calibri" ||
        rawPdfFont === "times" ||
        rawPdfFont === "georgia"
          ? rawPdfFont
          : "system";
      const rawCvMargin = localStorage.getItem(STORAGE_KEYS.PDF_CV_MARGIN);
      const savedPdfCvMargin: PdfCvMargin =
        rawCvMargin === "compact" ? "compact" : "normal";
      const rawFontSizePt = parseFloat(
        localStorage.getItem(STORAGE_KEYS.PDF_FONT_SIZE_PT) || "",
      );
      const defaultPresetPt = savedPdfPreset === "apa7" ? 12 : 11;
      const savedPdfFontSizePt =
        Number.isFinite(rawFontSizePt) &&
        rawFontSizePt >= 8 &&
        rawFontSizePt <= 16
          ? rawFontSizePt
          : defaultPresetPt;
      const savedPdfFontSizeCustom =
        localStorage.getItem(STORAGE_KEYS.PDF_FONT_SIZE_CUSTOM) === "true";

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
        pdfPreset: savedPdfPreset,
        pdfPaperSize: savedPdfPaperSize,
        pdfFontFamily: savedPdfFontFamily,
        pdfFontSizePt: savedPdfFontSizePt,
        pdfFontSizeCustom: savedPdfFontSizeCustom,
        pdfCvMargin: savedPdfCvMargin,
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
      if (this.hasExplicitViewMode) {
        localStorage.setItem(STORAGE_KEYS.VIEW_MODE, this.settings.viewMode);
      }
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
      localStorage.setItem(
        STORAGE_KEYS.PDF_PRESET,
        this.settings.pdfPreset || "standard",
      );
      localStorage.setItem(
        STORAGE_KEYS.PDF_PAPER_SIZE,
        this.settings.pdfPaperSize || "letter",
      );
      localStorage.setItem(
        STORAGE_KEYS.PDF_FONT_FAMILY,
        this.settings.pdfFontFamily || "system",
      );
      localStorage.setItem(
        STORAGE_KEYS.PDF_FONT_SIZE_PT,
        String(this.settings.pdfFontSizePt ?? 11),
      );
      localStorage.setItem(
        STORAGE_KEYS.PDF_FONT_SIZE_CUSTOM,
        String(Boolean(this.settings.pdfFontSizeCustom)),
      );
      localStorage.setItem(
        STORAGE_KEYS.PDF_CV_MARGIN,
        this.settings.pdfCvMargin || "normal",
      );
    } catch (error) {
      console.error("Error al guardar configuración en localStorage:", error);
    }
  }

  /**
   * ES: Registra el listener para actualizar la vista automática al cruzar el breakpoint cuando no hay preferencia explícita.
   * EN: Registers the listener to update the automatic view mode when crossing the breakpoint if no explicit preference is set.
   */
  public setupViewportListener(): void {
    if (typeof window === "undefined") return;

    if (this.cleanupViewportListener) {
      this.cleanupViewportListener();
      this.cleanupViewportListener = undefined;
    }

    const handleViewportChange = () => {
      if (this.hasExplicitViewMode) return;
      const nextMode = this.computeAutomaticViewMode();
      if (this.settings.viewMode !== nextMode) {
        this.settings = { ...this.settings, viewMode: nextMode };
      }
    };

    if (typeof window.matchMedia === "function") {
      const mediaQuery = window.matchMedia(
        `(max-width: ${VIEW_MODE_BREAKPOINT}px)`,
      );
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", handleViewportChange);
        this.cleanupViewportListener = () => {
          mediaQuery.removeEventListener("change", handleViewportChange);
        };
        return;
      } else if (typeof mediaQuery.addListener === "function") {
        mediaQuery.addListener(handleViewportChange);
        this.cleanupViewportListener = () => {
          mediaQuery.removeListener(handleViewportChange);
        };
        return;
      }
    }

    window.addEventListener("resize", handleViewportChange);
    this.cleanupViewportListener = () => {
      window.removeEventListener("resize", handleViewportChange);
    };
  }

  /**
   * ES: Elimina los listeners activos del viewport.
   * EN: Cleans up active viewport listeners.
   */
  public destroy(): void {
    if (this.cleanupViewportListener) {
      this.cleanupViewportListener();
      this.cleanupViewportListener = undefined;
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

    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          root.classList.remove("no-transitions");
        });
      });
    } else {
      root.classList.remove("no-transitions");
    }
  }

  /**
   * ES: Actualiza configuraciones parciales y persiste los cambios.
   * EN: Updates partial settings and persists changes.
   */
  updateSettings(partial: Partial<Settings>): void {
    if (partial.viewMode !== undefined) {
      this.hasExplicitViewMode = true;
    }
    this.settings = { ...this.settings, ...partial };
    if (partial.theme) {
      this.applyTheme(partial.theme);
    }
    this.persistSettings();
  }

  /**
   * ES: Establece el modo de vista. Si isExplicit es falso (p. ej. exportación temporal a PDF o HTML),
   * no marca preferencia explícita ni persiste en localStorage.
   * EN: Sets the view mode. If isExplicit is false (e.g. temporary export to PDF or HTML),
   * it does not mark explicit preference nor persist to localStorage.
   */
  setViewMode(mode: ViewMode, isExplicit = true): void {
    if (isExplicit) {
      this.hasExplicitViewMode = true;
      this.updateSettings({ viewMode: mode });
    } else {
      this.settings = { ...this.settings, viewMode: mode };
    }
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
