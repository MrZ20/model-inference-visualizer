<script lang="ts">
  import { IconArrowRight, IconPlayerPlay, IconX } from '@tabler/icons-svelte';
  import type { TraceExperience } from '$lib/experience/scene-model';
  import { createCatalog } from '$lib/i18n/catalog';
  import type { Locale } from '$lib/playback/engine';
  import { stageProgress } from '$lib/projection/projector';

  export let attention: TraceExperience['linearAttention'];
  export let mode: 'overview' | 'focus' = 'overview';
  export let progress = 0;
  export let focused = false;
  export let focusProgress = 0;
  export let locale: Locale = 'en';
  export let onToggle: () => void;
  export let onSeek: (progress: number) => void;
  export let onPlay: () => void;

  const stages = [
    'capturedInput',
    'qkvzbaProjection',
    'causalConv1d',
    'gatedDeltaRule',
    'gatedNormProjection',
    'capturedOutput'
  ] as const;

  $: t = createCatalog(locale);
  $: hiddenSample = attention.hiddenStates.sample?.slice(0, 16) ?? [];
  $: outputSample = attention.output.sample?.slice(0, 16) ?? [];
  $: hiddenMaximum = Math.max(...hiddenSample.map((value) => Math.abs(value)), Number.EPSILON);
  $: outputMaximum = Math.max(...outputSample.map((value) => Math.abs(value)), Number.EPSILON);

  const format = (value: number | undefined) => typeof value === 'number' ? value.toPrecision(4) : '—';
</script>

