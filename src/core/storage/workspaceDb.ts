/** ES: Conserva referencias nativas sin copiar contenidos ni guardar permisos como autoridad.
 * EN: Retains native references without copying contents or treating stored permissions as authoritative. */
import { getDb } from "./db";
import type { WorkspaceReferencePort } from "./workspacePort";

export const workspaceReferences: WorkspaceReferencePort = {
  async getWorkspaces() {
    return (await getDb()).getAll("workspaces");
  },
  async saveWorkspace(workspace) {
    await (await getDb()).put("workspaces", workspace);
  },
};
