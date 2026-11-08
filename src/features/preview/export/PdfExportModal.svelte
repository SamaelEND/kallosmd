<script lang="ts">
  /**
   * ES: Modal bilingüe (ES/EN) de configuración previa a la exportación PDF (Estándar, CV, APA 7.ª),
   *     con selectores independientes de tipografía y tamaño (8–16 pt) y validación en tiempo real.
   * EN: Bilingual (ES/EN) pre-export PDF configuration modal (Standard, CV, APA 7th),
   *     with independent typography and font size (8–16 pt) selectors and real-time validation.
   */
  import { tick } from "svelte";
  import {
    AlertTriangle,
    BookOpen,
    Briefcase,
    FileText,
    Lock,
    Printer,
    X,
  } from "lucide-svelte";
  import { documentStore } from "../../vault/vaultStore.svelte";
  import { i18n } from "../../../shared/i18n/i18n.svelte";
  import {
    getDefaultPdfFontSize,
    isApa7CompliantSelection,
    PDF_FONT_DISPLAY_NAMES,
    PDF_FONT_SIZE_PRESETS,
    resolvePresetSwitchSettings,
    validatePdfFontSize,
  } from "./pdfExportPresets";
  import type {
    PdfCvMargin,
    PdfFontFamily,
    PdfFormatPreset,
    PdfPaperSize,
  } from "../../../core/types";
  import "./pdf-export-modal.css";

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    onConfirmPrint: () => void;
  }

  let { isOpen, onClose, onConfirmPrint }: Props = $props();

  const t = $derived(i18n.current.pdfModal);
  const settings = $derived(documentStore.settings);
  const preset = $derived<PdfFormatPreset>(settings.pdfPreset || "standard");
  const paperSize = $derived<PdfPaperSize>(settings.pdfPaperSize || "letter");
  const cvMargin = $derived<PdfCvMargin>(settings.pdfCvMargin || "normal");
  const fontFamily = $derived<PdfFontFamily>(
    settings.pdfFontFamily || "system",
  );
  const savedFontSizePt = $derived<number>(
    settings.pdfFontSizePt ?? getDefaultPdfFontSize(preset),
  );

  // ES: Estado del texto libre en el campo de tamaño para permitir escribir decimales ("10.5") y validar errores.
  // EN: Raw text state for the font size input to allow typing decimals ("10.5") and validating errors.
  let rawSizeInput = $state("11");

  $effect(() => {
    if (isOpen) {
      rawSizeInput = String(savedFontSizePt);
    }
  });

  const sizeValidation = $derived(validatePdfFontSize(rawSizeInput));
  const activeFontSizePt = $derived(
    sizeValidation.valid && sizeValidation.value !== null
      ? sizeValidation.value
      : savedFontSizePt,
  );
  const showApaWarning = $derived(
    preset === "apa7" &&
      sizeValidation.valid &&
      !isApa7CompliantSelection(fontFamily, activeFontSizePt),
  );

  let confirmBtn = $state<HTMLButtonElement | null>(null);
  let previousFocus: HTMLElement | null = null;

  // ES: Gestiona el foco al abrir y lo restaura al cerrar el modal.
  // EN: Manages focus on open and restores it when closing the modal.
  $effect(() => {
    if (!isOpen) return;
    previousFocus = document.activeElement as HTMLElement | null;
    tick().then(() => confirmBtn?.focus());
    return () => {
      previousFocus?.focus?.();
      previousFocus = null;
    };
  });

  // ES: Permite cerrar con Escape sin propagar eventos al editor subyacente.
  // EN: Allows closing with Escape without propagating events to the underlying editor.
  $effect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  });

  function selectPreset(nextPreset: PdfFormatPreset): void {
    const patch = resolvePresetSwitchSettings(settings, nextPreset);
    documentStore.updateSettings(patch);
    if (!settings.pdfFontSizeCustom && patch.pdfFontSizePt !== undefined) {
      rawSizeInput = String(patch.pdfFontSizePt);
    }
  }

  function selectPaperSize(nextSize: PdfPaperSize): void {
    documentStore.updateSettings({ pdfPaperSize: nextSize });
  }

  function selectFont(nextFont: PdfFontFamily): void {
    documentStore.updateSettings({ pdfFontFamily: nextFont });
  }

  function handleSizeInputChange(raw: string): void {
    rawSizeInput = raw;
    const check = validatePdfFontSize(raw);
    if (check.valid && check.value !== null) {
      documentStore.updateSettings({
        pdfFontSizePt: check.value,
        pdfFontSizeCustom: true,
      });
    }
  }

  function selectPresetFontSize(pt: number): void {
    rawSizeInput = String(pt);
    documentStore.updateSettings({
      pdfFontSizePt: pt,
      pdfFontSizeCustom: true,
    });
  }

  function selectCvMargin(nextMargin: PdfCvMargin): void {
    documentStore.updateSettings({ pdfCvMargin: nextMargin });
  }

  function toggleIncludeUrl(): void {
    documentStore.updateSettings({
      includePdfUrl: !settings.includePdfUrl,
    });
  }

  function handleConfirm(): void {
    if (!sizeValidation.valid || sizeValidation.value === null) return;
    documentStore.updateSettings({ pdfFontSizePt: sizeValidation.value });
    onConfirmPrint();
  }
