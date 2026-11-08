# Atajos de teclado / Keyboard shortcuts

> `Mod` = **Ctrl** (Windows/Linux) · **⌘ Cmd** (macOS). Alt = ⌥, Shift = ⇧.
> Fuente única en código / Single source in code: `src/features/editor/shortcuts/editorCommands.ts` (editor) y `src/features/shortcuts/appShortcuts.ts` (app).

## Formato / Formatting

| Acción / Action | Atajo / Shortcut | Notas / Notes |
|---|---|---|
| Negrita / Bold | `Mod+B` | Alterna / toggles |
| Cursiva / Italic | `Mod+I` | Alterna / toggles |
| Tachado / Strikethrough | `Mod+Shift+X` | |
| Código en línea / Inline code | `Mod+E` | |
| Enlace / Link | `Mod+K` | Con texto seleccionado salta a la URL / with selection jumps to URL |
| Fórmula / Math block | `Mod+Shift+M` | |

## Bloques / Blocks

| Acción / Action | Atajo / Shortcut |
|---|---|
| Título 1–6 / Heading 1–6 | `Mod+Alt+1` … `Mod+Alt+6` |
| Lista numerada / Numbered list | `Mod+Shift+7` |
| Lista con viñetas / Bullet list | `Mod+Shift+8` |
| Lista de tareas / Task list | `Mod+Shift+9` |
| Cita / Quote | `Mod+Alt+Q` |
| Bloque de código / Code block (`markdown` por defecto) | `Mod+Alt+C` |
| Tabla / Table | `Mod+Alt+Shift+T` |
| Alerta GFM / Callout | `Mod+Alt+O` |
| Diagrama Mermaid, Línea divisoria / Divider | solo menú `/` · slash menu only |

## Vista / View

| Acción / Action | Atajo / Shortcut |
|---|---|
| Live / Editor / Split / Preview | `Mod+1` / `Mod+2` / `Mod+3` / `Mod+4` |
| Panel lateral / Sidebar | `Mod+\` |
| Minimapa / Minimap | `Mod+Alt+M` |
| Números de línea / Line numbers | `Mod+Alt+Shift+L` |
| Scroll sincronizado / Sync scroll | `Mod+Alt+S` |
| Tema claro/oscuro / Theme | `Mod+Shift+L` |
| Idioma ES/EN / Language | `Mod+Alt+I` |

## Archivo y exportación / File & export

| Acción / Action | Atajo / Shortcut |
|---|---|
| Guardar / Save | `Mod+S` |
| Importar / Import | `Mod+O` |
| Documento nuevo / New document | `Mod+Alt+N` |
| Carpeta nueva / New folder | `Mod+Alt+F` |
| Exportar Markdown | `Mod+Shift+E` |
| Exportar PDF (imprimir) / Export PDF | `Mod+P` |
| Exportar HTML5 | `Mod+Alt+E` |
| Eliminar archivo seleccionado en el panel / Delete selected file (con confirmación / with confirmation) | `Supr` / `Delete` |

## Búsqueda / Search

| Acción / Action | Atajo / Shortcut |
|---|---|
| Buscar en el documento / Find | `Mod+F` |
| Reemplazar / Replace | `Mod+H` |
| Siguiente / anterior coincidencia | `F3` / `Shift+F3` |
| Buscar en archivos / Search files | `Mod+Shift+F` |
| Paleta de comandos / Command palette | _pendiente — Fase 2.1 / pending — Phase 2.1_ |

## Menú `/` y placeholders / Slash menu & placeholders

- `/` al inicio de línea o tras un espacio abre el menú; `↑↓` navegan, `Enter` o `Tab` insertan, `Esc` cierra.
- Al insertar, el texto de ayuda queda **seleccionado**: escribir lo reemplaza, `Tab` salta al siguiente campo (y al final sale del bloque), `Esc` conserva el valor por defecto.
- Los textos de ayuda siguen el idioma de la interfaz; lo que escribe el usuario no se traduce.

## Eliminados / Removed

`Ctrl+Shift+T` (nueva pestaña del navegador), `Ctrl+Shift+U` (Unicode en IBus/Linux), `Ctrl+Shift+Q` (no estándar; usar `>` nativo). `Ctrl+B` ya no abre el panel lateral. En Ubuntu `Ctrl+Alt+T` (terminal), `Ctrl+Alt+D` (mostrar escritorio) y `Ctrl+Alt+L` (bloquear pantalla) los captura el sistema, por eso tabla, tema y números de línea usan otras combinaciones.

