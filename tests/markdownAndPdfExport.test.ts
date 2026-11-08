/**
 * ES: Suite de pruebas unitarias para el renderizado de código/formato inline en encabezados Markdown
 *     y la validación/cálculo de estilos de exportación a PDF.
 * EN: Unit test suite for inline code/formatting rendering inside Markdown headings
 *     and PDF export font size validation/style calculation.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { processMathAndMarkdownRaw } from "../src/core/markdown/markdownPipeline.ts";
import {
  extractHeadings,
  generateHeadingSlug,
} from "../src/core/markdown/markdownUtils.ts";
import {
  buildPdfPrintPageCss,
  getDefaultPdfFontSize,
  isApa7CompliantSelection,
  PDF_FONT_SIZE_PRESETS,
  resolvePresetSwitchSettings,
  validatePdfFontSize,
} from "../src/features/preview/export/pdfExportPresets.ts";
import type { Settings } from "../src/core/types/index.ts";

test("1.1. Inline code inside #, ##, and ### headings renders as <code> without backticks", () => {
  const md = [
    "# Título Principal con `npm run build`",
    "## Subtítulo con `const x = 42`",
    "### KallosMD | `Svelte 5, TypeScript, Vite`",
  ].join("\n\n");

  const html = processMathAndMarkdownRaw(md);

  assert.match(
    html,
    /<h1 id="título-principal-con-npm-run-build"[^>]*>Título Principal con <code>npm run build<\/code><\/h1>/,
  );
  assert.match(
    html,
    /<h2 id="subtítulo-con-const-x-42"[^>]*>Subtítulo con <code>const x = 42<\/code><\/h2>/,
  );
  assert.match(
    html,
    /<h3 id="kallosmd-svelte-5-typescript-vite"[^>]*>KallosMD \| <code>Svelte 5, TypeScript, Vite<\/code><\/h3>/,
  );
  assert.equal(html.includes("`Svelte 5, TypeScript, Vite`"), false);
});

test("1.2. Bold, italic, and links render properly inside headings", () => {
  const md =
    "## Guía **importante** con *énfasis* y [sitio oficial](https://kallosmd.xyz)";
  const html = processMathAndMarkdownRaw(md);

  assert.match(html, /<strong>importante<\/strong>/);
  assert.match(html, /<em>énfasis<\/em>/);
  assert.match(html, /<a href="https:\/\/kallosmd\.xyz">sitio oficial<\/a>/);
});

test("1.3. Escaped backticks (\\`) render as literal backtick characters", () => {
  const md = [
    "### Encabezado con \\`acento grave literal\\` y `código real`",
    "",
    "Párrafo con \\`literal\\` en línea.",
  ].join("\n");

  const html = processMathAndMarkdownRaw(md);

  assert.match(
    html,
    /<h3[^>]*>Encabezado con `acento grave literal` y <code>código real<\/code><\/h3>/,
  );
  assert.match(html, /<p[^>]*>Párrafo con `literal` en línea\.<\/p>/);
});

test("1.4. Fenced code blocks with triple backticks keep their behavior unchanged", () => {
  const md = [
    "### Ejemplo de bloque",
    "",
    "```ts",
    "const greeting: string = `hola`;",
    "```",
  ].join("\n");

  const html = processMathAndMarkdownRaw(md);

  assert.match(html, /<div class="code-block-wrapper"/);
  assert.match(html, /<code class="hljs language-ts">/);
  assert.match(html, /greeting/);
});

test("1.5. Heading id/slug generation strips inline formatting marks and link URLs", () => {
  const slug1 = generateHeadingSlug(
    "KallosMD | `Svelte 5, TypeScript, Vite`",
  );
  assert.equal(slug1, "kallosmd-svelte-5-typescript-vite");

  const slug2 = generateHeadingSlug(
    "Sección **Negrita** *Cursiva* [Documentación](https://kallosmd.xyz/docs)",
  );
  assert.equal(slug2, "sección-negrita-cursiva-documentación");

  const toc = extractHeadings(
    "### KallosMD | `Svelte 5, TypeScript, Vite`\n## Enlace [Web](https://kallosmd.xyz)",
  );
  assert.deepEqual(toc, [
    {
      id: "kallosmd-svelte-5-typescript-vite",
      text: "KallosMD | Svelte 5, TypeScript, Vite",
      level: 3,
    },
    {
      id: "enlace-web",
      text: "Enlace Web",
      level: 2,
    },
  ]);
});

test("2.1. Font size validation accepts presets (9, 10, 10.5, 11, 12, 14) and decimals in range 8..16 pt", () => {
  assert.deepEqual(PDF_FONT_SIZE_PRESETS, [9, 10, 10.5, 11, 12, 14]);

  for (const pt of PDF_FONT_SIZE_PRESETS) {
    const res = validatePdfFontSize(pt);
    assert.equal(res.valid, true);
    assert.equal(res.value, pt);
    assert.equal(res.errorCode, null);
  }

  assert.deepEqual(validatePdfFontSize("8"), {
    valid: true,
    value: 8,
    errorCode: null,
  });
  assert.deepEqual(validatePdfFontSize("16"), {
    valid: true,
    value: 16,
    errorCode: null,
  });
  assert.deepEqual(validatePdfFontSize("10.5"), {
    valid: true,
    value: 10.5,
    errorCode: null,
  });
  assert.deepEqual(validatePdfFontSize("11,25"), {
    valid: true,
    value: 11.25,
    errorCode: null,
  });
});

test("2.2. Font size validation rejects empty, non-numeric, and out-of-range (< 8 or > 16) values", () => {
  assert.deepEqual(validatePdfFontSize(""), {
    valid: false,
    value: null,
    errorCode: "empty",
  });
  assert.deepEqual(validatePdfFontSize("   "), {
    valid: false,
    value: null,
    errorCode: "empty",
  });
  assert.deepEqual(validatePdfFontSize("abc"), {
    valid: false,
    value: null,
    errorCode: "nan",
  });
  assert.deepEqual(validatePdfFontSize("11pt"), {
    valid: false,
    value: null,
    errorCode: "nan",
  });
  assert.deepEqual(validatePdfFontSize("7.9"), {
    valid: false,
    value: null,
    errorCode: "range",
  });
  assert.deepEqual(validatePdfFontSize("16.1"), {
    valid: false,
    value: null,
    errorCode: "range",
  });
});

test("2.3. Switching format uses preset defaults (CV: 11, APA 7: 12) unless user manually customized size", () => {
  assert.equal(getDefaultPdfFontSize("standard"), 11);
  assert.equal(getDefaultPdfFontSize("cv"), 11);
  assert.equal(getDefaultPdfFontSize("apa7"), 12);

  // When pdfFontSizeCustom is false, switching preset updates to the preset default
  const autoToApa = resolvePresetSwitchSettings(
    {
      pdfPreset: "standard",
      pdfFontFamily: "calibri",
      pdfFontSizePt: 11,
      pdfFontSizeCustom: false,
    },
    "apa7",
  );
  assert.deepEqual(autoToApa, { pdfPreset: "apa7", pdfFontSizePt: 12 });

  const autoToCv = resolvePresetSwitchSettings(
    {
      pdfPreset: "apa7",
      pdfFontFamily: "times",
      pdfFontSizePt: 12,
      pdfFontSizeCustom: false,
    },
    "cv",
  );
  assert.deepEqual(autoToCv, { pdfPreset: "cv", pdfFontSizePt: 11 });

  // When pdfFontSizeCustom is true, switching preset preserves the user's manual font size
  const manualPreserved = resolvePresetSwitchSettings(
    {
      pdfPreset: "cv",
      pdfFontFamily: "calibri",
      pdfFontSizePt: 10.5,
      pdfFontSizeCustom: true,
    },
    "apa7",
  );
  assert.deepEqual(manualPreserved, {
    pdfPreset: "apa7",
    pdfFontSizePt: 10.5,
  });
});

test("2.4. APA 7th compliance check identifies normative and non-normative font/size combinations", () => {
  assert.equal(isApa7CompliantSelection("times", 12), true);
  assert.equal(isApa7CompliantSelection("arial", 11), true);
  assert.equal(isApa7CompliantSelection("calibri", 11), true);
  assert.equal(isApa7CompliantSelection("georgia", 11), true);

  assert.equal(isApa7CompliantSelection("times", 10.5), false);
  assert.equal(isApa7CompliantSelection("calibri", 14), false);
  assert.equal(isApa7CompliantSelection("system", 11), false);
});

test("2.5. Print CSS calculation applies independent typography, custom font size in pt, and format margins", () => {
  const baseSettings: Settings = {
    theme: "dark",
    viewMode: "live",
    fontSize: "medium",
    codeTheme: "vscode",
    syncScroll: true,
    minimap: true,
    lineNumbers: true,
    splitRatio: 50,
    wordWrap: true,
    includePdfUrl: false,
    pdfPreset: "cv",
    pdfPaperSize: "a4",
    pdfFontFamily: "calibri",
    pdfFontSizePt: 10.5,
    pdfFontSizeCustom: true,
    pdfCvMargin: "compact",
  };

  const cvCss = buildPdfPrintPageCss(baseSettings, "es");
  assert.match(cvCss, /size:\s*A4;/);
  assert.match(cvCss, /margin-top:\s*1\.9cm;/);
  assert.match(cvCss, /--pdf-base-font-size:\s*10\.5pt;/);
  assert.match(cvCss, /font-size:\s*10\.5pt\s*!important;/);
  assert.match(cvCss, /font-family:\s*Calibri/);

  const apaCss = buildPdfPrintPageCss(
    {
      ...baseSettings,
      pdfPreset: "apa7",
      pdfPaperSize: "letter",
      pdfFontFamily: "georgia",
      pdfFontSizePt: 13.5,
    },
    "en",
  );
  assert.match(apaCss, /size:\s*letter;/);
  assert.match(apaCss, /margin-top:\s*2\.54cm;/);
  assert.match(apaCss, /--pdf-base-font-size:\s*13\.5pt;/);
  assert.match(apaCss, /font-size:\s*13\.5pt\s*!important;/);
  assert.match(apaCss, /font-family:\s*Georgia/);
});

