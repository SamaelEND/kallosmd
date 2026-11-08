/**
 * ES: Utilidades de plataforma para atajos: detección de macOS y formato visible de combinaciones.
 * EN: Platform utilities for shortcuts: macOS detection and visible key-combo formatting.
 */

/**
 * ES: Detecta si la plataforma actual del usuario es macOS.
 * EN: Detects if the current user platform is macOS.
 */
export function isMacPlatform(): boolean {
  if (typeof window === "undefined" || !window.navigator) return false;
  return /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent || "");
}

/**
 * ES: Convierte un atajo estilo CodeMirror ("Mod-Alt-1") a texto visible ("Ctrl+Alt+1" o "⌘⌥1").
 * EN: Converts a CodeMirror-style keybinding ("Mod-Alt-1") into display text ("Ctrl+Alt+1" or "⌘⌥1").
 */
export function formatKeybinding(keybinding: string): string {
  if (!keybinding) return "";
  const isMac = isMacPlatform();
  const tokens = keybinding.split("-");
  const key = tokens.pop() || "";
  const has = (name: string) => tokens.includes(name);

  const parts: string[] = [];
  if (has("Mod")) parts.push(isMac ? "⌘" : "Ctrl");
  if (has("Alt")) parts.push(isMac ? "⌥" : "Alt");
  if (has("Shift")) parts.push(isMac ? "⇧" : "Shift");
  parts.push(key.length === 1 ? key.toUpperCase() : key);

  return isMac ? parts.join("") : parts.join("+");
}

