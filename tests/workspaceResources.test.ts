/**
 * ES: Pruebas unitarias para resolución y lectura de recursos relativos en el workspace.
 * EN: Unit tests for resolution and reading of relative workspace resources.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveResourcePath,
  readWorkspaceResource,
  readWorkspaceResourceByPath,
  InvalidResourcePathError,
  ResourceNotFoundError,
  PermissionDeniedError,
  UnsupportedCapabilityError,
  guessMimeType,
} from "../src/core/storage/workspaceResources.ts";
import type { DirectoryHandle, WorkspaceFileHandle } from "../src/core/storage/workspacePort.ts";
import { workspaceFixture } from "./workspaceFixtures.ts";

function createMockBinaryFile(
  name: string,
  bytes: Uint8Array,
  mimeType = "image/png",
): WorkspaceFileHandle {
  const fileObj = new File([bytes], name, { type: mimeType });
  return {
    kind: "file" as const,
    name,
    getFile: async () => fileObj,
    createWritable: async () => ({
      write: async () => {},
      close: async () => {},
      abort: async () => {},
    }),
    isSameEntry: async () => false,
  };
}

test("resolves relative resources from document folder and preserves Unicode names", () => {
  // ES: Documento en raíz resolviendo recurso en subcarpeta
  // EN: Root document resolving resource in subfolder
  const res1 = resolveResourcePath("guia.md", "./assets/diagram.png");
  assert.equal(res1.workspaceRelativePath, "assets/diagram.png");
  assert.equal(res1.parentPath, "assets");
  assert.equal(res1.fileName, "diagram.png");

  // ES: Documento en subcarpeta resolviendo recurso relativo hermano
  // EN: Subfolder document resolving sibling relative resource
  const res2 = resolveResourcePath("docs/manual.md", "./assets/captura.jpg");
  assert.equal(res2.workspaceRelativePath, "docs/assets/captura.jpg");
  assert.equal(res2.parentPath, "docs/assets");
  assert.equal(res2.fileName, "captura.jpg");

  // ES: Documento en subcarpeta profunda resolviendo con ../
  // EN: Deep subfolder document resolving with ../
  const res3 = resolveResourcePath("proyectos/2026/reporte.md", "../assets/logo.svg");
  assert.equal(res3.workspaceRelativePath, "proyectos/assets/logo.svg");
  assert.equal(res3.parentPath, "proyectos/assets");
  assert.equal(res3.fileName, "logo.svg");

  // ES: Preservación de nombres y rutas Unicode
  // EN: Preservation of Unicode names and paths
  const res4 = resolveResourcePath(
    "investigación/física cuántica/artículo.md",
    "./gráficos/óptica-mhd.png",
  );
  assert.equal(
    res4.workspaceRelativePath,
    "investigación/física cuántica/gráficos/óptica-mhd.png",
  );
  assert.equal(res4.parentPath, "investigación/física cuántica/gráficos");
  assert.equal(res4.fileName, "óptica-mhd.png");

  // ES: Limpieza de hash y query string
  // EN: Strip hash and query string
  const res5 = resolveResourcePath("doc.md", "images/fig.png?v=2#seccion");
  assert.equal(res5.workspaceRelativePath, "images/fig.png");
  assert.equal(res5.fileName, "fig.png");

  // ES: Decodificación de secuencias URI %20
  // EN: Decoding of %20 URI sequences
  const res6 = resolveResourcePath("doc.md", "assets/mi%20grafico.png");
  assert.equal(res6.workspaceRelativePath, "assets/mi grafico.png");
  assert.equal(res6.fileName, "mi grafico.png");
});

test("rejects external destinations, absolute paths, and workspace root escapes", () => {
  // ES: Rechazar destinos externos con protocolo
  // EN: Reject external destinations with protocol
  assert.throws(
    () => resolveResourcePath("guia.md", "https://kallosmd.xyz/assets/img.png"),
    InvalidResourcePathError,
  );
  assert.throws(
    () => resolveResourcePath("guia.md", "http://example.com/test.jpg"),
    InvalidResourcePathError,
  );
  assert.throws(
    () => resolveResourcePath("guia.md", "data:image/png;base64,iVBORw0KGgo="),
    InvalidResourcePathError,
  );
  assert.throws(
    () => resolveResourcePath("guia.md", "//cdn.example.com/asset.png"),
    InvalidResourcePathError,
  );

  // ES: Rechazar rutas absolutas Unix y letras de unidad Windows
  // EN: Reject Unix absolute paths and Windows drive letters
  assert.throws(
    () => resolveResourcePath("guia.md", "/etc/passwd"),
    InvalidResourcePathError,
  );
  assert.throws(
    () => resolveResourcePath("guia.md", "C:\\Windows\\system32\\calc.exe"),
    InvalidResourcePathError,
  );
  assert.throws(
    () => resolveResourcePath("guia.md", "D:/assets/foto.jpg"),
    InvalidResourcePathError,
  );

  // ES: Rechazar escape de la raíz del espacio de trabajo mediante ..
  // EN: Reject escaping workspace root via ..
  assert.throws(
    () => resolveResourcePath("guia.md", "../outside.png"),
    InvalidResourcePathError,
  );
  assert.throws(
    () => resolveResourcePath("docs/sub/doc.md", "../../../outside.png"),
    InvalidResourcePathError,
  );

  // ES: Rechazar barras invertidas y caracteres de control
  // EN: Reject backslashes and control characters
  assert.throws(
    () => resolveResourcePath("guia.md", "assets\\img.png"),
    InvalidResourcePathError,
  );
  assert.throws(
    () => resolveResourcePath("guia.md", "assets/\x00null.png"),
    InvalidResourcePathError,
  );

  // ES: Rechazar cadenas vacías o rutas inválidas
  // EN: Reject empty strings or invalid paths
  assert.throws(
    () => resolveResourcePath("", "assets/img.png"),
    InvalidResourcePathError,
  );
  assert.throws(
    () => resolveResourcePath("doc.md", ""),
    InvalidResourcePathError,
  );
  assert.throws(
    () => resolveResourcePath("doc.md", "."),
    InvalidResourcePathError,
  );
});

test("reads binary content on demand preserving bytes without importing to IndexedDB", async () => {
  const f = workspaceFixture();

  // ES: Crear estructura de directorios con un archivo binario PNG
  // EN: Create directory structure with a binary PNG file
  const testBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0xfe, 0xfd]);
  const assetsDir = await f.notesDir.getDirectoryHandle("assets", { create: true });
  const mockFileHandle = createMockBinaryFile("esquema.png", testBytes, "image/png");
  (assetsDir as ReturnType<typeof f.notesDir.getDirectoryHandle> extends Promise<infer T> ? T : never & { entries: Map<string, unknown> }).entries.set("esquema.png", mockFileHandle);

  // ES: Lectura bajo demanda relativa al documento "notes/guide.md"
  // EN: On-demand reading relative to document "notes/guide.md"
  const resource = await readWorkspaceResource(f.root, "notes/guide.md", "./assets/esquema.png");

  assert.equal(resource.name, "esquema.png");
  assert.equal(resource.path, "notes/assets/esquema.png");
  assert.equal(resource.type, "image/png");
  assert.equal(resource.size, testBytes.length);

  // ES: Conservación binaria exacta de bytes
  // EN: Exact binary preservation of bytes
  const readBytes = await resource.bytes();
  assert.deepEqual(readBytes, testBytes);

  // ES: Verificar que no se alteró la base de datos de documentos
  // EN: Verify documents database was not altered
  assert.equal(f.storage.drafts.size, 0);
  const docs = await f.storage.getAllDocuments();
  assert.equal(docs.length, 0);
});

test("distinguishes non-existent resource, missing capability, and permission denied", async () => {
  const f = workspaceFixture();

  // 1. Recurso inexistente en directorio existente
  // 1. Non-existent resource in existing directory
  await assert.rejects(
    () => readWorkspaceResource(f.root, "notes/guide.md", "./assets/no-existe.png"),
    ResourceNotFoundError,
  );

  // 2. Directorio intermedio inexistente
  // 2. Non-existent intermediate directory
  await assert.rejects(
    () => readWorkspaceResource(f.root, "notes/guide.md", "./carpeta_inexistente/foto.png"),
    ResourceNotFoundError,
  );

  // 3. Capacidad no disponible (handle inválido o corrupto)
  // 3. Capability not available (invalid or corrupted handle)
  await assert.rejects(
    () => readWorkspaceResource(null as unknown as DirectoryHandle, "guide.md", "asset.png"),
    UnsupportedCapabilityError,
  );
  await assert.rejects(
    () => readWorkspaceResource({} as unknown as DirectoryHandle, "guide.md", "asset.png"),
    UnsupportedCapabilityError,
  );

  // 4. Permiso denegado
  // 4. Permission denied
  const restrictedRoot = {
    ...f.root,
    queryPermission: async () => "denied" as PermissionState,
  };
  await assert.rejects(
    () => readWorkspaceResource(restrictedRoot, "notes/guide.md", "assets/foto.png"),
    PermissionDeniedError,
  );
});

test("workspaceStore provides readResource when workspace is open", async () => {
  const f = workspaceFixture();
  await f.documents.initialize();

  // ES: Sin espacio de trabajo abierto devuelve null
  // EN: Without open workspace returns null
  assert.equal(await f.workspace.readResource("notes/guide.md", "./assets/test.png"), null);

  // ES: Con espacio de trabajo abierto
  // EN: With open workspace
  await f.workspace.choose();

  const testBytes = new Uint8Array([1, 2, 3, 4, 5]);
  const mockFile = createMockBinaryFile("datos.bin", testBytes, "application/octet-stream");
  (f.notesDir as unknown as { entries: Map<string, unknown> }).entries.set("datos.bin", mockFile);

  const resource = await f.workspace.readResource("notes/guide.md", "./datos.bin");
  assert.ok(resource);
  assert.equal(resource.name, "datos.bin");
  assert.equal(resource.path, "notes/datos.bin");
  assert.deepEqual(await resource.bytes(), testBytes);
});

test("infers common MIME types when browser file.type is empty", () => {
  assert.equal(guessMimeType("imagen.png"), "image/png");
  assert.equal(guessMimeType("foto.jpg"), "image/jpeg");
  assert.equal(guessMimeType("foto.jpeg"), "image/jpeg");
  assert.equal(guessMimeType("vector.svg"), "image/svg+xml");
  assert.equal(guessMimeType("animacion.gif"), "image/gif");
  assert.equal(guessMimeType("grafico.webp"), "image/webp");
  assert.equal(guessMimeType("manual.pdf"), "application/pdf");
  assert.equal(guessMimeType("audio.mp3"), "audio/mpeg");
  assert.equal(guessMimeType("video.mp4"), "video/mp4");
  assert.equal(guessMimeType("desconocido.xyz123"), "application/octet-stream");
  assert.equal(guessMimeType("sin_extension"), "application/octet-stream");
});

test("readWorkspaceResourceByPath resolves direct workspace-relative path", async () => {
  const f = workspaceFixture();
  const testBytes = new Uint8Array([10, 20, 30]);
  const mockFile = createMockBinaryFile("banner.png", testBytes, "image/png");
  (f.root as unknown as { entries: Map<string, unknown> }).entries.set("banner.png", mockFile);

  const resource = await readWorkspaceResourceByPath(f.root, "banner.png");
  assert.equal(resource.name, "banner.png");
  assert.equal(resource.path, "banner.png");
  assert.deepEqual(await resource.bytes(), testBytes);
});

test("regression 1: rejects documentPath outside workspace root and prevents .. in resolved path", () => {
  // ES: Rechazar rutas de documento que intenten escapar la raíz del workspace con ../
  // EN: Reject document paths that attempt to escape workspace root with ../
  assert.throws(
    () => resolveResourcePath("../fuera.md", "assets/a.png"),
    InvalidResourcePathError,
  );
  assert.throws(
    () => resolveResourcePath("sub/../../fuera.md", "assets/a.png"),
    InvalidResourcePathError,
  );

  // ES: Rechazar rutas absolutas de documento (Unix y Windows)
  // EN: Reject absolute document paths (Unix and Windows)
  assert.throws(
    () => resolveResourcePath("/fuera.md", "assets/a.png"),
    InvalidResourcePathError,
  );
  assert.throws(
    () => resolveResourcePath("C:/fuera.md", "assets/a.png"),
    InvalidResourcePathError,
  );
  assert.throws(
    () => resolveResourcePath("c:\\fuera.md", "assets/a.png"),
    InvalidResourcePathError,
  );

  // ES: Garantizar que ninguna ruta resuelta válida contenga segmentos '..'
  // EN: Guarantee that no valid resolved path contains '..' segments
  const resolved = resolveResourcePath("a/b/doc.md", "../c/img.png");
  assert.equal(resolved.workspaceRelativePath, "a/c/img.png");
  assert.ok(!resolved.workspaceRelativePath.split("/").includes(".."));
});

test("regression 2: preserves arbitrary binary bytes without UTF-8 corruption or rejects safely", async () => {
  const f = workspaceFixture();
  // ES: Bytes no representables limpiamente en UTF-8 (BOM UTF-16 o binario puro: [255, 254])
  // EN: Bytes not cleanly representable in UTF-8 (UTF-16 BOM or raw binary: [255, 254])
  const rawProblematicBytes = new Uint8Array([255, 254]);

  // ES: Adaptador no-Blob que ofrece arrayBuffer(): debe preservar [255, 254] intactos
  // EN: Non-Blob adapter offering arrayBuffer(): must preserve [255, 254] intact
  const nonBlobWithArrayBuffer: WorkspaceFileHandle = {
    kind: "file",
    name: "binary.dat",
    getFile: async () => ({
      name: "binary.dat",
      type: "application/octet-stream",
      size: rawProblematicBytes.length,
      arrayBuffer: async () => rawProblematicBytes.buffer.slice(0),
      text: async () => new TextDecoder().decode(rawProblematicBytes),
    } as unknown as File),
    createWritable: async () => ({
      write: async () => {},
      close: async () => {},
      abort: async () => {},
    }),
    isSameEntry: async () => false,
  };

  (f.root as unknown as { entries: Map<string, unknown> }).entries.set("binary.dat", nonBlobWithArrayBuffer);

  const res1 = await readWorkspaceResource(f.root, "doc.md", "./binary.dat");
  const bytes1 = await res1.bytes();
  assert.deepEqual(bytes1, rawProblematicBytes);
  // ES: Confirmar que NO se transformó en los 6 bytes de reemplazo UTF-8 [239, 191, 189, 239, 191, 189]
  // EN: Confirm it was NOT transformed into 6 UTF-8 replacement bytes [239, 191, 189, 239, 191, 189]
  assert.equal(bytes1.length, 2);
  assert.equal(bytes1[0], 255);
  assert.equal(bytes1[1], 254);

  // ES: Adaptador no-Blob que solo ofrece text(): debe lanzar UnsupportedCapabilityError y no corromper
  // EN: Non-Blob adapter offering only text(): must throw UnsupportedCapabilityError and not corrupt
  const nonBlobTextOnly: WorkspaceFileHandle = {
    kind: "file",
    name: "corruptible.dat",
    getFile: async () => ({
      name: "corruptible.dat",
      text: async () => "corruptible",
    } as unknown as File),
    createWritable: async () => ({
      write: async () => {},
      close: async () => {},
      abort: async () => {},
    }),
    isSameEntry: async () => false,
  };

  (f.root as unknown as { entries: Map<string, unknown> }).entries.set("corruptible.dat", nonBlobTextOnly);

  await assert.rejects(
    () => readWorkspaceResource(f.root, "doc.md", "./corruptible.dat"),
    UnsupportedCapabilityError,
  );
});

test("regression 3: rejects encoded null characters, backslashes, and control sequences after decoding", () => {
  // ES: Rechazar caracteres nulos o de control codificados en URI como %00
  // EN: Reject encoded null or control characters in URI like %00
  assert.throws(
    () => resolveResourcePath("doc.md", "assets/%00imagen.png"),
    InvalidResourcePathError,
  );
  assert.throws(
    () => resolveResourcePath("doc.md", "assets/%1Fimagen.png"),
    InvalidResourcePathError,
  );

  // ES: Rechazar barras invertidas codificadas en URI (%5C y %5c)
  // EN: Reject encoded backslashes in URI (%5C and %5c)
  assert.throws(
    () => resolveResourcePath("doc.md", "assets/%5Cimagen.png"),
    InvalidResourcePathError,
  );
  assert.throws(
    () => resolveResourcePath("doc.md", "assets/%5cimagen.png"),
    InvalidResourcePathError,
  );
  assert.throws(
    () => resolveResourcePath("doc.md", "%5C%5Cservidor%5Crecurso.png"),
    InvalidResourcePathError,
  );
});
