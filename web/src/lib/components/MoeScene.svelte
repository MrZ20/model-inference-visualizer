<script lang="ts">
  import { IconArrowRight, IconPlayerPlay, IconX } from '@tabler/icons-svelte';
  import type { TraceExperience } from '$lib/experience/scene-model';
  import type { Locale } from '$lib/playback/engine';
  import { createCatalog } from '$lib/i18n/catalog';
  import { stageProgress } from '$lib/projection/projector';

  export let moe: TraceExperience['moe'];
  export let promptPieces: string[];
  export let progress = 0;
  export let focused = false;
  export let focusProgress = 0;
  export let locale: Locale = 'en';
  export let onToggle: () => void;
  export let onSeek: (progress: number) => void;
  export let onPlay: () => void;

  let selectedToken = 0;
  let selectedRank = 0;
  const stages = ['router', 'topEight', 'dispatch', 'dynamicScale', 'gmm1Swiglu', 'gmm2Combine'] as const;
  $: t = createCatalog(locale);
  $: route = moe.tokenRoutes[selectedToken];
  $: rank = moe.ranks[selectedRank];
  $: selectedIds = new Set(route.expertIds);
</script>

<div class:focused class="moe-scene" style={`--focus:${focusProgress};--moe-progress:${progress}`} data-motion-progress={progress.toFixed(3)}>
  <div class="moe-overview">
    <div class="router-overview">
      <div class="visual-label"><span>{t('router')} · [5, 256]</span><span class="fidelity real">{t('captured')}</span></div>
      <div class="router-route-bars">
        {#each route.expertIds as id, index}
          <div><span class="mono">E{id}</span><i><b style={`--weight:${route.weights[index] / Math.max(...route.weights)}`}></b></i><strong class="mono">{route.weights[index].toFixed(3)}</strong></div>
        {/each}
      </div>
    </div>
    <div class="expert-capacity">
      <div class="visual-label"><span>{moe.expertCount} {t('experts')}</span><small>{t('onlyEightActive')}</small></div>
      <div class="expert-map" role="list" aria-label="256 router experts">
        {#each Array(moe.expertCount) as _, index}
          <div role="listitem" class:selected={selectedIds.has(index)} title={`Expert ${index}${selectedIds.has(index) ? ' selected' : ''}`}><span>{selectedIds.has(index) ? `E${index}` : ''}</span></div>
        {/each}
      </div>
    </div>
    <button class="focus-entry" aria-label={t('expandMoe')} aria-expanded={focused} on:click={onToggle}>
      <span>{focused ? t('close') : t('expandMoe')}</span>
      <IconArrowRight size={18} />
      <small>{t('moeEntryHint')}</small>
    </button>
  </div>

  {#if focused}
    <div class="moe-focus" data-detail="moe" role="region" aria-label={t('moeInternals')}>
      <div class="focus-toolbar">
        <div><span class="fidelity real">{t('captured')}</span><strong>{t('moeInternals')}</strong><small>{t('moeFocusHint')}</small></div>
        <div class="segmented-selectors">
          <div role="group" aria-label={t('selectToken')}>
            {#each promptPieces as token, index}<button class:active={selectedToken === index} on:click={() => selectedToken = index}><span class="mono">{index}</span>{token}</button>{/each}
          </div>
          <div role="group" aria-label={t('selectRank')}>
            {#each moe.ranks as rankItem}<button class:active={selectedRank === rankItem.rank} on:click={() => selectedRank = rankItem.rank}>Rank {rankItem.rank}</button>{/each}
          </div>
        </div>
        <button class="close-focus" aria-label={t('close')} on:click={onToggle}><IconX size={18} /></button>
      </div>

      <div class="scene-stepper" aria-label={t('moeSequence')}>
        {#each stages as stage, index}<button class:active={stageProgress(progress, index, stages.length) > .15} on:click={() => onSeek((index + .25) / stages.length)}><span>{String(index + 1).padStart(2, '0')}</span>{t(stage)}</button>{/each}
        <button class="play-sequence" on:click={onPlay}><IconPlayerPlay size={17} />{t('playSequence')}</button>
      </div>

      <div class="moe-pipeline-full">
        <article class="moe-stage router-stage" style={`--stage:${stageProgress(progress, 0, stages.length)}`}>
          <div class="visual-label"><span>{t('router')}</span><span class="mono">[5, 256]</span></div>
          <div class="token-route-source"><strong>{promptPieces[selectedToken]}</strong><span class="mono">token {selectedToken}</span><IconArrowRight size={18} /></div>
          <small>{t('routerScoresAllExperts')}</small>
        </article>

        <article class="moe-stage topk-stage" style={`--stage:${stageProgress(progress, 1, stages.length)}`}>
          <div class="visual-label"><span>{t('topEight')}</span><span class="fidelity real">{t('captured')}</span></div>
          <div class="topk-list">{#each route.expertIds as id, index}<div><span class="mono">E{id}</span><i><b style={`--weight:${route.weights[index] / Math.max(...route.weights)}`}></b></i><strong class="mono">{route.weights[index].toFixed(3)}</strong></div>{/each}</div>
        </article>

        <article class="moe-stage dispatch-stage" style={`--stage:${stageProgress(progress, 2, stages.length)}`}>
          <div class="visual-label"><span>{t('dispatch')}</span><span class="mono">[{rank.dispatch.shape.join(', ')}]</span></div>
          <div class="dispatch-grid" aria-label="40 dispatched token-expert rows">{#each Array(40) as _, index}<i class:active={index < Math.ceil(stageProgress(progress, 2, stages.length) * 40)} style={`--v:${((index * 29) % 100) / 100}`}></i>{/each}</div>
          <small class="mono">{rank.dispatch.dtype} · {rank.device}</small>
        </article>

        <article class="moe-stage scale-stage" style={`--stage:${stageProgress(progress, 3, stages.length)}`}>
          <div class="visual-label"><span>{t('dynamicScale')}</span><span class="fidelity real">{t('captured')}</span></div>
          <div class="scale-strip">{#each rank.dispatchScale.sample ?? [] as value}<i style={`--h:${value / (rank.dispatchScale.stats?.max ?? 1)}`} title={value.toFixed(6)}></i>{/each}</div>
          <strong class="mono">[{rank.dispatchScale.shape.join(', ')}]</strong>
          <small class="mono">{(rank.dispatchScale.stats?.min ?? 0).toFixed(5)} → {(rank.dispatchScale.stats?.max ?? 0).toFixed(5)}</small>
        </article>

        <article class="moe-stage gmm1-stage" style={`--stage:${stageProgress(progress, 4, stages.length)}`}>
          <div class="visual-label"><span>{t('gmm1Swiglu')}</span><span class="mono">INT8</span></div>
          <div class="activation-block"><span>{#each Array(48) as _, index}<i style={`--v:${((index * 17 + selectedRank * 23) % 100) / 100}`}></i>{/each}</span></div>
          <strong class="mono">[{rank.gmm1Activation.shape.join(', ')}]</strong>
          <small class="mono">scale [{rank.gmm1Scale.shape.join(', ')}] · max {(rank.gmm1Scale.stats?.max ?? 0).toFixed(5)}</small>
        </article>

        <article class="moe-stage combine-stage" style={`--stage:${stageProgress(progress, 5, stages.length)}`}>
          <div class="visual-label"><span>{t('gmm2Combine')}</span><span class="fidelity real">{t('captured')}</span></div>
          <div class="combine-shapes"><span><small>GMM2</small><strong class="mono">[{rank.gmm2Output.shape.join(', ')}]</strong><em>BF16</em></span><IconArrowRight size={18} /><span><small>{t('combine')}</small><strong class="mono">[{rank.combinedOutput.shape.join(', ')}]</strong><em>BF16</em></span></div>
          <small>{t('weightedExpertsReturn')}</small>
        </article>
      </div>
      <p class="moe-method"><span class="fidelity real">{t('captured')}</span>{t('moeCapturedBoundary')}<span class="fidelity schematic">{t('schematic')}</span>{t('kernelInteriorNotDumped')}</p>
    </div>
  {/if}
</div>
