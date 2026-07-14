<script lang="ts">
  export let matrix: Array<Array<number | null>>;
  export let labels: string[] = [];
  export let activeRow = matrix.length - 1;
  export let accent: 'coral' | 'blue' = 'blue';
  export let valueKind: 'probability' | 'score' = 'probability';

  $: finiteValues = matrix.flat().filter((value): value is number => typeof value === 'number');
  $: minimum = Math.min(...finiteValues);
  $: maximum = Math.max(...finiteValues);
  $: normalized = (value: number | null) => value === null
    ? 0
    : valueKind === 'probability'
      ? value
      : (value - minimum) / Math.max(maximum - minimum, Number.EPSILON);
</script>

<div class="matrix-wrap" aria-label={valueKind === 'probability' ? 'Attention probability matrix' : 'Attention score matrix'}>
  {#if labels.length}
    <div class="labels top" style={`--count:${labels.length}`}>
      {#each labels as label}<span>{label}</span>{/each}
    </div>
  {/if}
  <div class="body">
    {#if labels.length}<div class="labels side">{#each labels as label}<span>{label}</span>{/each}</div>{/if}
    <div class="matrix" style={`--columns:${matrix[0]?.length ?? 1}`}>
      {#each matrix as row, rowIndex}
        {#each row as value}
          <div class:active={rowIndex === activeRow} class:masked={value === null || (valueKind === 'probability' && value === 0)} class:coral={accent === 'coral'} class="cell" style={`--value:${normalized(value)}`}>
            <span>{value === null ? '—' : valueKind === 'score' ? value.toFixed(1) : value === 0 ? '—' : value.toFixed(2)}</span>
          </div>
        {/each}
      {/each}
    </div>
  </div>
</div>

<style>
  .matrix-wrap { width: 100%; }
  .body { display: flex; gap: .55rem; }
  .matrix { flex: 1; display: grid; grid-template-columns: repeat(var(--columns), minmax(42px, 1fr)); gap: .45rem; }
  .cell { position: relative; aspect-ratio: 1; display: grid; place-items: center; overflow: hidden; border: 1px solid rgba(22,33,43,.08); border-radius: 8px; background: color-mix(in srgb, var(--blue) calc(var(--value) * 86%), #eff1ee); transition: transform .3s, filter .3s; }
  .cell.coral { background: color-mix(in srgb, var(--coral) calc(var(--value) * 86%), #eff1ee); }
  .cell.active { transform: scale(1.04); filter: saturate(1.2); }
  .cell.masked { background: repeating-linear-gradient(135deg, #edf0ed 0 5px, #e3e6e3 5px 6px); color: #9aa19f; }
  .cell span { font: clamp(.55rem, .8vw, .73rem) 'IBM Plex Mono', monospace; color: color-mix(in srgb, white calc(var(--value) * 120%), var(--ink)); }
  .labels { font: .65rem 'IBM Plex Mono', monospace; color: var(--muted); }
  .labels.top { display: grid; grid-template-columns: repeat(var(--count), 1fr); gap: .45rem; margin: 0 0 .5rem 3.5rem; text-align: center; }
  .labels.side { width: 3rem; display: grid; grid-template-rows: repeat(5, 1fr); align-items: center; text-align: right; }
  @media (max-width: 600px) { .matrix { gap: .25rem; } .cell { border-radius: 5px; } .labels.top { margin-left: 0; } .labels.side { display: none; } }
</style>
