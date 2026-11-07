# Markdown Studio — Markdown Editor & Live Preview

<div align="center">

[![Live Demo](https://img.shields.io/badge/Live%20Demo-markdown--studio.xyz-blue?style=for-the-badge&logo=safari)](https://markdown-studio.xyz)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg?style=for-the-badge)](./LICENSE)
[![Svelte](https://img.shields.io/badge/Svelte-5.57.2-orange?style=for-the-badge&logo=svelte)](https://svelte.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=for-the-badge&logo=vite)](https://vite.dev/)

**[English](./README.md)** | **[Español](./README.es.md)**

</div>

> **Markdown Studio** is a modern, high-performance, client-side Markdown workspace designed for clarity, zero distractions, complete data sovereignty, and an ergonomic writing experience.

Built with **Svelte 5** (Runes), **TypeScript**, **Vite 8**, and **CodeMirror 6**, it features an Obsidian-free, clean-room modular 3-layer architecture (`core/`, `features/`, `shared/`), an interactive **Hybrid Live Preview** canvas, synchronized split-view editing, mathematical typesetting via self-hosted **KaTeX**, interactive vector diagrams with **Mermaid**, **GFM** extensions (tables, callouts, and footnotes), print-ready **PDF** and standalone **HTML5** export, nested folder management, and 100% offline-first storage backed by **IndexedDB**.

---

## 🚀 Key Features

### 1. Hybrid Live Preview & 4 View Modes
- **Interactive Live Preview Canvas**: Headings, GFM tables, math blocks, code cards, and Mermaid diagrams render directly inline as you type, revealing the raw Markdown syntax and syntax theme colors only on the active line or block under your cursor.
- **Adjustable Writing Sheet**: Draggable canvas guides (`680px` to `1600px`, default `1020px`) with visible bounds, persisted in `localStorage`.
- **Raw / Rendered Toggle (`Ctrl + E` / `Alt + M`)**: Instant toggle between raw Markdown and live-rendered view directly within Live Preview.
- **4 View Modes**:
  - `Live Preview`: Distraction-free interactive canvas with in-place rendering.
  - `Editor`: Focused monospace code editor with line numbers, minimap, and active line styling.
  - `Split`: Real-time side-by-side editing and reading desk with proportional scroll synchronization (`SYNC`) and an adjustable divider.
  - `Preview`: Clean reader view without editing chrome.

### 2. Technical Writing Engine (KaTeX, Mermaid & GFM)
- **KaTeX Mathematical Typesetting**: Full support for inline expressions (`$...$`, with safe boundary spacing and escaped `\$` support) and multi-line display equations / matrices (`$$...$$`) powered by self-hosted local `.woff2` fonts.
- **Interactive Mermaid SVG Diagrams**: Flowcharts, sequence, state, class, and architecture diagrams rendered as clean vector SVGs with dedicated zoom controls (`+`, `−`, `↺`), full-screen modal, and SVG/PNG copy/export.
- **GitHub Flavored Markdown (GFM)**:
  - Responsive tables with horizontal scroll and alignment directives (`:---`, `:---:`).
  - Rich visual alerts (`[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`).
  - Semantic linked footnotes (`[^1]`) with instant back-links (`↩`).
  - Interactive task checkboxes (`- [ ]` / `- [x]`) that toggle state in the source document.
  - Collapsible content via native `<details>` and `<summary>`.

### 3. File & Vault Organization
- **Nested File Tree**: Organize documents into unlimited folders and subfolders or keep them at the vault root.
- **Drag & Drop**: Intuitive document movement between folders or within the file tree.
- **Inline Renaming**: Fast renaming with double-click or <kbd>F2</kbd>, complete with context menus.
- **Instant Search**: Real-time filtering across document titles and folder structures.
- **Table of Contents (TOC)**: Automatically generated document navigation outline based on Markdown headings (`# H1` through `###### H6`).

### 4. Professional Export & Printing
- **Clean PDF / Print Output**:
  - Dedicated `@media print` rules that hide interactive UI controls while preserving syntax colors and borders (`print-color-adjust: exact`).
  - Native SVG Mermaid diagrams with clean boundaries, preventing duplicate text or clipping.
  - Automatic expansion of `<details>` accordions and page-break guards for tables, task lists, and code blocks.
- **Standalone HTML5 Export**: Exports self-contained single-file `.html` documents with KaTeX styles and fonts embedded as Base64 (works completely offline).
- **Markdown Download**: One-click download of the active file as `.md`.

### 5. Zero Tracking & 100% Local-First Privacy
- **Local Browser Database (`IndexedDB`)**: All documents and folders reside inside IndexedDB (`md-studio-db`), avoiding `localStorage` quota limitations.
- **Zero Remote Dependencies / Cero Internet**: 100% client-side architecture. Your notes, equations, and private files never leave your device. Cero telemetry, analytics, or third-party cookies.
- **Debounced Auto-Save (350 ms)**: Seamless background saves without blocking typing responsiveness.

### 6. Native Offline Internationalization (i18n) & SEO
- **Dual-Language Interface (English / Spanish)**: Instant locale switching without reloading or external network requests.
- **Bilingual Static Landings**: Ultra-fast static landings for English (`/`) and Spanish (`/es/`) with complete structured data (JSON-LD `WebApplication`), reciprocated `hreflang` alternates, and social cards (1200×630 `og:image`).

---

## 🛠️ Tech Stack

| Layer / Module | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Framework** | [Svelte 5](https://svelte.dev/) | `^5.57.2` | Reactive Runes (`$state`, `$derived`, `$effect`) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | `~6.0.3` | Strict static typing across domain and components |
| **Bundler & Server** | [Vite](https://vite.dev/) | `^8.3.5` | Fast HMR, multi-page input, and modular production bundling |
| **Code Editor** | [CodeMirror 6](https://codemirror.net/) | `^6.0.2` | Extensible core editor & Hybrid Live Preview ViewPlugins |
| **Minimap** | `@replit/codemirror-minimap` | `^0.5.2` | Visual document navigation in editor |
| **Database** | [idb](https://github.com/jakearchibald/idb) | `^8.0.4` | Promise-based IndexedDB wrapper |
| **Markdown Engine** | [Marked](https://marked.js.org/) | `^18.1.2` | Standard Markdown and GFM parsing |
| **XSS Sanitization** | [DOMPurify](https://github.com/cure53/DOMPurify) | `^3.4.17` | Safe HTML sanitization against XSS |
| **Preview Syntax** | [highlight.js](https://highlightjs.org/) | `^11.12.0` | Static syntax highlighting with copy buttons |
| **Math Engine** | [KaTeX](https://katex.org/) | `^0.19.1` | Fast inline and display LaTeX rendering with self-hosted fonts |
| **Diagrams** | [Mermaid](https://mermaid.js.org/) | `^12.2.0` | Vector flowcharts and sequence diagrams |
| **Icons** | [Lucide Svelte](https://lucide.dev/) | `^1.0.1` | Accessible vector icons |
| **Internationalization** | [Svelte 5 Runes](https://svelte.dev/) | `—` | Native type-safe offline localization (EN/ES) |

---

## 📁 Project Architecture (< 500 Lines per File)

The codebase strictly adheres to a **modular 3-layer architecture (`core/`, `features/`, `shared/`)** where every `.ts`, `.svelte`, and `.css` file is kept under 450–500 lines for maintainability:

```text
markdown-studio/
├── index.html                   # Static English landing (SEO, Open Graph, JSON-LD)
├── es/index.html                # Static Spanish landing (SEO, Open Graph, JSON-LD)
├── app/index.html               # SPA App entry point (noindex, follow)
├── package.json                 # Project dependencies, metadata, and scripts
├── vite.config.ts               # Multi-page build configuration (main, es, app)
├── scripts/
│   └── seo-check.mjs            # Automated native Node.js SEO verification script
└── src/
    ├── main.ts                  # Application bootstrap entry point
    ├── app.css                  # Global CSS variables, reset, and print imports
    ├── App.svelte               # Root layout orchestrator (< 300 lines)
    │
    ├── core/                    # Pure TypeScript contracts and domain logic
    │   ├── types/               # DocumentItem, FolderItem, Settings, TocHeading
    │   ├── storage/             # Hexagonal StoragePort (indexedDbAdapter, localCache, db)
    │   └── markdown/            # Modular pipeline (markdownPipeline, mathScanner, gfmAlerts, footnotes)
    │
    ├── features/                # Domain vertical feature modules
    │   ├── settings/            # settingsStore.svelte.ts (UI themes, font preferences)
    │   ├── vault/               # vaultStore.svelte.ts & sidebar components (FileTree, SearchBox, TocPanel)
    │   ├── editor/              # Editor.svelte & live-preview/ (liveWidgets, liveTheme, livePlugin)
    │   ├── preview/             # Preview.svelte, scrollSync, mermaidRenderer, and print/HTML export
    │   ├── toolbar/             # Toolbar.svelte, ActionGroup, and view mode selectors
    │   └── workspace/           # Resizer, StatusBar, and DropOverlay
    │
    └── shared/                  # Reusable cross-cutting resources
        ├── ui/                  # Button, DropdownMenu, InlineRenameInput, ToggleSwitchItem
        ├── i18n/                # i18n.svelte.ts, en.ts, es.ts
        ├── styles/              # variables.css, base.css, print-document.css, print-diagrams.css
        └── utils/               # formatters.ts, codeThemes.ts
```

---

## 🗺️ Roadmap & Current Status

### ✅ Completed
- [x] **Phase 0 · Architectural Refactoring & Modularization**: 3-layer split (`core/`, `features/`, `shared/`), hexagonal storage port, and strict enforcement of `< 450-500` lines per file.
- [x] **Phase 1 · Hybrid Live Preview (WYSIWYG)**: In-place rendering of headings, code blocks with copy header bar, tables, KaTeX display math, and Mermaid diagrams with cursor-aware raw Markdown revealing.
- [x] **Phase 1 · Live Preview Stability & Ergonomics**: Selection freeze, arrow key debounce, layout jump elimination, drag selection confinement, adjustable writing canvas (`Ctrl + E`), theme color highlighting for active lines, and empty line placeholders.
- [x] **Phase 5 · Bilingual SEO & Search Discovery**: Dedicated English (`/`) and Spanish (`/es/`) static landings, app route at `/app/`, `og-image.png` (1200×630), JSON-LD `WebApplication`, reciprocal `hreflang`, updated sitemap, and automated `seo:check` testing.

### ⏳ In Progress & Upcoming
- [ ] **Phase 2 · PKM Wiki & Quick Wins**:
  - Command Palette & Quick Switcher (`Ctrl + K` / `Ctrl + Shift + P`) with local fuzzy search.
  - Bidirectional Wikilinks (`[[Note]]` & `[[Note|Alias]]`) with floating autocomplete and Backlinks sidebar panel.
  - Frontmatter YAML card view and collapsible Callouts (`[!NOTE]-` / `[!NOTE]+`).
- [ ] **Phase 3 · Offline Media, Assisted Tables & Scroll Precision**:
  - Clipboard image paste (`Ctrl + V`) and drag-and-drop stored as local `Blob` in IndexedDB (`local-media://`).
  - Assisted GFM table navigation (`Tab` / `Shift + Tab`) and visual grid picker.
  - Exact scroll synchronization across multi-line display KaTeX blocks.
- [ ] **Phase 4 · Native Local-First (File System Access API) & PWA**:
  - Direct local hard drive folder syncing via `window.showDirectoryPicker()`.
  - Full-text search with highlighted context snippets and line jumps.
  - Offline Service Worker (`sw.js`) with Cache-First strategy for 100% PWA installation.
- [ ] **Phase 5.3 · Search Intent Landing Pages**:
  - Dedicated pages for `markdown-to-pdf`, `markdown-katex-latex`, `mermaid-diagrams`, and Markdown cheat sheet in EN & ES.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>E</kbd> / <kbd>Alt</kbd> + <kbd>M</kbd> | Toggle between Raw Markdown and Rendered View in Live Preview |
| <kbd>Ctrl</kbd> + <kbd>B</kbd> / <kbd>Cmd</kbd> + <kbd>B</kbd> | Toggle sidebar visibility |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> / <kbd>Cmd</kbd> + <kbd>S</kbd> | Save document with visual feedback |
| <kbd>Ctrl</kbd> + <kbd>P</kbd> / <kbd>Cmd</kbd> + <kbd>P</kbd> | Open print dialog / Export to PDF |
| <kbd>F2</kbd> | Rename selected file or folder |
| <kbd>Tab</kbd> | Insert tab indentation inside editor |
| Double Click on Divider | Reset pane split ratio to 50% / 50% |
| Double Click on Frame Guide | Reset Live Preview writing width to default (1020px) |

---

## 📦 Getting Started

### Prerequisites
- **Node.js** >= 18.0.0
- **npm** >= 9.0.0

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/SamaelEND/markdown-studio.git
   cd markdown-studio
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173/` in your browser.

---

## 🧪 Quality Checks, SEO & Build

- **Type checking and Svelte validation**:
  ```bash
  npm run check
  ```
- **Automated SEO checks (Metadata, JSON-LD, hreflang, noindex)**:
  ```bash
  npm run seo:check
  ```
- **Production build**:
  ```bash
  npm run build
  ```
- **Preview local production build**:
  ```bash
  npm run preview
  ```

---

## 🤝 Development & Credits

Markdown Studio was designed, refactored, and optimized through continuous pair programming between **Manuel Alvarez** and an advanced Artificial Intelligence coding agent.

---

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See the [LICENSE](./LICENSE) file for details.

Copyright (C) 2026 Manuel Alvarez.
