# Kallos Markdown (Markdown Studio) — Editor Markdown & Previsualizador en Vivo

<div align="center">

[![Demo en Vivo](https://img.shields.io/badge/Demo%20en%20Vivo-kallosmd.xyz-blue?style=for-the-badge&logo=safari)](https://kallosmd.xyz)
[![Licencia: AGPL v3](https://img.shields.io/badge/Licencia-AGPL_v3-blue.svg?style=for-the-badge)](./LICENSE)
[![Svelte](https://img.shields.io/badge/Svelte-5.57.2-orange?style=for-the-badge&logo=svelte)](https://svelte.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=for-the-badge&logo=vite)](https://vite.dev/)

**[English](./README.md)** | **[Español](./README.es.md)**

</div>

> **Kallos Markdown** (*Kallos MD*) es un entorno moderno, de alto rendimiento y 100% en el cliente para la redacción y previsualización de Markdown, diseñado para brindar máxima claridad, cero distracciones, soberanía total de datos y una experiencia ergonómica de escritura y lectura. Anteriormente conocido como Markdown Studio.

Construido con **Svelte 5** (Runas), **TypeScript**, **Vite 8** y **CodeMirror 6**, cuenta con una arquitectura modular limpia en 3 capas (`core/`, `features/`, `shared/`), un lienzo interactivo en **Modo Híbrido Live Preview**, edición dividida con scroll sincronizado, renderizado matemático mediante **KaTeX** local, diagramas vectoriales interactivos con **Mermaid**, extensiones **GFM** (tablas, alertas y notas al pie), exportación profesional a **PDF** y **HTML5 autónomo**, gestión de carpetas anidadas y almacenamiento 100% offline respaldado en **IndexedDB**.

---

## 🚀 Características Principales

### 1. Modo Híbrido Live Preview y 4 Modos de Vista
- **Lienzo Interactivo Live Preview**: Los encabezados, tablas GFM, fórmulas matemáticas, tarjetas de código y diagramas Mermaid se renderizan directamente en el lienzo mientras escribes, revelando las marcas Markdown originales y los colores del tema de sintaxis únicamente en la línea o bloque activo bajo el cursor.
- **Marco de Hoja Ajustable**: Guías laterales visibles y arrastrables (`680px` a `1600px`, por defecto `1020px`) persistidas en `localStorage`.
- **Alternador Rápido Código/Render (`Ctrl + E` / `Alt + M`)**: Atajo y píldora flotante para alternar instantáneamente entre la vista de código crudo y la vista renderizada dentro de Live Preview.
- **4 Modos de Visualización**:
  - `Live Preview`: Lienzo híbrido WYSIWYG interactivo con renderizado en caliente.
  - `Editor`: Editor monoespaciado centrado en la sintaxis, con números de línea y minimapa vectorial.
  - `Dividido (Split)`: Edición simultánea y visor de lectura con sincronización proporcional de desplazamiento (`SYNC`) y divisor ajustable.
  - `Lectura (Preview)`: Mesa de lectura limpia y libre de controles de edición.

### 2. Motor de Redacción Técnica (KaTeX, Mermaid y GFM)
- **Tipografía Matemática con KaTeX**: Soporte completo para fórmulas en línea (`$...$`, con protección de espacios y soporte de `\$` escapado) y ecuaciones o matrices en bloque multilínea (`$$...$$`), renderizadas con fuentes locales `.woff2` sin peticiones externas a la red.
- **Diagramas Vectoriales Mermaid Interactivos**: Diagramas de flujo, secuencia, clases, arquitectura y estados generados en SVG nativo, con zoom (`+`, `−`, `↺`), vista previa en vivo mientras se edita, modal a pantalla completa y copia/exportación a SVG o PNG.
- **Extensiones GitHub Flavored Markdown (GFM)**:
  - Tablas responsivas con desplazamiento horizontal y directivas de alineación (`:---`, `:---:`).
  - Alertas visuales destacadas (`[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`).
  - Notas al pie de página semánticas (`[^1]`) con retorno interactivo (`↩`).
  - Listas de tareas clickeables (`- [ ]` / `- [x]`) que actualizan el documento Markdown original.
  - Bloques plegables nativos `<details>` y `<summary>`.

### 3. Organización de Documentos y Carpetas
- **Árbol de Archivos Anidado**: Carpetas y subcarpetas ilimitadas para organizar tus notas o mantenerlas en la raíz.
- **Arrastrar y Soltar (*Drag & Drop*)**: Movimiento intuitivo de archivos entre carpetas y reordenación en el árbol.
- **Renombrado Rápido**: Edición directa con doble clic o tecla <kbd>F2</kbd>, con menús contextuales completos.
- **Búsqueda Instantánea**: Filtrado en tiempo real sobre títulos de documentos y nombres de carpetas.
- **Tabla de Contenidos (TOC)**: Esquema interactivo generado automáticamente a partir de los encabezados del documento (`# H1` a `###### H6`).

### 4. Exportación e Impresión Profesional
- **Exportación Limpia a PDF / Impresión**:
  - Reglas optimizadas de `@media print` que ocultan controles interactivos y respetan fondos y colores de sintaxis (`print-color-adjust: exact`).
  - Diagramas Mermaid en SVG vectorial nítido sin duplicados ni cortes.
  - Despliegue automático de bloques `<details>` y reglas contra saltos de página huérfanos.
- **Exportación Autónoma a HTML5**: Genera un archivo `.html` único con estilos y fuentes KaTeX embebidas en Base64 (funciona 100% offline).
- **Descarga Directa en Markdown**: Descarga del archivo activo como `.md` en un solo clic.

### 5. Privacidad Absoluta y Persistencia Local (IndexedDB)
- **Base de Datos Local en el Navegador (`IndexedDB`)**: Todos los documentos y carpetas residen en `md-studio-db`, superando las limitaciones de tamaño de `localStorage`.
- **Cero Dependencias Remotas / Cero Internet**: Todo el procesamiento ocurre en tu navegador. Tus notas y datos jamás salen de tu dispositivo. Cero telemetría, analíticas ni rastreadores.
- **Guardado Automático Suave (350 ms)**: Guardado en segundo plano sin bloquear la fluidez del teclado.

### 6. Internacionalización Nativa (i18n) y Landings SEO
- **Interfaz Bilingüe (Español / Inglés)**: Cambio instantáneo de idioma sin recargar la página ni realizar peticiones de red.
- **Landings Estáticas Bilingües**: Portadas ultrarrápidas para inglés (`/`) y español (`/es/`) con datos estructurados completos (JSON-LD `WebApplication`), etiquetas `hreflang` recíprocas y tarjetas sociales (1200×630 `og:image`).

---

## 🛠️ Stack Tecnológico

| Capa / Módulo | Tecnología | Versión | Propósito |
| :--- | :--- | :--- | :--- |
| **Framework** | [Svelte 5](https://svelte.dev/) | `^5.57.2` | Runas reactivas (`$state`, `$derived`, `$effect`) |
| **Lenguaje** | [TypeScript](https://www.typescriptlang.org/) | `~6.0.3` | Tipado estático estricto en dominio y componentes |
| **Bundler & Server** | [Vite](https://vite.dev/) | `^8.3.5` | HMR veloz, compilación multi-página y empaquetado modular |
| **Editor de Código** | [CodeMirror 6](https://codemirror.net/) | `^6.0.2` | Núcleo de edición y ViewPlugins para Live Preview |
| **Minimapa** | `@replit/codemirror-minimap` | `^0.5.2` | Navegación visual del documento en el editor |
| **Base de Datos Local** | [idb](https://github.com/jakearchibald/idb) | `^8.0.4` | Wrapper con promesas sobre IndexedDB |
| **Motor Markdown** | [Marked](https://marked.js.org/) | `^18.1.2` | Parseo léxico de Markdown estándar y extensiones GFM |
| **Sanitización XSS** | [DOMPurify](https://github.com/cure53/DOMPurify) | `^3.4.17` | Prevención de ataques de inyección HTML |
| **Sintaxis en Visor** | [highlight.js](https://highlightjs.org/) | `^11.12.0` | Resaltado de código estático con botones de copia |
| **Matemáticas** | [KaTeX](https://katex.org/) | `^0.19.1` | Renderizado rápido de LaTeX con fuentes locales |
| **Diagramas** | [Mermaid](https://mermaid.js.org/) | `^12.2.0` | Diagramas vectoriales SVG interactivos |
| **Iconografía** | [Lucide Svelte](https://lucide.dev/) | `^1.0.1` | Iconos vectoriales accesibles |
| **Internacionalización** | [Runas de Svelte 5](https://svelte.dev/) | `—` | Localización bilingüe (ES/EN) offline y type-safe |

---

## 📁 Arquitectura Modular (< 500 Líneas por Archivo)

El proyecto sigue una estricta **arquitectura en 3 capas (`core/`, `features/`, `shared/`)** donde ningún archivo supera las 450–500 líneas:

```text
kallosmd/
├── index.html                   # Landing estática en inglés (SEO, Open Graph, JSON-LD)
├── es/index.html                # Landing estática en español (SEO, Open Graph, JSON-LD)
├── app/index.html               # Punto de entrada SPA del editor (noindex, follow)
├── package.json                 # Dependencias, scripts y metadatos del paquete
├── vite.config.ts               # Configuración multi-página Vite (main, es, app)
├── scripts/
│   └── seo-check.mjs            # Script nativo de validación de SEO bilingüe
└── src/
    ├── main.ts                  # Montaje inicial de la aplicación
    ├── app.css                  # Variables globales, reset e imports de impresión
    ├── App.svelte               # Orquestador del espacio de trabajo (< 300 líneas)
    │
    ├── core/                    # Contratos de TypeScript puros y lógica de dominio
    │   ├── types/               # DocumentItem, FolderItem, Settings, TocHeading
    │   ├── storage/             # Almacenamiento hexagonal (indexedDbAdapter, localCache, db)
    │   └── markdown/            # Pipeline modular (markdownPipeline, mathScanner, gfmAlerts, footnotes)
    │
    ├── features/                # Módulos verticales de interfaz y negocio
    │   ├── settings/            # settingsStore.svelte.ts (preferencias visuales y temas)
    │   ├── vault/               # vaultStore.svelte.ts y componentes de Sidebar (FileTree, SearchBox, TocPanel)
    │   ├── editor/              # Editor.svelte y live-preview/ (liveWidgets, liveTheme, livePlugin)
    │   ├── preview/             # Preview.svelte, scrollSync, mermaidRenderer y exportación a PDF/HTML
    │   ├── toolbar/             # Toolbar.svelte, ActionGroup y selectores de modo
    │   └── workspace/           # Resizer, StatusBar y DropOverlay
    │
    └── shared/                  # Recursos transversales reutilizables
        ├── ui/                  # Button, DropdownMenu, InlineRenameInput, ToggleSwitchItem
        ├── i18n/                # i18n.svelte.ts, en.ts, es.ts
        ├── styles/              # variables.css, base.css, print-document.css, print-diagrams.css
        └── utils/               # formatters.ts, codeThemes.ts
```

---

## 🗺️ Estado del Proyecto y Roadmap

### ✅ Completado
- [x] **Fase 0 · Modularización y Refactorización Arquitectónica**: División en 3 capas (`core/`, `features/`, `shared/`), desacoplamiento del storage y cumplimiento estricto del límite `< 450-500` líneas por archivo.
- [x] **Fase 1 · Modo Híbrido Live Preview (WYSIWYG)**: Renderizado en el propio lienzo de encabezados, bloques de código con barra y botón de copia, tablas GFM, matrices KaTeX y diagramas Mermaid con revelado contextual bajo el cursor.
- [x] **Fase 1 · Estabilidad y Ergonomía de Live Preview**: Congelación en selección con arrastre, debounce en teclas de flecha, eliminación de saltos de layout, confinamiento de selección en bloques, marco de hoja ajustable (`Ctrl + E`), resaltado con colores de tema en líneas activas y placeholder en líneas vacías.
- [x] **Fase 5 · SEO Bilingüe y Posicionamiento**: Landings estáticas dedicadas en inglés (`/`) y español (`/es/`), ruta de la aplicación en `/app/`, `og-image.png` (1200×630), JSON-LD `WebApplication`, `hreflang` recíproco, sitemap actualizado y validador automático `seo:check`.

### ⏳ Próximas Fases y Pendientes
- [ ] **Fase 2 · Ecosistema PKM y Enlaces Bidireccionales**:
  - Paleta de comandos y buscador rápido unificado (`Ctrl + K` / `Ctrl + Shift + P`) con búsqueda difusa local.
  - Enlaces bidireccionales tipo Wikilinks (`[[Nota]]` y `[[Nota|Alias]]`) con autocompletado flotante y panel lateral de *Backlinks*.
  - Visualización de metadatos Frontmatter YAML y alertas GFM plegables (`[!NOTE]-` / `[!NOTE]+`).
- [ ] **Fase 3 · Multimedia Offline, Tablas Asistidas y Precisión de Scroll**:
  - Pegado de imágenes del portapapeles (`Ctrl + V`) y arrastre guardado como `Blob` en IndexedDB (`local-media://`).
  - Navegación asistida en celdas de tablas GFM (`Tab` / `Shift + Tab`) y selector visual de cuadrícula.
  - Sincronización milimétrica de scroll tras bloques KaTeX multilínea.
- [ ] **Fase 4 · Local-First Nativo (File System Access API) y PWA**:
  - Sincronización directa con carpetas reales del disco duro mediante `window.showDirectoryPicker()`.
  - Búsqueda global de texto completo con fragmentos contextuales resaltados y salto de línea.
  - PWA 100% instalable con Service Worker (`sw.js`) y estrategia Cache-First.
- [ ] **Fase 5.3 · Páginas por Intención de Búsqueda**:
  - Páginas dedicadas para `markdown-to-pdf`, `markdown-katex-latex`, `mermaid-diagrams` y guía de sintaxis Markdown en EN y ES.

---

## ⌨️ Atajos de Teclado

| Atajo | Acción |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>E</kbd> / <kbd>Alt</kbd> + <kbd>M</kbd> | Alternar entre Código Markdown Crudo y Vista Renderizada en Live Preview |
| <kbd>Ctrl</kbd> + <kbd>B</kbd> / <kbd>Cmd</kbd> + <kbd>B</kbd> | Alternar visibilidad del panel lateral (*Sidebar*) |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> / <kbd>Cmd</kbd> + <kbd>S</kbd> | Forzar guardado inmediato con confirmación visual |
| <kbd>Ctrl</kbd> + <kbd>P</kbd> / <kbd>Cmd</kbd> + <kbd>P</kbd> | Exportar a PDF / Imprimir documento |
| <kbd>F2</kbd> | Renombrar carpeta o documento seleccionado |
| <kbd>Tab</kbd> | Indentación con tabulación dentro del editor |
| Doble Clic en el divisor | Restablecer división de paneles al 50% / 50% |
| Doble Clic en guía lateral | Restablecer ancho de hoja en Live Preview a 1020px |

---

## 📦 Puesta en Marcha

### Prerrequisitos
- **Node.js** >= 18.0.0
- **npm** >= 9.0.0

### Instalación
1. Clona el repositorio:
   ```bash
   git clone https://github.com/SamaelEND/kallosmd.git
   cd kallosmd
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```
   Abre `http://localhost:5173/` en tu navegador.

---

## 🧪 Comprobación de Calidad, SEO y Build

- **Comprobación estricta de tipos y componentes Svelte**:
  ```bash
  npm run check
  ```
- **Auditoría automática de SEO (Metadatos, JSON-LD, hreflang, noindex)**:
  ```bash
  npm run seo:check
  ```
- **Compilación de producción**:
  ```bash
  npm run build
  ```
- **Previsualización local del bundle generado**:
  ```bash
  npm run preview
  ```

---

## 🤝 Desarrollo y Créditos

Markdown Studio fue diseñado, refactored y optimizado mediante programación en pareja (*pair programming*) continua entre **Manuel Alvarez** y un agente avanzado de codificación impulsado por Inteligencia Artificial.

---

## 📄 Licencia

Este proyecto está licenciado bajo los términos de la **GNU Affero General Public License v3.0 (AGPL-3.0)**. Consulta el archivo [LICENSE](./LICENSE) para más detalles.

Copyright (C) 2026 Manuel Alvarez.
