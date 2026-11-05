<script lang="ts">
  /**
   * Caja de búsqueda reactiva para filtrar documentos por título o contenido.
   */
  import { Search, X } from "lucide-svelte";
  import { i18n } from "../../stores/i18n.svelte";

  interface Props {
    query: string;
  }

  let { query = $bindable("") }: Props = $props();

  const t = $derived(i18n.current);
  const hasQuery = $derived(query.trim().length > 0);
</script>

<div class="search-box-wrap">
  <div class="search-box" class:has-focus={hasQuery}>
    <Search size={15} class="search-icon" />
    <input
      type="text"
      placeholder={t.sidebar.searchPlaceholder}
      bind:value={query}
      class="search-input"
      aria-label={t.sidebar.searchAria}
    />
    {#if query}
      <button
        type="button"
        class="clear-search-btn"
        onclick={() => (query = "")}
        aria-label={t.sidebar.clearSearch}
      >
        <X size={13} />
      </button>
    {/if}
  </div>
</div>

<style>
  .search-box-wrap {
    padding: 0 14px 14px 14px;
  }

  .search-box {
    display: flex;
    align-items: center;
    padding: 0 10px;
    height: 34px;
    background: var(--bg-input, #181b20);
    border: 1px solid var(--border-color, #262a33);
    border-radius: 7px;
    position: relative;
    transition: all 0.15s ease;
  }

  .search-box.has-focus,
  .search-box:focus-within {
    border-color: #3b82f6;
    box-shadow: 0 0 0 1.5px #3b82f6;
    background: var(--bg-input, #181b20);
  }

  :global(.search-icon) {
    color: var(--text-faint, #64748b);
    margin-right: 8px;
    flex-shrink: 0;
  }

  .search-input {
    width: 100%;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary, #f1f5f9);
    font-size: var(--ui-font-sm, 0.75rem);
    font-family: inherit;
  }

  .search-input::placeholder {
    color: var(--text-faint, #64748b);
  }

  .clear-search-btn {
    background: transparent;
    border: none;
    color: var(--text-faint, #64748b);
    padding: 2px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }

  .clear-search-btn:hover {
    color: var(--text-primary, #f1f5f9);
  }
</style>
