<script lang="ts">
  import { IconActivity, IconCircleCheck, IconCpu, IconDatabase, IconStack2 } from '@tabler/icons-svelte';
  import type { TraceExperience } from '$lib/experience/scene-model';
  import type { Locale } from '$lib/playback/engine';
  import { createCatalog } from '$lib/i18n/catalog';
  import { stageProgress } from '$lib/projection/projector';

  export let initialization: TraceExperience['initialization'];
  export let layers: TraceExperience['layers'];
  export let progress = 0;
  export let locale: Locale = 'en';

  $: t = createCatalog(locale);
  const steps = ['config', 'layerSkeleton', 'quantization', 'checkpointShards', 'parameterMapping', 'kvCache', 'runtimeProbe', 'readyState'] as const;
</script>

<div class="initialization-scene" data-motion-progress={progress.toFixed(3)}>
  <ol class="init-timeline" aria-label={t('initializationSequence')}>
    {#each steps as step, index}
      <li class:active={stageProgress(progress, index, steps.length) > .2} class:complete={stageProgress(progress, index, steps.length) === 1}>
        <span>{String(index + 1).padStart(2, '0')}</span>
        <strong>{t(step)}</strong>
      </li>
    {/each}
  </ol>

  <div class="init-workspace">
    <article class="init-config stage-panel" style={`--stage:${stageProgress(progress, 0, steps.length)}`}>
      <div class="panel-title"><IconDatabase size={20} /><strong>{t('config')}</strong><span class="fidelity structural">{t('structural')}</span></div>
      <dl class="compact-facts">
        <div><dt>{t('hiddenSize')}</dt><dd class="mono">{initialization.model.hiddenSize}</dd></div>
        <div><dt>{t('vocabulary')}</dt><dd class="mono">{initialization.model.vocabSize}</dd></div>
        <div><dt>{t('attentionHeads')}</dt><dd class="mono">{initialization.model.queryHeads} Q / {initialization.model.kvHeads} KV</dd></div>
        <div><dt>{t('experts')}</dt><dd class="mono">{initialization.model.expertCount} · top-{initialization.model.expertsPerToken}</dd></div>
      </dl>
    </article>

    <article class="init-layers stage-panel" style={`--stage:${stageProgress(progress, 1, steps.length)}`}>
      <div class="panel-title"><IconStack2 size={20} /><strong>{t('layerSkeleton')}</strong><span class="mono">40</span></div>
      <div class="init-layer-grid" role="list" aria-label={`${t('initializationSequence')} · ${t('layersOverview')}`}>
        {#each layers as layer}
          <i role="listitem" class:full={layer.type === 'full_attention'} title={`Layer ${layer.index + 1} · ${layer.type}`}><span>{layer.index + 1}</span></i>
        {/each}
      </div>
      <small>30 × {t('linearAttention')} · 10 × {t('fullAttention')}</small>
    </article>

    <article class="init-quant stage-panel" style={`--stage:${stageProgress(progress, 2, steps.length)}`}>
      <div class="panel-title"><IconActivity size={20} /><strong>{t('quantization')}</strong><span class="fidelity real">{t('captured')}</span></div>
      <p class="quant-type">{initialization.quantization.type}</p>
      <div class="quant-counts"><span><b class="mono">{initialization.quantization.quantizedLeafCount.toLocaleString()}</b>{t('quantizedLeaves')}</span><span><b class="mono">{initialization.quantization.floatLeafCount.toLocaleString()}</b>{t('floatLeaves')}</span></div>
      <small>{t('notAllInt8')}</small>
    </article>

    <article class="init-shards stage-panel" style={`--stage:${stageProgress(progress, 3, steps.length)}`}>
      <div class="panel-title"><IconDatabase size={20} /><strong>{t('checkpointShards')}</strong><span class="mono">{(initialization.totalWeightBytes / 2 ** 30).toFixed(1)} GiB</span></div>
      <div class="checkpoint-stack" role="list">
        {#each initialization.weightShards as shard, index}
          <div role="listitem" style={`--shard-progress:${stageProgress(progress, index, initialization.weightShards.length)};--size:${shard.bytes / Math.max(...initialization.weightShards.map((item) => item.bytes))}`}>
            <span class="mono">{String(index + 1).padStart(2, '0')}</span>
            <i></i>
            <small class="mono">{(shard.bytes / 2 ** 30).toFixed(2)} GiB</small>
          </div>
        {/each}
      </div>
    </article>

    <article class="init-ranks stage-panel" style={`--stage:${stageProgress(progress, 4, steps.length)}`}>
      <div class="panel-title"><IconCpu size={20} /><strong>{t('parameterMapping')}</strong><span class="mono">TP=2</span></div>
      <div class="rank-load-grid">
        {#each initialization.ranks as rank}
          <div class="rank-load" class:rank-one={rank.rank === 1}>
            <span class="rank-chip">R{rank.rank}</span>
            <div><strong>{rank.device.toUpperCase()}</strong><small>{t('localShard')}</small></div>
            <b class="mono">{(rank.loadDurationMs / 1000).toFixed(2)} s</b>
          </div>
        {/each}
      </div>
      <div class="mapping-stream" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    </article>

    <article class="init-runtime stage-panel" style={`--stage:${stageProgress(progress, 5, steps.length)}`}>
      <div class="panel-title"><IconActivity size={20} /><strong>{t('runtimeState')}</strong><span class="fidelity real">{t('captured')}</span></div>
      <div class="runtime-rows">
        {#each initialization.ranks as rank}
          <div><span>R{rank.rank} · {t('kvCache')}</span><i><b style={`--fill:${stageProgress(progress, 5, steps.length)}`}></b></i><strong class="mono">{(rank.kvCacheDurationMs / 1000).toFixed(3)} s</strong></div>
        {/each}
        {#each initialization.ranks as rank}
          <div><span>R{rank.rank} · {t('runtimeProbe')}</span><i><b style={`--fill:${stageProgress(progress, 6, steps.length)}`}></b></i><strong class="mono">{rank.runtimeProbeDurationMs.toFixed(3)} ms</strong></div>
        {/each}
      </div>
      <p class="graph-note"><span class="fidelity schematic">{t('schematic')}</span>{t('graphBaselineNote')}</p>
    </article>

    <div class="ready-gate" class:active={stageProgress(progress, 7, steps.length) > .35}>
      <IconCircleCheck size={28} />
      <div><strong>{t('readyState')}</strong><span>{t('readyForPrompt')}</span></div>
      <span class="fidelity real">{t('captured')}</span>
    </div>
  </div>
</div>
