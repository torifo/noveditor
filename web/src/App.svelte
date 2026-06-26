<script lang="ts">
  import { onMount } from 'svelte'
  import { AppState } from './state/appState.svelte'
  import Editor from './editor/Editor.svelte'
  import ManuscriptList from './list/ManuscriptList.svelte'

  const app = new AppState()

  onMount(() => {
    void app.init()
  })
</script>

<header class="app-header">
  <h1>noveditor</h1>
</header>

<div class="layout">
  <ManuscriptList {app} />
  <Editor {app} />
</div>

<style>
  .app-header {
    padding: 0.6rem 1rem;
    border-bottom: 1px solid #ddd;
  }
  .app-header h1 {
    font-size: 1.2rem;
    margin: 0;
  }
  .layout {
    display: flex;
    align-items: stretch;
    min-height: calc(100vh - 3rem);
  }
  :global(body) {
    margin: 0;
    font-family: system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif;
  }
</style>
