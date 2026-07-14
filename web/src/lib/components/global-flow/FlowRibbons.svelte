<script lang="ts">
  import {
    FLOW_PATH_IDS,
    type FlowGeometry,
    type FlowPathId
  } from '$lib/visualization/flow-geometry';
  import type {
    GlobalFlowFrame,
    GlobalFlowStageId
  } from '$lib/visualization/global-flow-model';

  export let geometry: FlowGeometry | null;
  export let frame: GlobalFlowFrame;

  const PATH_STAGE: Record<FlowPathId, GlobalFlowStageId> = {
    'weights-to-tokens': 'weights',
    'tokens-to-embedding': 'tokens',
    'embedding-to-transformer': 'embedding',
    'transformer-to-logits': 'transformer',
    'logits-to-completion': 'logits',
    'decode-loop': 'completion'
  };

  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const pathProgress = (pathId: FlowPathId) => {
    const stage = PATH_STAGE[pathId];
    const state = frame.stageState[stage];
    if (state === 'complete') return 1;
    if (state === 'pending') return 0;
    if (pathId === 'decode-loop') return frame.decodeLoopProgress;
    return clamp(frame.stageProgress[stage]);
  };
</script>

<svg
  data-flow-ribbons
  class="flow-ribbons"
  viewBox={`0 0 ${geometry?.width || 1} ${geometry?.height || 1}`}
  preserveAspectRatio="none"
  aria-hidden="true"
>
  <defs>
    <linearGradient id="flow-forward" x1="0" x2="1">
      <stop offset="0" stop-color="#5146ff" />
      <stop offset="0.5" stop-color="#21a6bd" />
      <stop offset="1" stop-color="#35b995" />
    </linearGradient>
    <linearGradient id="flow-return" x1="1" x2="0">
      <stop offset="0" stop-color="#35b995" />
      <stop offset="1" stop-color="#8d77ff" />
    </linearGradient>
  </defs>

  {#if geometry}
    {#each FLOW_PATH_IDS as pathId}
      {@const path = geometry.paths[pathId]}
      {@const progress = pathProgress(pathId)}
      <path
        data-flow-path={pathId}
        data-flow-layer="base"
        class="ribbon-base"
        class:ribbon-return-base={pathId === 'decode-loop'}
        d={path.d}
      />
      <path
        data-flow-path={pathId}
        data-flow-layer="live"
        data-flow-progress={progress.toFixed(3)}
        class:ribbon-live={pathId !== 'decode-loop'}
        class:ribbon-loop={pathId === 'decode-loop'}
        d={path.d}
        pathLength="1"
        style={`stroke-dasharray:1;stroke-dashoffset:${1 - progress}`}
      />
    {/each}
  {/if}
</svg>
