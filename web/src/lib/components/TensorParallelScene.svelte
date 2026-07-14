<script lang="ts">
  import { IconArrowRight, IconArrowsJoin, IconPlayerPlay, IconX } from '@tabler/icons-svelte';
  import type { TraceExperience } from '$lib/experience/scene-model';
  import type { Locale } from '$lib/playback/engine';
  import { createCatalog } from '$lib/i18n/catalog';
  import { stageProgress } from '$lib/projection/projector';

  export let parallel: TraceExperience['tensorParallel'];
  export let progress = 0;
  export let focused = false;
  export let focusProgress = 0;
  export let locale: Locale = 'en';
  export let onToggle: () => void;
  export let onSeek: (progress: number) => void;
  export let onPlay: () => void;

  const stages = ['weightShard', 'localQkv', 'localAttention', 'localMoe', 'collective', 'localLogits', 'mergedResult'] as const;
  $: t = createCatalog(locale);
  const span = (rank: TraceExperience['tensorParallel']['ranks'][number], name: string) => rank.spans.find((item) => item.stage === name);
</script>

<div class:focused class="parallel-scene" style={`--focus:${focusProgress};--tp-progress:${progress}`} data-motion-progress={progress.toFixed(3)}>
  <div class="parallel-overview">
    {#each parallel.ranks as rank}
      <article class="rank-overview rank-{rank.rank}">
        <div><span class="rank-orb">R{rank.rank}</span><span><strong>{rank.device.toUpperCase()}</strong><small>{rank.queryHeads} Q heads · {rank.kvHeads} KV head</small></span></div>
        <div class="rank-shard-preview" aria-hidden="true">{#each Array(32) as _, index}<i style={`--v:${((index * 31 + rank.rank * 19) % 100) / 100}`}></i>{/each}</div>
        <p><span>{t('weightShard')}</span><b class="mono">[{rank.qkvWeightShape.join(', ')}]</b></p>
        <p><span>{t('localOutput')}</span><b class="mono">[{rank.qkvOutputShape.join(', ')}]</b></p>
      </article>
    {/each}
    <div class="overview-collective"><span>R0</span><i></i><IconArrowsJoin size={26} /><i></i><span>R1</span><strong>{t('collective')}</strong></div>
    <button class="focus-entry" aria-label={t('expandTp')} aria-expanded={focused} on:click={onToggle}>
      <span>{focused ? t('close') : t('expandTp')}</span><IconArrowRight size={18} /><small>{t('tpEntryHint')}</small>
    </button>
  </div>

  {#if focused}
    <div class="parallel-focus" data-detail="tp" role="region" aria-label={t('tpInternals')}>
      <div class="focus-toolbar">
        <div><span class="fidelity real">{t('captured')}</span><strong>{t('tpInternals')}</strong><small>{t('tpFocusHint')}</small></div>
        <button class="close-focus" aria-label={t('close')} on:click={onToggle}><IconX size={18} /></button>
      </div>

      <div class="scene-stepper" aria-label={t('tpSequence')}>
        {#each stages as stage, index}<button class:active={stageProgress(progress, index, stages.length) > .15} on:click={() => onSeek((index + .25) / stages.length)}><span>{String(index + 1).padStart(2, '0')}</span>{t(stage)}</button>{/each}
        <button class="play-sequence" on:click={onPlay}><IconPlayerPlay size={17} />{t('playSequence')}</button>
      </div>

      <div class="tp-lanes">
        <div class="lane-label-spacer"></div>
        {#each stages as stage}<span class="lane-column-label">{t(stage)}</span>{/each}
        {#each parallel.ranks as rank}
          <div class="lane-rank-label rank-{rank.rank}"><span class="rank-orb">R{rank.rank}</span><div><strong>{rank.device.toUpperCase()}</strong><small>{rank.queryHeads} Q / {rank.kvHeads} KV</small></div></div>

          <article class="lane-stage shard" style={`--stage:${stageProgress(progress, 0, stages.length)}`}>
            <div class="weight-matrix-small">{#each Array(30) as _, index}<i style={`--v:${((index * 23 + rank.rank * 41) % 100) / 100}`}></i>{/each}</div>
            <strong class="mono">[{rank.qkvWeightShape.join(', ')}]</strong><small>INT8 · 50%</small>
          </article>

          <article class="lane-stage qkv" style={`--stage:${stageProgress(progress, 1, stages.length)}`}>
            <div class="qkv-heads"><i class="q"></i><i class="q"></i><i class="k"></i><i class="v"></i></div>
            <strong class="mono">[{rank.qkvOutputShape.join(', ')}]</strong><small>{(span(rank, 'layer3.qkv_projection')?.durationMs ?? 0).toFixed(3)} ms</small>
          </article>

          <article class="lane-stage attention" style={`--stage:${stageProgress(progress, 2, stages.length)}`}>
            <div class="attention-pulse">{#each Array(8) as _, index}<i style={`--delay:${index * .08}s`}></i>{/each}</div>
            <strong class="mono">[{(span(rank, 'layer3.fused_attention')?.outputShape ?? []).join(', ')}]</strong><small>{(span(rank, 'layer3.fused_attention')?.durationMs ?? 0).toFixed(3)} ms</small>
          </article>

          <article class="lane-stage moe" style={`--stage:${stageProgress(progress, 3, stages.length)}`}>
            <div class="local-experts">{#each Array(16) as _, index}<i class:active={index < 8}></i>{/each}</div>
            <strong class="mono">[{(span(rank, 'layer3.moe_experts')?.outputShape ?? []).join(', ')}]</strong><small>{(span(rank, 'layer3.moe_experts')?.durationMs ?? 0).toFixed(3)} ms</small>
          </article>

          <article class="lane-stage collective-stage" style={`--stage:${stageProgress(progress, 4, stages.length)}`}>
            <IconArrowsJoin size={28} /><strong>ALL-REDUCE</strong><small>{t('syncRanks')}</small>
          </article>

          <article class="lane-stage logits" style={`--stage:${stageProgress(progress, 5, stages.length)}`}>
            <div class="logit-mini-bars">{#each Array(18) as _, index}<i class:top={index === 12} style={`--h:${20 + ((index * 37 + rank.rank * 11) % 80)}%`}></i>{/each}</div>
            <strong class="mono">[{rank.localLogitsShape.join(', ')}]</strong><small>{t('capturedRankOutput')}</small>
          </article>

          <article class="lane-stage merge-stage" style={`--stage:${stageProgress(progress, 6, stages.length)}`}>
            <span class="merge-packet rank-{rank.rank}">R{rank.rank}</span><IconArrowRight size={18} /><strong>{t('merge')}</strong><small class="mono">[1, 248320]</small>
          </article>
        {/each}
        <div class="tp-merge-line" aria-hidden="true"><i></i><span>+</span><i></i></div>
      </div>
      <p class="tp-method"><span class="fidelity real">{t('captured')}</span>{t('tpCapturedSpans')}<span class="fidelity schematic">{t('schematic')}</span>{t('collectiveTeachingMotion')} · EP=false</p>
    </div>
  {/if}
</div>
