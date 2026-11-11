# Respaldo local / Local backup

Formato JSON versionado del modo local (IndexedDB): documentos, carpetas y borradores
recuperables. No es el ZIP de entrega ni un respaldo de Lectura Activa.

## Estructura / Structure

```json
{
  "format": "kallosmd-backup",
  "version": 1,
  "exportedAt": 1762752000000,
  "folders": [{ "id": "f1", "name": "Notas", "createdAt": 1, "updatedAt": 2, "isExpanded": true }],
  "documents": [{
    "id": "d1", "title": "guía.md", "content": "# Guía", "createdAt": 1, "updatedAt": 2,
    "folderId": "f1", "hasCustomTitle": true, "tags": ["uno"], "isFavorite": false
  }],
  "drafts": [{
    "key": "[\"local\",\"d2\"]",
    "identity": { "kind": "local", "id": "d2" },
    "confirmedContent": null,
    "document": { "id": "d2", "title": "borrador.md", "content": "texto", "createdAt": 1, "updatedAt": 2, "folderId": null, "hasCustomTitle": true }
  }]
}
```

- `format` debe ser `kallosmd-backup`; `version` debe ser `1`.
- `folderId` referencia una carpeta del mismo archivo o `null`.
- Los borradores pueden tener identidad `local` o `file`. La identidad `file` conserva
  `workspaceId` y una ruta relativa; nunca una ruta absoluta ni un handle nativo.
- `fileHandle`, rutas absolutas, permisos y contenido de otros orígenes no se serializan.
- Los documentos locales nuevos viven como borradores con `confirmedContent: null`.

## Validación / Validation

La importación valida formato, versión, tipos, identificadores duplicados, claves de
borrador y referencias de carpeta antes de escribir. Un archivo inválido se rechaza
completo. La restauración en IndexedDB es atómica: un fallo no modifica los datos
existentes.

Si un identificador ya existe, la interfaz pide confirmación explícita para reemplazar
solo esas versiones; el resto de los datos actuales se conserva. Cancelar no modifica
nada.

El modelo local actual no tiene carpetas anidadas: la jerarquía es carpeta → documentos
mediante `folderId`. Los nombres repetidos y Unicode se conservan tal cual.
