<script lang="ts">
  import { IconArrowRight, IconChevronLeft, IconChevronRight, IconPlayerPlay, IconX } from '@tabler/icons-svelte';
  import MatrixGrid from '$lib/components/MatrixGrid.svelte';
  import type { TraceExperience } from '$lib/experience/scene-model';
  import type { Locale } from '$lib/playback/engine';
  import { createCatalog } from '$lib/i18n/catalog';
  import { stageProgress } from '$lib/projection/projector';

  export let attention: TraceExperience['fullAttention'];
  export let promptTokenIds: number[];
  export let progress = 0;
  export let focused = false;
  export let focusProgress = 0;
  export let locale: Locale = 'en';
  export let onToggle: () => void;
  export let onSeek: (progress: number) => void;
  export let onPlay: () => void;

  let selectedHeadIndex = 0;
  const tokens = ['Hello', ',', 'my', 'name', 'is'];
  const stages = ['inputTokens', 'capturedQkv', 'attentionScores', 'scaleAndMask', 'softmax', 'weightedOutput'] as const;
  $: t = createCatalog(locale);
  $: selectedHead = attention.heads[selectedHeadIndex];
  $: comparison = attention.rankComparisons.find((item) => item.rank === selectedHead.rank) ?? attention.rankComparisons[0];
  $: activeRow = Math.min(4, Math.floor(progress * 5));

  function moveHead(direction: number) {
    selectedHeadIndex = (selectedHeadIndex + direction + attention.heads.length) % attention.heads.length;
  }
</script>

