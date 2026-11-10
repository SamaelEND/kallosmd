/**
 * ES: Resuelve imports TypeScript, recursos Markdown y módulos con runas en las pruebas de Node 24.
 * EN: Resolves TypeScript imports, Markdown assets, and rune modules in Node 24 tests.
 */
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { compileModule } from "svelte/compiler";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".md?raw")) {
      const markdown = readFileSync(new URL(url.slice(0, -4)), "utf8");
      return { format: "module", source: `export default ${JSON.stringify(markdown)}`, shortCircuit: true };
    }
    if (url.endsWith(".svelte.ts")) {
      const source = stripTypeScriptTypes(readFileSync(new URL(url), "utf8"), { mode: "transform" });
      const compiled = compileModule(source, { filename: fileURLToPath(url), generate: "client" });
      return { format: "module", source: compiled.js.code, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL
    ) {
      const parentDir = dirname(fileURLToPath(context.parentURL));
      const candidateTs = resolve(parentDir, `${specifier}.ts`);
      if (existsSync(candidateTs)) {
        return nextResolve(pathToFileURL(candidateTs).href, context);
      }
      const candidateIndexTs = resolve(parentDir, specifier, "index.ts");
      if (existsSync(candidateIndexTs)) {
        return nextResolve(pathToFileURL(candidateIndexTs).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

