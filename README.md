# Markdown Studio — Markdown Editor & Live Preview

<div align="center">

[![Live Demo](https://img.shields.io/badge/Live%20Demo-markdown--studio.xyz-blue?style=for-the-badge&logo=safari)](https://markdown-studio.xyz)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg?style=for-the-badge)](./LICENSE)
[![Svelte](https://img.shields.io/badge/Svelte-5.57.2-orange?style=for-the-badge&logo=svelte)](https://svelte.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=for-the-badge&logo=vite)](https://vite.dev/)

**[English](./README.md)** | **[Español](./README.es.md)**

</div>

> **Markdown Studio** is a modern client-side Markdown workspace designed for clarity, zero distractions, complete data sovereignty, and an ergonomic "reading desk" experience.

Built with **Svelte 5** (Runes), **TypeScript**, **Vite**, and **CodeMirror 6**, it features a feature-based architecture with reusable UI components, mathematical rendering via **KaTeX**, native SVG diagrams with **Mermaid**, **GFM** extensions (callouts and footnotes), print-ready **PDF** and standalone **HTML5** export, nested folder management, and 100% offline-first storage backed by **IndexedDB**.

---

## 🚀 Key Features

### 1. Live Editor with CodeMirror 6
- **Multi-Language Syntax Highlighting**: Native syntax parsing for embedded blocks (`python`, `typescript`, `javascript`, `json`, `html`, `css`, `sql`, `bash`, `rust`, `go`, etc.) powered by `@codemirror/language-data`.
- **Runtime Code Theme Switcher**: Instant switching between balanced palettes (VS Code Dark+/Light+, One Dark, GitHub, Nord, Dracula).
- **Vector Minimap**: Smooth, high-fidelity visual overview with a toggle switch.
- **Line Numbers & Word Wrap**: Clear gutter metrics and clean line wrapping without horizontal overflow.

### 2. Reading Preview & Markdown Engine
- **Safe Pipeline**: Markdown parsing via **Marked** combined with strict XSS sanitization via **DOMPurify**.
- **GFM Callouts**: Rich visual alerts with dedicated SVG icons and themes for `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, and `[!CAUTION]`.
- **Semantic Footnotes**: Automatic parsing of `[^1]` references into superscript links with back-links (`↩`) to source paragraphs.
- **KaTeX Mathematical Typesetting**: Display equations (`$$...$$`) and inline expressions (`$...$`, with support for boundary spaces such as `$ Mach \approx 25 $`) parsed safely without template collisions.
- **Native SVG Mermaid Diagrams**: Flowcharts, sequence, state, and architecture diagrams rendered as clean vector SVGs (without foreignObjects), with individual zoom controls (`+`, `−`, `↺`) and theme-aware caching.
- **Interactive Task Lists**: Checkable task checkboxes (`- [ ]` / `- [x]`) that directly update the raw Markdown source.
- **Collapsible Content**: Full `<details>` and `<summary>` support, automatically expanded during print or export operations.

### 3. File & Folder Organization
- **Nested File Tree**: Organize files into folders, subfolders, or keep them at the root.
- **Drag & Drop**: Intuitive document movement between folders or within the file tree.
- **Inline Renaming**: Fast renaming with double-click or the <kbd>F2</kbd> shortcut, complete with context menus.
- **Instant Search**: Real-time filter across document titles and folder structures.
- **Table of Contents (TOC)**: Automatically generated document navigation outline based on Markdown headings (`# H1` through `###### H6`).

### 4. Workspace & Reading Experience
- **3 View Modes**:
  - `Editor`: Focused typing and raw syntax editing.
  - `Split`: Live side-by-side editing and preview with an adjustable divider.
  - `Preview`: Clean, distraction-free reading desk without editing chrome.
- **Proportional Scroll Sync (`SYNC`)**: Smooth bidirectional scrolling with active state feedback.
- **Balanced Typographic Scale**: Uniform visual proportion between sidebar controls, folder items, monospace editor code (`JetBrains Mono`), and reading typography (`Inter`).

### 5. Professional Export & Printing
- **Clean PDF / Print Output**:
  - `@media print` rules that hide interactive UI controls while preserving syntax backgrounds and borders (`print-color-adjust: exact`).
  - Native SVG Mermaid diagrams with clean boundaries, preventing duplicate text or clipping.
  - Automatic expansion of `<details>` accordions and page-break guards for tables, task lists, and code blocks.
- **Standalone HTML5 Export**: Exports self-contained single-file `.html` documents with KaTeX styles and fonts embedded as base64 (works completely offline).
- **Markdown Download**: One-click download of the active file as `.md`.

### 6. Zero Tracking & Local Persistence (IndexedDB)
- **Local Browser Database (`idb`)**: All documents and folders reside inside IndexedDB (`md-studio-db`), avoiding `localStorage` quota limitations.
- **Zero Remote Dependencies**: 100% client-side architecture. Your notes, equations, and private files never leave your device.
- **Debounced Auto-Save (350 ms)**: Seamless background saves without blocking typing responsiveness.

---

## 🛠️ Tech Stack

| Layer / Module | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Framework** | [Svelte 5](https://svelte.dev/) | `^5.57.2` | Reactive Runes (`$state`, `$derived`, `$effect`) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | `~6.0.3` | Strict static typing across domain and components |
| **Bundler & Server** | [Vite](https://vite.dev/) | `^8.3.5` | Fast HMR and modular production bundling |
| **Code Editor** | [CodeMirror 6](https://codemirror.net/) | `^6.0.2` | Extensible, accessible core editor |
| **Minimap** | `@replit/codemirror-minimap` | `^0.5.2` | Visual document navigation in editor |
| **Database** | [idb](https://github.com/jakearchibald/idb) | `^8.0.4` | Promise-based IndexedDB wrapper |
| **Markdown Engine** | [Marked](https://marked.js.org/) | `^18.1.2` | Standard Markdown and GFM parsing |
| **XSS Sanitization** | [DOMPurify](https://github.com/cure53/DOMPurify) | `^3.4.17` | Safe HTML sanitization against XSS |
| **Preview Syntax** | [highlight.js](https://highlightjs.org/) | `^11.12.0` | Static syntax highlighting with copy buttons |
| **Math Engine** | [KaTeX](https://katex.org/) | `^0.19.1` | Fast inline and display LaTeX rendering |
| **Diagrams** | [Mermaid](https://mermaid.js.org/) | `^12.2.0` | Vector flowcharts and sequence diagrams |
| **Icons** | [Lucide Svelte](https://lucide.dev/) | `^1.0.1` | Accessible vector icons |

---

## 📁 Project Architecture

The codebase follows a **feature-based architecture with shared UI primitives**:

```text
markdown-studio/
├── index.html                   # HTML entry point with responsive mobile metas
├── package.json                 # Project dependencies and scripts
├── tsconfig.app.json            # Application TypeScript configuration
├── vite.config.ts               # Vite configuration with Svelte plugin
└── src/
    ├── main.ts                  # Application bootstrap entry point
    ├── app.css                  # Global tokens, slate dark theme, print media rules
    ├── App.svelte               # Workspace layout, scroll sync, global hotkeys
    ├── types/                   # Data models (DocumentItem, FolderItem, Settings, etc.)
    ├── stores/                  # Reactive Svelte 5 store with persistence logic
    ├── lib/
    │   ├── db.ts                # IndexedDB CRUD operations (md-studio-db)
    │   ├── codeThemes.ts        # Code color theme definitions
    │   ├── htmlExport.ts        # Standalone HTML5 builder with embedded KaTeX
    │   ├── markdown/            # Markdown engine (KaTeX, Mermaid, GFM, sanitization)
    │   │   ├── defaultDocument.ts     # Default initial configuration
    │   │   ├── defaultGuide.md        # Benchmark and onboarding guide document
    │   │   ├── markdownRenderer.ts    # KaTeX preprocessing, GFM callouts, footnotes
    │   │   ├── markdownUtils.ts       # Heading extraction and task toggle helpers
    │   │   ├── mermaidRenderer.ts     # Native SVG Mermaid renderer with zoom
    │   │   └── previewInteractions.ts # Copy buttons, anchor navigation, tasks
    │   └── utils/
    │       └── formatters.ts    # Date, file size, and ID utilities
    └── components/
        ├── ui/                  # Reusable UI primitives (Button, DropdownMenu, etc.)
        ├── sidebar/             # Folder tree, search box, file items, TOC panel
        ├── toolbar/             # Top toolbar, mode selectors, format shortcuts
        ├── editor/              # CodeMirror 6 integration and minimap
        ├── preview/             # Reader preview pane and typographic styles
        └── workspace/           # Resizer divider, StatusBar, and DropOverlay
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>B</kbd> / <kbd>Cmd</kbd> + <kbd>B</kbd> | Toggle sidebar visibility |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> / <kbd>Cmd</kbd> + <kbd>S</kbd> | Save document with visual feedback |
| <kbd>Ctrl</kbd> + <kbd>P</kbd> / <kbd>Cmd</kbd> + <kbd>P</kbd> | Open print dialog / Export to PDF |
| <kbd>F2</kbd> | Rename selected file or folder |
| <kbd>Tab</kbd> | Insert tab indentation inside editor |
| Double Click on Divider | Reset pane split ratio to 50% / 50% |

---

## 📦 Getting Started

### Prerequisites
- **Node.js** >= 18.0.0
- **npm** >= 9.0.0

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/tu-usuario/markdown-studio.git
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

## 🧪 Quality Checks & Build

- **Type checking and Svelte validation**:
  ```bash
  npm run check
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
