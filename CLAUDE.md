# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`vue-esm-runtime` is a **browser-side** loader that runs Vue SFCs (`.vue`) and ES modules (`.js`) directly in the page without any build step. It targets both Vue 2.7+ and Vue 3 and is delivered as a UMD/ESM bundle in `dist/`. The README is in Traditional Chinese; both example apps (`example_vue2/`, `example_vue3/`) are runnable demos that load the bundle from `dist/`.

## Common commands

```bash
npm install              # install deps
npm run build            # rollup -c → produces all 5 dist artifacts
npm run build:watch      # rebuild on change
npm run dev              # http-server on :8080 (required: examples need HTTP, not file://)
```

There are no unit tests, no linter, no typecheck. Verification = `npm run build` succeeds, then open `http://localhost:8080/example_vue3/` (or `example_vue2/`) in a browser and confirm the demo renders without console errors. When changing compiler code, exercise both examples — they hit different code paths (Vue 3 uses `defineAsyncComponent`, Vue 2 uses a plain loader function).

## Build output

`rollup.config.js` emits five files into `dist/` from two entry points:

- `src/index.js` → `vue-esm-runtime.js` (UMD), `.min.js` (UMD min), `.esm.js` (ESM)
- `src/vue-esm-runtime-native.js` → `vue-esm-runtime-native.js` and `.min.js` (ESM only)

The native bundle is split off because it inlines `@vue/compiler-sfc` (~200KB+) and is only fetched on demand. Keep it that way — do not import from `compilers/scriptSetupNative.js` inside the main entry.

## Architecture

The pipeline for loading a `.vue` file is:

1. **`vueEsmRuntime(url, name)` / `loadComponent`** (`src/index.js`) — entry point. Returns a Vue 3 `defineAsyncComponent` if `Vue.defineAsyncComponent` exists, otherwise a plain loader function (Vue 2 path). Results are cached in the `modules` map keyed by component name.
2. **`Component.load`** (`src/Component.js`) — fetches the SFC via `httpRequest` (XHR), pre-processes self-closing PascalCase tags to paired tags, parses the SFC by creating a detached `HTMLDocument` and walking `body.firstChild`. Each top-level `<template>`/`<script>`/`<style>` becomes a `TemplateContext` / `ScriptContext` / `StyleContext`.
3. **`Component.normalize`** — handles `src="..."` attributes and `type` attributes via `langProcessor` (extensible hook on `vueEsmRuntime.langProcessor`).
4. **`Component.compile`** — runs in parallel: template returns its HTML string, script is compiled+executed, styles are appended to `<head>` with optional scoping.
5. The final `exports` object (from the script) gets `template` and `name` attached and is cached.

### Script compilation (the complex part)

`ScriptContext.compile` (`src/context/ScriptContext.js`) handles two modes:

- **Plain `<script>`** → `transformESModule()` rewrites `import`/`export` syntax to `require()`/`module.exports` via regex, then runs the code in `new Function(...)` with `module`, `exports`, `require`, `vueEsmRuntime` injected.
- **`<script setup>`** → first tries the **mini compiler** (`src/compilers/scriptSetupMini.js`). On error, dynamically `import()`s the **native compiler** (`src/compilers/scriptSetupNative.js`, which uses `@vue/compiler-sfc`) as fallback. The native compiler's URL is auto-detected from the `<script src=...>` that loaded the runtime, or can be overridden via `vueEsmRuntime.nativeCompilerUrl`.

The mini compiler is a hand-rolled, regex+state-machine transformer (~900 lines). It scans for `defineProps`/`defineEmits`/`withDefaults`/`defineExpose` macros, harvests top-level bindings, and synthesizes a `setup()` function. It deliberately does not parse TypeScript — type-only macros like `defineProps<T>()` or `defineModel()` fall through to the native compiler. When debugging script-setup issues, decide which compiler is in play first: a `[vue-esm-runtime] Mini compiler failed` console warning means the runtime fell back to native.

Both compilers share the same downstream rewriting: `import` becomes either `vueEsmRuntime.loadComponent(...)` (for `.vue`), `vueEsmRuntime.loadModule(...)` (for relative `.js`), or `require(...)` (for registered modules like `'vue'`). Note that the regex transforms in `ScriptContext.transformESModule` and `loadModule` in `src/index.js` are **separate copies** — if you change one, audit the other (and `scriptSetupNative.js`'s own `transformESModule`).

### Module resolution

- `'vue'`, `'vue-router'`, etc. → looked up in `externalModules` (populated by `registerModules()`).
- `'./foo.vue'`, `'../foo.vue'` → `loadComponent` (async).
- `'./foo.js'`, `'../foo.js'` → `loadModule` (async; transformed-and-eval'd, supports top-level `await` by wrapping the body in an async IIFE).
- `requireModule` is the **synchronous** counterpart used inside compiled SFC scripts; it falls back to a synchronous XHR for `.js` paths. Avoid adding new code that relies on sync XHR — it's there for legacy compatibility, not as a pattern to extend.

### Scoped styles

`StyleContext.compile` appends the `<style>` to `<head>`. For `scoped`, it generates a `data-s-<id>` attribute, stamps it on the template's root element, and rewrites every CSS rule's selectors at runtime via the CSSOM (`sheet.cssRules` / `insertRule`). This is intentionally a runtime rewrite rather than build-time — there is no PostCSS step.

## Conventions worth knowing

- The codebase uses **ESM source** (`"type": "module"` in package.json) but emits UMD for the main bundle so it works via a `<script>` tag without import-map setup.
- Comments and console messages are mixed Chinese/English; match the surrounding language when editing.
- The mini compiler's parsing utilities (`extractBalanced`, `findMacroCall`, `splitTopLevelArgs`, `getBraceDepthAt`) are duplicated between `ScriptContext.js`, `scriptSetupMini.js`, and `scriptSetupNative.js`. They are intentionally local copies — do not refactor into a shared module without first checking that all three sites really need identical behavior.
- TypeScript syntax in user SFCs is **explicitly unsupported** (except `import type`). Don't add partial TS support; either the native compiler handles it or it doesn't.
