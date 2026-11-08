/**
 * ES: Ejecuta las acciones globales de la aplicación asociadas a los atajos (stores directos + callbacks de UI).
 * EN: Runs the global application actions bound to shortcuts (direct stores + UI callbacks).
 */

import { downloadTextFile } from "../preview/export/htmlExport";
import { documentStore } from "../vault/vaultStore.svelte";
import { i18n } from "../../shared/i18n/i18n.svelte";
import { isValidImportFile, readTextFile } from "../../shared/utils/formatters";
import type { AppActionId } from "./appShortcuts";

/**
 * ES: Acciones que dependen del estado local de App.svelte (paneles y exportadores).
 * EN: Actions that depend on App.svelte local state (panels and exporters).
 */
export interface AppActionContext {
  toggleSidebar: () => void;
  openSidebar: () => void;
  save: () => void;
  exportPdf: () => void;
  exportHtml: () => void;
}

/**
 * ES: Abre el selector nativo de archivos e importa el documento elegido.
 * EN: Opens the native file picker and imports the chosen document.
 */
function pickAndImportFile(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".md,.markdown,.txt";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file || !isValidImportFile(file)) return;
    try {
      documentStore.importDocument(file.name, await readTextFile(file));
    } catch (error) {
      console.error("Error al importar archivo / File import failed:", error);
    }
  };
  input.click();
}

/**
 * ES: Despacha una acción global por id.
 * EN: Dispatches a global action by id.
 */
export function runAppAction(id: AppActionId, ctx: AppActionContext): void {
  const settings = documentStore.settings;
  switch (id) {
    case "toggle-sidebar":
      return ctx.toggleSidebar();
    case "save":
      return ctx.save();
    case "import":
      return pickAndImportFile();
    case "new-document": {
      const n = documentStore.documents.length + 1;
      documentStore.createDocument(`documento-${n}.md`, `# Documento ${n}\n\n`, null);
      return ctx.openSidebar();
    }
    case "new-folder": {
      const name = i18n.interpolate(i18n.current.sidebar.defaultFolderName, {
        count: documentStore.folders.length + 1,
      });
      documentStore.createFolder(name);
      return ctx.openSidebar();
    }
    case "focus-search":
      ctx.openSidebar();
      // ES: Espera al render del panel antes de enfocar el buscador.
      // EN: Waits for the panel to render before focusing the search box.
      return void setTimeout(() => document.querySelector<HTMLInputElement>(".search-input")?.focus(), 60);
    case "export-md": {
      const doc = documentStore.activeDocument;
      return doc ? downloadTextFile(doc.title, doc.content, "text/markdown") : undefined;
    }
    case "export-pdf":
      return ctx.exportPdf();
    case "export-html":
      return ctx.exportHtml();
    case "toggle-theme":
      return void documentStore.toggleTheme();
    case "toggle-language":
      return i18n.toggleLocale();
    case "view-live":
      return documentStore.setViewMode("live");
    case "view-editor":
      return documentStore.setViewMode("editor");
    case "view-split":
      return documentStore.setViewMode("split");
    case "view-preview":
      return documentStore.setViewMode("preview");
    case "toggle-minimap":
      return documentStore.updateSettings({ minimap: !settings.minimap });
    case "toggle-line-numbers":
      return documentStore.updateSettings({ lineNumbers: !settings.lineNumbers });
    case "toggle-sync-scroll":
      return documentStore.updateSettings({ syncScroll: !settings.syncScroll });
  }
}