</script>

{#if isOpen}
  <div class="pdf-backdrop no-print" onclick={onClose} role="presentation">
    <div
      class="pdf-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-modal-title"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <div class="pdf-header">
        <div>
          <h2 id="pdf-modal-title" class="pdf-title">{t.title}</h2>
          <p class="pdf-subtitle">{t.subtitle}</p>
        </div>
        <button
          type="button"
          class="pdf-close-btn"
          onclick={onClose}
          aria-label={t.cancel}
        >
          <X size={18} />
        </button>
      </div>

      <!-- ES: 1. Selector de Formato del Documento / EN: 1. Document Format Selector -->
      <div class="pdf-section">
        <span class="pdf-label">{t.formatLabel}</span>
        <div class="preset-grid" role="radiogroup" aria-label={t.formatLabel}>
          <button
            type="button"
            class="preset-card"
            class:active={preset === "standard"}
            role="radio"
            aria-checked={preset === "standard"}
            onclick={() => selectPreset("standard")}
          >
            <div class="preset-card-top">
              <FileText size={16} />
              <span class="preset-name">{t.presetStandard}</span>
            </div>
            <span class="preset-desc">{t.presetStandardDesc}</span>
          </button>

          <button
            type="button"
            class="preset-card"
            class:active={preset === "cv"}
            role="radio"
            aria-checked={preset === "cv"}
            onclick={() => selectPreset("cv")}
          >
            <div class="preset-card-top">
              <Briefcase size={16} />
              <span class="preset-name">{t.presetCv}</span>
            </div>
            <span class="preset-desc">{t.presetCvDesc}</span>
          </button>

          <button
            type="button"
            class="preset-card"
            class:active={preset === "apa7"}
            role="radio"
            aria-checked={preset === "apa7"}
            onclick={() => selectPreset("apa7")}
          >
            <div class="preset-card-top">
              <BookOpen size={16} />
              <span class="preset-name">{t.presetApa7}</span>
            </div>
            <span class="preset-desc">{t.presetApa7Desc}</span>
          </button>
        </div>
      </div>

      <!-- ES: 2. Tamaño de hoja y Familia Tipográfica / EN: 2. Paper Size and Font Family -->
      <div class="pdf-row-2col">
        <div class="pdf-field">
          <label class="pdf-label" for="pdf-paper-select">{t.paperSizeLabel}</label>
          <select
            id="pdf-paper-select"
            class="pdf-select"
            value={paperSize}
            onchange={(e) =>
              selectPaperSize((e.currentTarget as HTMLSelectElement).value as PdfPaperSize)}
          >
            <option value="letter">{t.paperLetter}</option>
            <option value="a4">{t.paperA4}</option>
          </select>
        </div>

        <div class="pdf-field">
          <label class="pdf-label" for="pdf-font-select">{t.fontLabel}</label>
          <select
            id="pdf-font-select"
            class="pdf-select"
            value={fontFamily}
            onchange={(e) =>
              selectFont((e.currentTarget as HTMLSelectElement).value as PdfFontFamily)}
          >
            <option value="system">{t.fontSystem}</option>
            <option value="times">{t.fontTimes}</option>
            <option value="arial">{t.fontArial}</option>
            <option value="calibri">{t.fontCalibri}</option>
            <option value="georgia">{t.fontGeorgia}</option>
          </select>
          <span class="pdf-field-hint">
            {preset === "apa7" ? t.fontApaHint : t.fontCvHint}
          </span>
        </div>
      </div>

      <!-- ES: 3. Control Independiente Combinado de Tamaño de Texto (8–16 pt) / EN: 3. Independent Combined Font Size Control (8–16 pt) -->
      <div class="pdf-section">
        <label class="pdf-label" for="pdf-font-size-input">{t.fontSizeLabel}</label>
        <div class="pdf-size-combo">
          <div class="pdf-size-input-wrap">
            <input
              id="pdf-font-size-input"
              type="text"
              inputmode="decimal"
              list="pdf-font-size-datalist"
              class="pdf-size-input"
              class:invalid={!sizeValidation.valid}
              placeholder={t.fontSizePlaceholder}
              value={rawSizeInput}
              aria-invalid={!sizeValidation.valid}
              aria-describedby="pdf-font-size-feedback"
              oninput={(e) =>
                handleSizeInputChange((e.currentTarget as HTMLInputElement).value)}
            />
            <span class="pdf-size-unit">pt</span>
            <datalist id="pdf-font-size-datalist">
              {#each PDF_FONT_SIZE_PRESETS as pt}
                <option value={String(pt)}>{pt} pt</option>
              {/each}
            </datalist>
          </div>

          <div class="pdf-size-chips" role="group" aria-label={t.fontSizeLabel}>
            {#each PDF_FONT_SIZE_PRESETS as pt}
              <button
                type="button"
                class="size-chip"
                class:active={sizeValidation.valid && sizeValidation.value === pt}
                onclick={() => selectPresetFontSize(pt)}
              >
                {pt} pt
              </button>
            {/each}
          </div>
        </div>

        {#if !sizeValidation.valid}
          <span id="pdf-font-size-feedback" class="pdf-field-error" role="alert">
            {sizeValidation.errorCode === "empty"
              ? t.fontSizeErrorEmpty
              : sizeValidation.errorCode === "nan"
                ? t.fontSizeErrorNan
                : t.fontSizeErrorRange}
          </span>
        {:else}
          <span id="pdf-font-size-feedback" class="pdf-field-hint">
            {t.fontSizeHint}
          </span>
        {/if}

        {#if showApaWarning}
          <div class="pdf-apa-warning" role="status">
            <AlertTriangle size={15} />
            <span>{t.apaWarning}</span>
          </div>
        {/if}
      </div>

      <!-- ES: 4. Configuración de Márgenes según Formato / EN: 4. Margin Settings per Format -->
      <div class="pdf-section">
        <span class="pdf-label">{t.marginsLabel}</span>
        {#if preset === "cv"}
          <div class="margin-segmented">
            <button
              type="button"
              class="segment-btn"
              class:active={cvMargin === "normal"}
              onclick={() => selectCvMargin("normal")}
            >
              {t.marginCvNormal}
            </button>
            <button
              type="button"
              class="segment-btn"
              class:active={cvMargin === "compact"}
              onclick={() => selectCvMargin("compact")}
            >
              {t.marginCvCompact}
            </button>
          </div>
        {:else if preset === "apa7"}
          <div class="margin-locked-badge">
            <Lock size={14} />
            <span>{t.marginApaLocked}</span>
          </div>
        {:else}
          <div class="margin-locked-badge">
            <span>{t.marginStandardInfo}</span>
          </div>
        {/if}
      </div>

      <!-- ES: 5. Resumen Técnico de Reglas Aplicadas / EN: 5. Technical Summary of Applied Rules -->
      <div class="pdf-specs-box">
        <div class="specs-header">{t.specsTitle}</div>
        <div class="specs-grid">
          <div class="spec-item">
            <span class="spec-key">{t.specTypography}:</span>
            <span class="spec-val">
              {PDF_FONT_DISPLAY_NAMES[fontFamily]} · {activeFontSizePt} pt
            </span>
          </div>
          <div class="spec-item">
            <span class="spec-key">{t.specLineHeight}:</span>
            <span class="spec-val">
              {preset === "apa7"
                ? t.valApaLine
                : preset === "cv"
                  ? t.valCvLine
                  : t.valStandardLine}
            </span>
          </div>
          <div class="spec-item">
            <span class="spec-key">{t.specSpacing}:</span>
            <span class="spec-val">
              {preset === "apa7"
                ? t.valApaSpacing
                : preset === "cv"
                  ? t.valCvSpacing
                  : t.valStandardSpacing}
            </span>
          </div>
          <div class="spec-item">
            <span class="spec-key">{t.specAlignment}:</span>
            <span class="spec-val">
              {preset === "apa7"
                ? t.valApaAlign
                : preset === "cv"
                  ? t.valCvAlign
                  : t.valStandardAlign}
            </span>
          </div>
        </div>
      </div>

      <!-- ES: 6. Pie de página y Acciones / EN: 6. Footer URL and Actions -->
      <label class="pdf-checkbox-row">
        <input
          type="checkbox"
          checked={Boolean(settings.includePdfUrl)}
          onchange={toggleIncludeUrl}
        />
        <span>{t.includeUrlLabel}</span>
      </label>

      <div class="pdf-actions">
        <button type="button" class="pdf-btn" onclick={onClose}>
          {t.cancel}
        </button>
        <button
          type="button"
          class="pdf-btn pdf-btn-primary"
          bind:this={confirmBtn}
          disabled={!sizeValidation.valid}
          onclick={handleConfirm}
        >
          <Printer size={15} />
          <span>{t.exportBtn}</span>
        </button>
      </div>
    </div>
  </div>
{/if}
