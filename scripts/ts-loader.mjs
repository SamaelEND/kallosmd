/**
 * ES: Hook ligero de resolución ESM de Node 24 para soportar imports relativos sin extensión (.ts) en pruebas unitarias.
 * EN: Lightweight Node 24 ESM resolution hook to support extensionless relative (.ts) imports in unit tests.
 */
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

registerHooks({
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

