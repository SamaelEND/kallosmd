# Markdown Studio — Editor Markdown & Previsualizador en Vivo

<div align="center">

[![Demo en Vivo](https://img.shields.io/badge/Demo%20en%20Vivo-markdown--studio.xyz-blue?style=for-the-badge&logo=safari)](https://markdown-studio.xyz)
[![Licencia: AGPL v3](https://img.shields.io/badge/Licencia-AGPL_v3-blue.svg?style=for-the-badge)](./LICENSE)
[![Svelte](https://img.shields.io/badge/Svelte-5.57.2-orange?style=for-the-badge&logo=svelte)](https://svelte.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=for-the-badge&logo=vite)](https://vite.dev/)

**[English](./README.md)** | **[Español](./README.es.md)**

</div>

> **Markdown Studio** es un entorno moderno de escritorio y web para la escritura y previsualización en vivo de **Markdown** (*live preview / viewer*), enfocado en la claridad tipográfica, la ausencia de distracciones, la soberanía total de datos y una experiencia ergonómica tipo "Mesa de Lectura".

Construido con **Svelte 5** (Runas), **TypeScript**, **Vite** y **CodeMirror 6**, ofrece una arquitectura modular por características (`features`) y componentes UI compartidos, renderizado matemático con **KaTeX**, diagramas vectoriales dinámicos con **Mermaid**, extensiones **GFM** (callouts y notas al pie), exportación autónoma a **PDF** y **HTML5**, organización de archivos por carpetas y persistencia 100% local en el cliente con **IndexedDB**.

---

## 🚀 Características Principales

### 1. Editor en Vivo con CodeMirror 6
- **Resaltado de sintaxis multi-lenguaje**: Soporte completo para bloques de código embebidos (`python`, `typescript`, `javascript`, `json`, `html`, `css`, `sql`, `bash`, `rust`, `go`, etc.) mediante `@codemirror/language-data`.
- **Selector de temas de código**: Selección dinámica de paletas ergonómicas en vivo (VS Code Dark+/Light+, One Dark, GitHub, Nord, Dracula).
- **Minimapa vectorial**: Navegación visual y fluida por todo el documento con conmutador para activarlo u ocultarlo.
- **Números de línea y ajuste (*Word Wrap*)**: Lectura continua sin cortes bruscos ni desbordamiento horizontal.

### 2. Visor de Lectura (*Preview*) y Motor Markdown
- **Pipeline de renderizado seguro**: Conversión Markdown con **Marked** y sanitización estricta contra vulnerabilidades XSS mediante **DOMPurify**.
- **Alertas GFM completas (*Callouts*)**: Renderizado con iconos SVG y cajas de énfasis para `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` y `[!CAUTION]`.
- **Notas al pie de página semánticas**: Procesamiento automático de referencias `[^1]` como superíndices enlazados con retorno directo `↩` desde el pie del documento.
- **Fórmulas matemáticas KaTeX**: Ecuaciones en bloque (`$$...$$`) y en línea (`$...$`, con soporte para espacios como `$ Mach \approx 25 $`) protegidas para evitar conflictos de parseo.
- **Diagramas Mermaid con zoom interactivo**: Diagramas de flujo, secuencia, estados y arquitectura vectoriales en SVG nativo, con zoom individual (`+`, `−`, `↺`) y memoria caché por tema anti-parpadeo.
- **Tareas interactivas**: Listas de verificación (`- [ ]` / `- [x]`) clickeables en el visor que actualizan en caliente el archivo Markdown.
- **Contenido desplegable**: Soporte nativo para `<details>` y `<summary>`, con despliegue automático al imprimir o exportar.

### 3. Organización de Documentos y Carpetas
- **Árbol de archivos anidado**: Creación de carpetas, subcarpetas y documentos Markdown en la raíz o agrupados.
- **Arrastrar y soltar (*Drag & Drop*)**: Movimiento intuitivo de documentos entre carpetas o reordenación en el árbol.
- **Edición en línea y atajos**: Renombrado rápido con doble clic o tecla <kbd>F2</kbd>, menús contextuales y acciones directas.
- **Búsqueda instantánea**: Filtro dinámico en tiempo real sobre títulos de documentos y carpetas.
- **Tabla de Contenidos (TOC)**: Generación automática de índice interactivo a partir de los encabezados (`# H1` a `###### H6`).

### 4. Mesa de Lectura y Espacio de Trabajo
- **3 Modos de visualización**:
  - `Editor`: Máxima concentración en la escritura y código fuente.
  - `Dividido (Split)`: Edición y lectura simultánea con divisor interactivo ajustable.
  - `Lectura (Preview)`: Mesa de lectura limpia y libre de distracciones.
- **Sincronización de scroll proporcional (`SYNC`)**: Desplazamiento bidireccional suave con indicador de estado activo.
- **Escala tipográfica armónica**: Proporción visual equilibrada entre controles, carpetas, editor monoespaciado (`JetBrains Mono`) y vista de lectura (`Inter`).

### 5. Exportación e Impresión Profesional
- **Exportación limpia a PDF / Impresión**:
  - Reglas optimizadas de `@media print` que ocultan controles interactivos y respetan fondos y bordes de código (`print-color-adjust: exact`).
  - Diagramas Mermaid en SVG vectorial limpio sin duplicación de textos ni recortes.
  - Despliegue automático de bloques `<details>` y protección contra cortes de página huérfanos en tablas, listas y alertas.
- **Exportación autónoma a HTML5**: Generación de archivos `.html` autónomos sin conexión (con KaTeX y fuentes embebidas en base64).
- **Descarga directa en Markdown**: Descarga del archivo activo como `.md` con un solo clic.

### 6. Privacidad Total y Persistencia Local (IndexedDB)
- **Base de datos local (`idb`)**: Todos los documentos y carpetas se guardan directamente en el navegador del usuario (`md-studio-db`), sin límites de cuota de `localStorage`.
- **Sin servidores intermedios**: Arquitectura 100% *client-side*. Tus textos, notas y fórmulas nunca salen de tu dispositivo.
- **Guardado debounced (350 ms)**: Escrituras en segundo plano que aseguran rendimiento fluido sin bloquear la escritura.

### 7. Internacionalización Nativa 100% Offline (i18n)
- **Interfaz Bilingüe (Español / Inglés)**: Conmutación instantánea de idioma sin recargar la página ni realizar peticiones a la red o CDNs.
- **Completamente Local y Type-Safe**: Implementado con un store reactivo nativo usando Runas de Svelte 5 (`$state`, `$derived`) y esquemas tipados en TypeScript.
- **Detección Automática y Persistencia**: Detecta automáticamente el idioma del navegador (`navigator.language`) y recuerda la preferencia en `localStorage`.
- **Localización Completa**: Traduce textos de barra de herramientas, panel lateral, menús contextuales, diálogos de confirmación, estados vacíos y formatos de fecha en metadatos (`Ene`/`Jan`).

---

## 🛠️ Stack Tecnológico

| Capa / Módulo | Tecnología | Versión | Propósito |
| :--- | :--- | :--- | :--- |
| **Framework** | [Svelte 5](https://svelte.dev/) | `^5.57.2` | Runas reactivas (`$state`, `$derived`, `$effect`) |
| **Lenguaje** | [TypeScript](https://www.typescriptlang.org/) | `~6.0.3` | Tipado estático estricto del dominio y componentes |
| **Bundler & Server** | [Vite](https://vite.dev/) | `^8.3.5` | HMR ultrarrápido y empaquetado modular |
| **Editor de Código** | [CodeMirror 6](https://codemirror.net/) | `^6.0.2` | Editor extensible y accesible |
| **Minimapa** | `@replit/codemirror-minimap` | `^0.5.2` | Navegación visual en el editor |
| **Base de Datos Local** | [idb](https://github.com/jakearchibald/idb) | `^8.0.4` | Wrapper con promesas para IndexedDB |
| **Motor Markdown** | [Marked](https://marked.js.org/) | `^18.1.2` | Parser de Markdown estándar y extensiones GFM |
| **Sanitización XSS** | [DOMPurify](https://github.com/cure53/DOMPurify) | `^3.4.17` | Prevención de inyecciones de código malicioso |
| **Sintaxis en Visor** | [highlight.js](https://highlightjs.org/) | `^11.12.0` | Resaltado de código estático con botones de copia |
| **Matemáticas** | [KaTeX](https://katex.org/) | `^0.19.1` | Renderizado LaTeX KaTeX en bloque y en línea |
| **Diagramas** | [Mermaid](https://mermaid.js.org/) | `^12.2.0` | Diagramas vectoriales con renderizado nativo SVG |
| **Iconografía** | [Lucide Svelte](https://lucide.dev/) | `^1.0.1` | Iconos vectoriales limpios y accesibles |
| **Internacionalización** | [Runas de Svelte 5](https://svelte.dev/) | `—` | Localización bilingüe (ES/EN) offline y type-safe |

---

## 📁 Arquitectura del Proyecto

El código está estructurado bajo un patrón de **características modulares (`features`) y componentes UI compartidos**:

```text
markdown-studio/
├── index.html                   # Entrada HTML principal con viewport responsivo
├── package.json                 # Dependencias y scripts del proyecto
├── tsconfig.app.json            # Configuración TypeScript de la aplicación
├── vite.config.ts               # Configuración de empaquetado Vite + Svelte
└── src/
    ├── main.ts                  # Punto de montaje de la aplicación Svelte
    ├── app.css                  # Tokens globales, tema pizarra oscuro, reset y @media print
    ├── App.svelte               # Orquestador del layout, sincronización y atajos globales
    ├── locales/                 # Diccionarios de localización type-safe (es.ts, en.ts)
    ├── types/                   # Modelos de datos (DocumentItem, FolderItem, Settings, etc.)
    ├── stores/                  # Stores reactivos con runas de Svelte 5 (documents, i18n)
    ├── lib/
    │   ├── db.ts                # Operaciones CRUD sobre IndexedDB (md-studio-db)
    │   ├── codeThemes.ts        # Definición de temas de código para Editor y Visor
    │   ├── htmlExport.ts        # Generador de documentos HTML5 autónomos con KaTeX
    │   ├── markdown/            # Motor de renderizado (KaTeX, Mermaid, GFM, sanitización)
    │   │   ├── defaultDocument.ts     # Configuración y plantilla inicial
    │   │   ├── defaultGuide.md        # Manual de Astrodinámica y Simulación Orbital
    │   │   ├── markdownRenderer.ts    # Procesamiento KaTeX, GFM callouts y notas al pie
    │   │   ├── markdownUtils.ts       # Utilidades para encabezados y checkboxes
    │   │   ├── mermaidRenderer.ts     # Configuración e integración SVG de Mermaid
    │   │   └── previewInteractions.ts # Manejo de copiado, anclas y tareas
    │   └── utils/
    │       └── formatters.ts    # Formateo de fechas, tamaños de archivo e IDs
    └── components/
        ├── ui/                  # Componentes reutilizables (Button, DropdownMenu, etc.)
        ├── sidebar/             # Árbol de carpetas, buscador, archivos y TOC
        ├── toolbar/             # Barra de herramientas, selectores, LanguagePicker y snippets
        ├── editor/              # Integración de CodeMirror 6 y minimapa
        ├── preview/             # Visor de lectura y estilos de presentación
        └── workspace/           # Divisor Resizer, StatusBar y DropOverlay
```

---

## ⌨️ Atajos de Teclado

| Atajo | Acción |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>B</kbd> / <kbd>Cmd</kbd> + <kbd>B</kbd> | Alternar visibilidad del panel lateral (*Sidebar*) |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> / <kbd>Cmd</kbd> + <kbd>S</kbd> | Forzar guardado inmediato con confirmación visual |
| <kbd>Ctrl</kbd> + <kbd>P</kbd> / <kbd>Cmd</kbd> + <kbd>P</kbd> | Exportar a PDF / Imprimir documento |
| <kbd>F2</kbd> | Renombrar carpeta o documento seleccionado |
| <kbd>Tab</kbd> | Indentación con tabulación dentro del editor |
| Doble Clic en el divisor | Restablecer división de paneles al 50% / 50% |

---

## 📦 Instalación y Puesta en Marcha

### Prerrequisitos
- **Node.js** >= 18.0.0
- **npm** >= 9.0.0

### Pasos
1. Clona el repositorio:
   ```bash
   git clone https://github.com/tu-usuario/markdown-studio.git
   cd markdown-studio
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Inicia el entorno de desarrollo:
   ```bash
   npm run dev
   ```
   Abre tu navegador en `http://localhost:5173/`.

---

## 🧪 Comprobación y Compilación

- **Comprobación estricta de tipos y componentes Svelte**:
  ```bash
  npm run check
  ```
- **Compilación optimizada para producción**:
  ```bash
  npm run build
  ```
- **Previsualización local del bundle generado**:
  ```bash
  npm run preview
  ```

---

## 🤝 Desarrollo y Créditos

Markdown Studio fue diseñado, refactorizado y optimizado mediante programación en pareja (*pair programming*) continuo entre **Manuel Alvarez** y un agente avanzado de codificación impulsado por Inteligencia Artificial.

---

## 📄 Licencia

Este proyecto está licenciado bajo los términos de la **GNU Affero General Public License v3.0 (AGPL-3.0)**. Consulta el archivo [LICENSE](./LICENSE) para más detalles.

Copyright (C) 2026 Manuel Alvarez.

