<script lang="ts">
  /**
   * Encabezado del panel lateral con marca de aplicación y logotipo oficial.
   */
</script>

<div class="sidebar-header">
  <div class="header-brand">
    <img
      src="/md-studio-icon-32.png"
      alt="Kallos Markdown Logo"
      class="brand-logo"
      width="24"
      height="24"
    />
    <h2 class="sidebar-title">Kallos Markdown</h2>
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

  .brand-logo {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    object-fit: contain;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    flex-shrink: 0;
  }

  .sidebar-title {
    font-size: var(--ui-font-md, 0.8125rem);
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--text-primary, #f1f5f9);
    margin: 0;
  }
</style>
