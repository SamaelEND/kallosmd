/**
 * ES: Estado reactivo del plan de migración. Invalida resultados obsoletos al cambiar de carpeta y
 * bloquea el inicio si la inspección del destino actual falla.
 * EN: Reactive migration plan state. Invalidates stale results when the directory changes and blocks
 * start when inspecting the current destination fails.
 */
import type { DirectoryHandle } from "../../core/storage/workspacePort";
import {
  inspectMigration,
  type MigrationCandidate,
  type MigrationPlanItem,
} from "./migrationService";

type InspectFn = (
  candidates: MigrationCandidate[],
  directory: DirectoryHandle,
) => Promise<MigrationPlanItem[]>;

export class MigrationPlanState {
  plan = $state<MigrationPlanItem[]>([]);
  directory = $state.raw<DirectoryHandle | null>(null);
  inspecting = $state(false);
  failed = $state(false);
  private request = 0;
  private readonly inspect: InspectFn;

  constructor(inspect: InspectFn = inspectMigration) {
    this.inspect = inspect;
  }

  /** ES: Descarta el plan y cualquier inspección en curso. EN: Discards the plan and any in-flight inspection. */
  invalidate(): void {
    this.request++;
    this.plan = [];
    this.directory = null;
    this.inspecting = false;
    this.failed = false;
  }

  /**
   * ES: Inspecciona el destino. Limpia el plan anterior de inmediato y descarta respuestas tardías
   * de una carpeta que ya no es la activa.
   * EN: Inspects the destination. Clears the previous plan immediately and discards late responses
   * from a directory that is no longer active.
   */
  async inspectDirectory(
    target: DirectoryHandle | null,
    candidates: MigrationCandidate[],
  ): Promise<void> {
    const request = ++this.request;
    this.plan = [];
    this.directory = null;
    this.failed = false;

    if (!target) {
      this.inspecting = false;
      return;
    }

    this.inspecting = true;
    try {
      const nextPlan = await this.inspect(candidates, target);
      if (request !== this.request) return;
      this.plan = nextPlan;
      this.directory = target;
    } catch {
      if (request !== this.request) return;
      this.plan = [];
      this.directory = null;
      this.failed = true;
    } finally {
      if (request === this.request) this.inspecting = false;
    }
  }

  /**
   * ES: Solo se puede migrar con un plan vigente inspeccionado para la carpeta actualmente activa.
   * EN: Migration is only allowed with a current plan inspected for the currently active directory.
   */
  isUsableFor(target: DirectoryHandle | null): boolean {
    return target !== null && this.directory === target && this.plan.length > 0
      && this.plan.every((item) => item.resolution !== "ask");
  }
}