<div class:focused class="attention-scene" style={`--focus:${focusProgress};--attention-progress:${progress}`} data-motion-progress={progress.toFixed(3)}>
  <div class="attention-overview">
    <div class="token-rows" aria-label={t('inputTokens')}>
      <span class="visual-label">{t('inputTokens')}</span>
      {#each tokens as token, index}<div class:active={index === activeRow}><span class="mono">{index}</span><strong>{token}</strong></div>{/each}
    </div>
    <div class="overview-matrix">
      <div class="visual-label"><span>{t('meanAttention')}</span><span class="fidelity derived">{t('derived')}</span></div>
      <MatrixGrid matrix={attention.probabilityMatrix} labels={tokens} {activeRow} />
    </div>
    <button class="focus-entry" aria-label={t('expandAttention')} aria-expanded={focused} on:click={onToggle}>
      <span>{focused ? t('close') : t('expandAttention')}</span>
      <IconArrowRight size={18} />
      <small>{t('attentionEntryHint')}</small>
    </button>
  </div>

  {#if focused}
    <div class="attention-focus" data-detail="attention" role="region" aria-label={t('attentionInternals')}>
      <div class="focus-toolbar">
        <div>
          <span class="fidelity derived">{t('derived')}</span>
          <strong>{t('attentionInternals')}</strong>
          <small>{t('headSelectorHint')}</small>
        </div>
        <div class="head-selector">
          <button aria-label={t('previousHead')} on:click={() => moveHead(-1)}><IconChevronLeft size={18} /></button>
          <span><b>{t('head')} {selectedHead.displayHead + 1} / {attention.headCount}</b><small class="mono">Rank {selectedHead.rank} · local {selectedHead.localHead} · KV {selectedHead.kvHead}</small></span>
          <button aria-label={t('nextHead')} on:click={() => moveHead(1)}><IconChevronRight size={18} /></button>
        </div>
        <button class="close-focus" aria-label={t('close')} on:click={onToggle}><IconX size={18} /></button>
      </div>

      <div class="scene-stepper" aria-label={t('attentionSequence')}>
        {#each stages as stage, index}
          <button class:active={stageProgress(progress, index, stages.length) > .15} on:click={() => onSeek((index + .25) / stages.length)}>
            <span>{String(index + 1).padStart(2, '0')}</span>{t(stage)}
          </button>
        {/each}
        <button class="play-sequence" on:click={onPlay}><IconPlayerPlay size={17} />{t('playSequence')}</button>
      </div>

      <div class="attention-pipeline-full">
        <article class="token-source pipeline-panel" style={`--stage:${stageProgress(progress, 0, stages.length)}`}>
          <span class="visual-label">{t('inputTokens')}</span>
          {#each tokens as token, index}<div><span class="mono">{index}</span><strong>{token}</strong><small class="mono">{promptTokenIds[index]}</small></div>{/each}
        </article>

        <IconArrowRight class="pipeline-arrow" size={20} />

        <article class="qkv-source pipeline-panel" style={`--stage:${stageProgress(progress, 1, stages.length)}`}>
          <div class="visual-label"><span>{t('capturedQkv')}</span><span class="fidelity real">{t('captured')}</span></div>
          {#each [['Q', attention.queryShape, 'q'], ['K', attention.keyShape, 'k'], ['V', attention.valueShape, 'v']] as item}
            <div class="qkv-row {item[2]}">
              <strong>{item[0]}</strong>
              <span class="mini-vector" aria-hidden="true">{#each Array(12) as _, i}<i style={`--v:${((i * 41 + String(item[0]).charCodeAt(0)) % 100) / 100}`}></i>{/each}</span>
              <small class="mono">[{(item[1] as number[]).join(', ')}]</small>
            </div>
          {/each}
          <p class="mono">head size {attention.headSize} · scale {attention.scale}</p>
        </article>

        <IconArrowRight class="pipeline-arrow" size={20} />

        <article class="score-source pipeline-panel" style={`--stage:${stageProgress(progress, 2, stages.length)}`}>
          <div class="visual-label"><span>Q × Kᵀ</span><span class="fidelity derived">{t('derived')}</span></div>
          <MatrixGrid matrix={selectedHead.scores} labels={tokens} {activeRow} valueKind="score" />
          <small class="mono">[5, 5] · {t('attentionScores')}</small>
        </article>

        <IconArrowRight class="pipeline-arrow" size={20} />

        <article class="mask-source pipeline-panel" style={`--stage:${stageProgress(progress, 3, stages.length)}`}>
          <span class="visual-label">{t('scaleAndMask')}</span>
          <div class="mask-formula mono">scores × {attention.scale}<br />+ causal mask</div>
          <div class="mask-grid" aria-hidden="true">{#each Array(25) as _, i}<i class:blocked={(i % 5) > Math.floor(i / 5)}></i>{/each}</div>
          <small>{t('futureBlocked')}</small>
        </article>

        <IconArrowRight class="pipeline-arrow" size={20} />

        <article class="softmax-source pipeline-panel" style={`--stage:${stageProgress(progress, 4, stages.length)}`}>
          <div class="visual-label"><span>{t('softmax')}</span><span class="fidelity derived">{t('derived')}</span></div>
          <MatrixGrid matrix={selectedHead.probabilities} labels={tokens} {activeRow} accent="coral" />
          <small>{t('rowsSumOne')}</small>
        </article>

        <IconArrowRight class="pipeline-arrow" size={20} />

        <article class="output-source pipeline-panel" style={`--stage:${stageProgress(progress, 5, stages.length)}`}>
          <span class="visual-label">{t('weightedOutput')}</span>
          <div class="output-compare">
            <div><small>{t('derivedOutput')}</small><span>{#each comparison.derivedSample.slice(0, 16) as value}<i style={`--h:${Math.min(1, Math.abs(value) / 1.2)}`}></i>{/each}</span></div>
            <div><small>{t('fusedOutput')}</small><span>{#each comparison.fusedSample.slice(0, 16) as value}<i style={`--h:${Math.min(1, Math.abs(value) / 1.2)}`}></i>{/each}</span></div>
          </div>
          <div class="verification"><strong>{comparison.cosineSimilarity.toFixed(9)}</strong><span>{t('cosineSimilarity')}</span><small class="mono">max |Δ| {comparison.maxAbsError.toFixed(5)}</small></div>
        </article>
      </div>
      <p class="attention-method"><span class="fidelity real">{t('captured')}</span> Q / K / V <IconArrowRight size={14} /> <span class="fidelity derived">{t('derived')}</span> {t('verifiedAgainstFused')}</p>
    </div>
  {/if}
</div>
