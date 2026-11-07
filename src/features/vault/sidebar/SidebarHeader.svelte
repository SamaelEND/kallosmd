<script lang="ts">
  /**
   * Encabezado del panel lateral con marca de aplicación y botón para ocultar.
   */
  import { FileText } from "lucide-svelte";
</script>

<div class="sidebar-header">
  <div class="header-brand">
    <div class="brand-badge">
      <FileText size={16} />
    </div>
    <h2 class="sidebar-title">Markdown Studio</h2>
  </div>
</div>

<style>
  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 12px 16px;
    min-width: 290px;
  }

  .header-brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .brand-badge {
    width: 26px;
    height: 26px;
    border-radius: 7px;
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  }

  .sidebar-title {
    font-size: var(--ui-font-md, 0.8125rem);
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--text-primary, #f1f5f9);
    margin: 0;
  }
</style>
