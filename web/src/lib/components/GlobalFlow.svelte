<script lang="ts">
  import {
    IconArrowRight,
    IconBinaryTree,
    IconBox,
    IconBrackets,
    IconChartBar,
    IconLayersSubtract,
    IconMessageCircle,
    IconStack2
  } from '@tabler/icons-svelte';
  import type { TraceExperience } from '$lib/experience/scene-model';
  import type { Locale, SceneId } from '$lib/playback/engine';
  import { createCatalog } from '$lib/i18n/catalog';
  import { stageProgress } from '$lib/projection/projector';

  export let experience: TraceExperience;
  export let progress = 0;
  export let locale: Locale = 'en';
  export let onNavigate: (scene: SceneId) => void;

  $: t = createCatalog(locale);
  const destination: SceneId[] = ['init', 'tokens', 'tokens', 'prefill', 'decode', 'decode'];
  const tokens = ['Hello', ',', 'my', 'name', 'is'];
</script>

<div class="global-flow" data-motion-progress={progress.toFixed(3)}>
  <div class="flow-track" aria-hidden="true">
    <i style={`--track-progress:${progress}`}></i>
  </div>

  <button class="flow-node weights" style={`--node-progress:${stageProgress(progress, 0, 6)}`} on:click={() => onNavigate(destination[0])}>
    <span class="node-kicker">01 · {t('loadWeights')}</span>
    <span class="node-icon"><IconBox size={30} stroke={1.6} /></span>
    <strong>{experience.initialization.weightShards.length} {t('checkpointShards')}</strong>
    <small>{(experience.initialization.totalWeightBytes / 2 ** 30).toFixed(1)} GiB · {experience.initialization.quantization.type}</small>
    <span class="shard-mini" aria-hidden="true">{#each experience.initialization.weightShards as _, i}<i style={`--i:${i}`}></i>{/each}</span>
  </button>
  <IconArrowRight class="flow-arrow" size={22} stroke={1.5} />

  <button class="flow-node token-node" style={`--node-progress:${stageProgress(progress, 1, 6)}`} on:click={() => onNavigate(destination[1])}>
    <span class="node-kicker">02 · {t('tokens')}</span>
    <span class="node-icon"><IconBrackets size={30} stroke={1.6} /></span>
    <strong>{experience.run.promptTokenIds.length} {t('promptTokens')}</strong>
    <span class="token-mini">{#each tokens as token}<i>{token}</i>{/each}</span>
    <small class="mono">[{experience.run.promptTokenIds.join(', ')}]</small>
  </button>
  <IconArrowRight class="flow-arrow" size={22} stroke={1.5} />

  <button class="flow-node embedding-node" style={`--node-progress:${stageProgress(progress, 2, 6)}`} on:click={() => onNavigate(destination[2])}>
    <span class="node-kicker">03 · {t('embedding')}</span>
    <span class="node-icon"><IconBinaryTree size={30} stroke={1.6} /></span>
    <strong class="mono">[5, 2048]</strong>
    <span class="matrix-mini" aria-hidden="true">{#each Array(40) as _, i}<i style={`--v:${((i * 37) % 100) / 100}`}></i>{/each}</span>
    <small>{t('capturedTensor')}</small>
  </button>
  <IconArrowRight class="flow-arrow" size={22} stroke={1.5} />

  <button class="flow-node layers-node" style={`--node-progress:${stageProgress(progress, 3, 6)}`} on:click={() => onNavigate(destination[3])}>
    <span class="node-kicker">04 · {t('transformerLayers')}</span>
    <span class="node-icon"><IconStack2 size={30} stroke={1.6} /></span>
    <strong>{experience.layers.length} {t('layers')}</strong>
    <span class="layers-mini" aria-hidden="true">{#each experience.layers as layer}<i class:full={layer.type === 'full_attention'}></i>{/each}</span>
    <small>30 {t('linearShort')} · 10 {t('fullShort')}</small>
  </button>
  <IconArrowRight class="flow-arrow" size={22} stroke={1.5} />

  <button class="flow-node logits-node" style={`--node-progress:${stageProgress(progress, 4, 6)}`} on:click={() => onNavigate(destination[4])}>
    <span class="node-kicker">05 · {t('logits')}</span>
    <span class="node-icon"><IconChartBar size={30} stroke={1.6} /></span>
    <strong class="mono">[1, 248320]</strong>
    <span class="bars-mini" aria-hidden="true">{#each Array(18) as _, i}<i class:top={i === 11} style={`--h:${20 + ((i * 43) % 76)}%`}></i>{/each}</span>
    <small>{t('greedySelection')}</small>
  </button>
  <IconArrowRight class="flow-arrow" size={22} stroke={1.5} />

  <button class="flow-node completion-node" style={`--node-progress:${stageProgress(progress, 5, 6)}`} on:click={() => onNavigate(destination[5])}>
    <span class="node-kicker">06 · {t('completion')}</span>
    <span class="node-icon"><IconMessageCircle size={30} stroke={1.6} /></span>
    <strong>“{experience.decode.completion.trim()}”</strong>
    <span class="completion-count"><IconLayersSubtract size={18} />{experience.decode.steps.length} {t('generatedTokens')}</span>
    <small>{t('exactOutput')}</small>
  </button>
</div>
