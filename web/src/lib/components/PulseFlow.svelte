<script lang="ts">
  import { IconArrowRight } from '@tabler/icons-svelte';
  export let labels: string[];
  export let progress = 0;
  export let compact = false;
</script>

<div class:compact class="flow">
  {#each labels as label, index}
    <div class:active={progress >= index / labels.length} class="node">
      <span class="index mono">{String(index + 1).padStart(2, '0')}</span>
      <strong>{label}</strong>
      <i style={`--fill:${Math.max(0, Math.min(1, progress * labels.length - index))}`}></i>
    </div>
    {#if index < labels.length - 1}<IconArrowRight class="arrow" size={20} stroke={1.6} />{/if}
  {/each}
</div>

<style>
  .flow { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr; align-items: stretch; gap: 1rem; }
  .node { position: relative; min-height: 150px; padding: 1.35rem; overflow: hidden; border: 1px solid var(--line); border-radius: 14px; background: var(--paper); display: flex; flex-direction: column; justify-content: space-between; transition: transform .3s, border-color .3s; }
  .node i { position: absolute; left: 0; bottom: 0; width: calc(var(--fill) * 100%); height: 5px; background: var(--coral); transition: width .12s linear; }
  .node.active { border-color: var(--coral); transform: translateY(-4px); }
  .index { color: var(--coral-dark); font-size: .72rem; }
  .node strong { max-width: 10rem; font-size: 1rem; line-height: 1.2; }
  :global(.arrow) { align-self: center; color: #9ba29e; }
  .compact .node { min-height: 100px; }
  @media (max-width: 820px) { .flow { grid-template-columns: 1fr; } :global(.arrow) { transform: rotate(90deg); justify-self: center; } .node { min-height: 95px; } }
</style>
