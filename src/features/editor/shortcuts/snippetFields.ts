/**
 * ES: Campos de snippet con placeholders: el primero queda seleccionado, escribir lo reemplaza y Tab salta al siguiente.
 * EN: Snippet fields with placeholders: the first is selected, typing replaces it and Tab jumps to the next one.
 */

import { EditorSelection, Prec, StateEffect, StateField, type Extension } from "@codemirror/state";
import { keymap, type EditorView } from "@codemirror/view";

/**
 * ES: Fragmento de plantilla: texto literal o un placeholder editable.
 * EN: Template part: literal text or an editable placeholder.
 */
export type SnippetPart = string | { ph: string };

interface FieldRange {
  from: number;
  to: number;
}

const setFields = StateEffect.define<FieldRange[]>();

/**
 * ES: Rangos pendientes de visitar; se remapean con cada cambio y se vacían al salir de ellos.
 * EN: Ranges still to visit; remapped on every change and cleared when the selection leaves them.
 */
const fieldsState = StateField.define<FieldRange[]>({
  create: () => [],
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setFields)) return effect.value;
    if (value.length === 0) return value;

    if (tr.docChanged) {
      return value.map((f) => ({
        from: tr.changes.mapPos(f.from, -1),
        to: tr.changes.mapPos(f.to, 1),
      }));
    }
    if (tr.selection) {
      const sel = tr.newSelection.main;
      if (sel.from < value[0].from || sel.to > value[value.length - 1].to) return [];
    }
    return value;
  },
});

/**
 * ES: Aplica una plantilla en [from, to], selecciona el campo inicial y registra el resto más una salida final.
 * EN: Applies a template over [from, to], selects the start field and registers the rest plus a final exit.
 */
export function applySnippet(
  view: EditorView,
  from: number,
  to: number,
  parts: SnippetPart[],
  startIndex = 0,
): boolean {
  let text = "";
  const fields: FieldRange[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      text += part;
    } else {
      fields.push({ from: from + text.length, to: from + text.length + part.ph.length });
      text += part.ph;
    }
  }
  // ES: Posición de salida tras la plantilla (destino del último Tab).
  // EN: Exit position after the template (target of the last Tab).
  fields.push({ from: from + text.length, to: from + text.length });

  const start = fields[Math.min(startIndex, fields.length - 1)];
  view.dispatch({
    changes: { from, to, insert: text },
    selection: EditorSelection.range(start.from, start.to),
    effects: setFields.of(fields),
    scrollIntoView: true,
  });
  view.focus();
  return true;
}

/**
 * ES: Tab: salta al siguiente campo; en el último (salida) limpia el estado. Sin campos cede el Tab.
 * EN: Tab: jumps to the next field; on the last one (exit) clears state. With no fields it yields the Tab.
 */
function jumpToNextField(view: EditorView): boolean {
  const fields = view.state.field(fieldsState);
  if (fields.length === 0) return false;

  const head = view.state.selection.main.from;
  const next = fields.find((f) => f.from > head);
  if (!next) {
    view.dispatch({ effects: setFields.of([]) });
    return false;
  }

  const isLast = next === fields[fields.length - 1];
  view.dispatch({
    selection: EditorSelection.range(next.from, next.to),
    effects: isLast ? setFields.of([]) : [],
    scrollIntoView: true,
  });
  return true;
}

/**
 * ES: Escape: descarta los campos pendientes sin consumir la tecla (otros paneles también la usan).
 * EN: Escape: drops pending fields without consuming the key (other panels use it too).
 */
function clearFields(view: EditorView): boolean {
  if (view.state.field(fieldsState).length > 0) {
    view.dispatch({ effects: setFields.of([]) });
  }
  return false;
}

/**
 * ES: Extensión de CodeMirror: estado de campos + teclas Tab/Escape con prioridad máxima.
 * EN: CodeMirror extension: fields state + Tab/Escape keys at highest precedence.
 */
export function snippetFieldsExtension(): Extension {
  return [
    fieldsState,
    Prec.highest(
      keymap.of([
        { key: "Tab", run: jumpToNextField },
        { key: "Escape", run: clearFields },
      ]),
    ),
  ];
}

