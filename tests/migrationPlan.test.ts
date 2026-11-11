/**
 * ES: Regresiones del estado del plan de migración: invalidación al cambiar de carpeta y descarte de
 * respuestas tardías.
 * EN: Migration plan state regressions: invalidation on directory change and late-response discard.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { MigrationPlanState } from "../src/features/vault/migrationPlan.svelte.ts";
import type {
  MigrationCandidate,
  MigrationPlanItem,
} from "../src/features/vault/migrationService.ts";
import type { DirectoryHandle } from "../src/core/storage/workspacePort.ts";

function fakeDirectory(name: string): DirectoryHandle {
  return { kind: "directory", name } as DirectoryHandle;
}

function candidate(id: string): MigrationCandidate {
  return {
    id,
    title: `${id}.md`,
    content: "# Contenido",
    folderId: null,
    folderName: null,
    updatedAt: 0,
  };
}

function planItem(id: string): MigrationPlanItem {
  return {
    candidate: candidate(id),
    targetFolder: "",
    targetFileName: `${id}.md`,
    targetPath: `${id}.md`,
    hasCollision: false,
    resolution: "rename",
    resolvedFileName: `${id}.md`,
    resolvedPath: `${id}.md`,
  };
}

test("inspection failure clears the previous plan and blocks its directory", async () => {
  const dirA = fakeDirectory("A");
  const dirB = fakeDirectory("B");
  let rejectB: (error: unknown) => void = () => {};
  const inspect = async (_candidates: MigrationCandidate[], directory: DirectoryHandle) => {
    if (directory === dirB) {
      return await new Promise<MigrationPlanItem[]>((_resolve, reject) => { rejectB = reject; });
    }
    return [planItem("a")];
  };

  const state = new MigrationPlanState(inspect);
  await state.inspectDirectory(dirA, [candidate("a")]);
  assert.equal(state.isUsableFor(dirA), true);
  assert.equal(state.plan.length, 1);

  // ES: Al cambiar a B el plan de A deja de existir y no se puede iniciar en ninguna carpeta
  // EN: On switching to B, A's plan no longer exists and start is blocked for both directories
  const pendingB = state.inspectDirectory(dirB, [candidate("b")]);
  assert.equal(state.plan.length, 0);
  assert.equal(state.isUsableFor(dirA), false);
  assert.equal(state.isUsableFor(dirB), false);

  rejectB(new Error("Access denied"));
  await pendingB;
  assert.equal(state.failed, true);
  assert.equal(state.plan.length, 0);
  assert.equal(state.isUsableFor(dirB), false);
  assert.equal(state.isUsableFor(dirA), false);
});

test("a late result from the previous directory never replaces the current plan", async () => {
  const dirA = fakeDirectory("A");
  const dirB = fakeDirectory("B");
  let resolveA: (plan: MigrationPlanItem[]) => void = () => {};
  const inspect = async (_candidates: MigrationCandidate[], directory: DirectoryHandle) => {
    if (directory === dirA) {
      return await new Promise<MigrationPlanItem[]>(resolve => { resolveA = resolve; });
    }
    return [planItem("b")];
  };

  const state = new MigrationPlanState(inspect);
  const pendingA = state.inspectDirectory(dirA, [candidate("a")]);
  const pendingB = state.inspectDirectory(dirB, [candidate("b")]);
  await pendingB;
  assert.equal(state.directory, dirB);
  assert.deepEqual(state.plan.map(item => item.candidate.id), ["b"]);

  // ES: La respuesta tardía de A no puede reactivar su plan sobre B
  // EN: A's late response cannot reactivate its plan over B
  resolveA([planItem("a")]);
  await pendingA;
  assert.equal(state.directory, dirB);
  assert.deepEqual(state.plan.map(item => item.candidate.id), ["b"]);
  assert.equal(state.failed, false);
  assert.equal(state.isUsableFor(dirB), true);
  assert.equal(state.isUsableFor(dirA), false);
});