{#if mode === 'overview'}
  <button class="linear-representative-card stage-panel" aria-label={t('expandLinearAttention')} aria-expanded={focused} on:click={onToggle}>
    <span class="visual-label"><span>{t('linearLayerTitle')}</span><span class="representative-fidelity"><span class="fidelity summary">{t('summary')}</span><span class="fidelity structural">{t('structural')}</span></span></span>
    <strong>{attention.module}</strong>
    <div class="boundary-flow">
      <span><small>{t('capturedInput')}</small><b class="mono">[{attention.hiddenShape.join(', ')}]</b></span>
      <IconArrowRight size={16} />
      <span><small>{t('sourceLevelPath')}</small><b>Conv1D → Δ state</b></span>
      <IconArrowRight size={16} />
      <span><small>{t('capturedOutput')}</small><b class="mono">[{attention.outputShape.join(', ')}]</b></span>
    </div>
    <span class="representative-action">{focused ? t('close') : t('expandLinearAttention')} <IconArrowRight size={15} /></span>
    <small>{t('linearAttentionEntryHint')}</small>
  </button>
{:else}
  <div class="linear-focus" data-detail="linear" role="region" aria-label={t('linearAttentionInternals')} style={`--focus:${focusProgress}`} data-motion-progress={progress.toFixed(3)}>
    <div class="focus-toolbar">
      <div>
        <span class="fidelity summary">{t('summary')}</span>
        <strong>{t('linearAttentionInternals')}</strong>
        <small>{t('linearAttentionFocusHint')}</small>
      </div>
      <div class="linear-provenance">
        <b>{attention.module}</b>
        <small class="mono">{t('rankBoundaryCapture')} · {attention.hiddenStates.device}</small>
      </div>
      <button class="close-focus" aria-label={t('close')} on:click={onToggle}><IconX size={18} /></button>
    </div>

    <div class="scene-stepper linear-stepper" aria-label={t('linearAttentionSequence')}>
      {#each stages as stage, index}
        <button class:active={stageProgress(progress, index, stages.length) > .15} on:click={() => onSeek((index + .25) / stages.length)}>
          <span>{String(index + 1).padStart(2, '0')}</span>{t(stage)}
        </button>
      {/each}
      <button class="play-sequence" on:click={onPlay}><IconPlayerPlay size={17} />{t('playSequence')}</button>
    </div>

    <div class="linear-pipeline-full">
      <article class="pipeline-panel boundary-panel" style={`--stage:${stageProgress(progress, 0, stages.length)}`}>
        <span class="visual-label"><span>{t('capturedInput')}</span><span class="fidelity summary">{t('summary')}</span></span>
        <strong class="mono">[{attention.hiddenShape.join(', ')}] · {attention.hiddenStates.dtype?.replace('torch.', '')}</strong>
        <div class="sample-bars" aria-label={`${t('capturedInput')} sample`}>
          {#each hiddenSample as value}<i style={`--height:${Math.abs(value) / hiddenMaximum}`} title={value.toString()}></i>{/each}
        </div>
        <dl class="tensor-stats">
          <div><dt>{t('minimum')}</dt><dd class="mono">{format(attention.hiddenStates.stats?.min)}</dd></div>
          <div><dt>{t('maximum')}</dt><dd class="mono">{format(attention.hiddenStates.stats?.max)}</dd></div>
          <div><dt>{t('mean')}</dt><dd class="mono">{format(attention.hiddenStates.stats?.mean)}</dd></div>
          <div><dt>{t('standardDeviation')}</dt><dd class="mono">{format(attention.hiddenStates.stats?.std)}</dd></div>
        </dl>
      </article>

      <IconArrowRight class="pipeline-arrow" size={20} />

      <article class="pipeline-panel projection-panel" style={`--stage:${stageProgress(progress, 1, stages.length)}`}>
        <span class="visual-label"><span>{t('qkvzbaProjection')}</span><span class="fidelity structural">{t('structural')}</span></span>
        <div class="projection-chips"><b>Q</b><b>K</b><b>V</b><b>Z</b><b>β</b><b>α</b></div>
        <p class="mono">in_proj_qkvz<br />in_proj_ba</p>
        <small>{t('sourceLevelPath')}</small>
      </article>

      <IconArrowRight class="pipeline-arrow" size={20} />

      <article class="pipeline-panel conv-panel" style={`--stage:${stageProgress(progress, 2, stages.length)}`}>
        <span class="visual-label"><span>{t('causalConv1d')}</span><span class="fidelity structural">{t('structural')}</span></span>
        <div class="position-chain" aria-label="Five causal positions">{#each Array(5) as _, index}<span class:active={stageProgress(progress, 2, stages.length) > index / 5}>{index}</span>{/each}</div>
        <p class="mono">npu_causal_conv1d_custom</p>
        <small>Q / K / V sequence transform</small>
      </article>

      <IconArrowRight class="pipeline-arrow" size={20} />

      <article class="pipeline-panel recurrent-panel" style={`--stage:${stageProgress(progress, 3, stages.length)}`}>
        <span class="visual-label"><span>{t('gatedDeltaRule')}</span><span class="fidelity structural">{t('structural')}</span></span>
        <div class="state-equation">
          <span class="mono">Q, K, V</span><IconArrowRight size={15} /><strong>Δ</strong><IconArrowRight size={15} /><span class="mono">{t('recurrentState')}</span>
        </div>
        <p class="mono">chunk_gated_delta_rule</p>
        <small>g, β · L2-normalized Q/K</small>
      </article>

      <IconArrowRight class="pipeline-arrow" size={20} />

      <article class="pipeline-panel norm-panel" style={`--stage:${stageProgress(progress, 4, stages.length)}`}>
        <span class="visual-label"><span>{t('gatedNormProjection')}</span><span class="fidelity structural">{t('structural')}</span></span>
        <div class="operator-stack"><span>gated RMSNorm</span><IconArrowRight size={15} /><span>out_proj</span></div>
        <p class="mono">core_attn_out × Z gate</p>
        <small>{t('sourceLevelPath')}</small>
      </article>

      <IconArrowRight class="pipeline-arrow" size={20} />

      <article class="pipeline-panel boundary-panel output-boundary" style={`--stage:${stageProgress(progress, 5, stages.length)}`}>
        <span class="visual-label"><span>{t('capturedOutput')}</span><span class="fidelity summary">{t('summary')}</span></span>
        <strong class="mono">[{attention.outputShape.join(', ')}] · {attention.output.dtype?.replace('torch.', '')}</strong>
        <div class="sample-bars output" aria-label={`${t('capturedOutput')} sample`}>
          {#each outputSample as value}<i style={`--height:${Math.abs(value) / outputMaximum}`} title={value.toString()}></i>{/each}
        </div>
        <dl class="tensor-stats">
          <div><dt>{t('minimum')}</dt><dd class="mono">{format(attention.output.stats?.min)}</dd></div>
          <div><dt>{t('maximum')}</dt><dd class="mono">{format(attention.output.stats?.max)}</dd></div>
          <div><dt>{t('mean')}</dt><dd class="mono">{format(attention.output.stats?.mean)}</dd></div>
          <div><dt>{t('standardDeviation')}</dt><dd class="mono">{format(attention.output.stats?.std)}</dd></div>
        </dl>
      </article>
    </div>

    <p class="linear-method"><span class="fidelity summary">{t('summary')}</span> {t('capturedInput')} / {t('capturedOutput')} <IconArrowRight size={14} /> <span class="fidelity structural">{t('structural')}</span> {t('sourceLevelPath')} <IconArrowRight size={14} /> <span class="fidelity schematic">{t('schematic')}</span> {t('boundaryOnly')}</p>
  </div>
{/if}

<style>
  .linear-representative-card { width: 100%; min-height: 178px; padding: .9rem; display: flex; flex-direction: column; gap: .6rem; border-color: #8bcad5; text-align: left; cursor: pointer; }
  .linear-representative-card:hover { border-color: var(--cyan); box-shadow: var(--shadow); }
  .linear-representative-card>strong { font-size: .64rem; }
  .linear-representative-card>small { color: var(--muted); font-size: .48rem; line-height: 1.35; }
  .representative-fidelity { display: flex; gap: .3rem; }
  .boundary-flow { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; align-items: center; gap: .25rem; }
  .boundary-flow span { min-width: 0; padding: .42rem; border: 1px solid var(--line); border-radius: 6px; background: var(--paper-2); }
  .boundary-flow small, .boundary-flow b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .boundary-flow small { color: var(--muted); font-size: .4rem; }.boundary-flow b { margin-top: .2rem; font-size: .43rem; }
  .representative-action { display: flex; align-items: center; gap: .35rem; color: var(--indigo-dark); font-size: .56rem; font-weight: 720; }
  .linear-focus { margin-top: 1rem; padding: 1.1rem; overflow-x: auto; border: 1px solid var(--cyan); border-radius: 16px; background: var(--paper); opacity: var(--focus); transform: translateY(calc((1 - var(--focus)) * 28px)) scale(calc(.985 + var(--focus) * .015)); transform-origin: top; }
  .linear-provenance { min-width: 260px; text-align: right; }.linear-provenance b, .linear-provenance small { display: block; }.linear-provenance b { font-size: .66rem; }.linear-provenance small { margin-top: .25rem; color: var(--muted); font-size: .47rem; }
  .linear-stepper { min-width: 980px; grid-template-columns: repeat(6, minmax(115px, 1fr)) auto; }
  .linear-pipeline-full { min-width: 1450px; display: grid; grid-template-columns: 245px 18px 185px 18px 190px 18px 225px 18px 190px 18px 245px; gap: .4rem; align-items: stretch; }
  .linear-pipeline-full article { min-height: 285px; display: flex; flex-direction: column; }
  .boundary-panel>strong { margin-top: .6rem; font-size: .5rem; }
  .sample-bars { height: 88px; margin: auto 0 .8rem; display: flex; align-items: center; gap: 3px; border-bottom: 1px solid var(--line); }
  .sample-bars i { flex: 1; height: calc(5px + var(--height) * 70px); border-radius: 2px 2px 0 0; background: var(--cyan); }
  .sample-bars.output i { background: var(--mint); }
  .tensor-stats { margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: .42rem; }
  .tensor-stats div { min-width: 0; padding-top: .38rem; border-top: 1px solid var(--line); }.tensor-stats dt { color: var(--muted); font-size: .4rem; }.tensor-stats dd { margin: .18rem 0 0; font-size: .43rem; }
  .projection-chips { margin: auto 0 .6rem; display: grid; grid-template-columns: repeat(3, 1fr); gap: .35rem; }
  .projection-chips b { min-height: 36px; display: grid; place-items: center; border: 1px solid #b7dfe6; border-radius: 7px; background: var(--cyan-soft); color: #26788a; font-size: .62rem; }
  .projection-panel p, .conv-panel p, .recurrent-panel p, .norm-panel p { margin: .55rem 0; color: var(--ink); font-size: .45rem; line-height: 1.5; }
  .projection-panel>small, .conv-panel>small, .recurrent-panel>small, .norm-panel>small { margin-top: auto; color: var(--muted); font-size: .43rem; line-height: 1.4; }
  .position-chain { margin: auto 0 .6rem; display: grid; grid-template-columns: repeat(5, 1fr); gap: .3rem; }
  .position-chain span { min-height: 38px; display: grid; place-items: center; border: 1px solid var(--line); border-radius: 6px; color: var(--muted); font: .48rem 'IBM Plex Mono', monospace; }
  .position-chain span.active { border-color: var(--cyan); background: var(--cyan-soft); color: #26788a; }
  .state-equation { margin: auto 0 .7rem; display: grid; grid-template-columns: 1fr auto 34px auto 1fr; align-items: center; gap: .3rem; text-align: center; }
  .state-equation span { padding: .5rem .3rem; border: 1px solid var(--line); border-radius: 6px; font-size: .42rem; }.state-equation strong { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; background: var(--cyan); color: white; }
  .operator-stack { margin: auto 0 .6rem; display: grid; gap: .45rem; justify-items: center; }
  .operator-stack span { width: 100%; padding: .65rem; border: 1px solid var(--line); border-radius: 7px; background: var(--paper-2); text-align: center; font-size: .49rem; }
  .linear-method { min-width: 1050px; display: flex; align-items: center; justify-content: center; gap: .5rem; margin: .9rem 0 0; color: var(--muted); font-size: .5rem; }
  @media (max-width: 900px) {
    .linear-provenance { display: none; }
    .linear-method { justify-content: flex-start; flex-wrap: wrap; }
  }
</style>
