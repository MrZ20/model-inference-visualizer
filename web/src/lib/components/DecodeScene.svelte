<script lang="ts">
  import { IconArrowRight, IconRefresh } from '@tabler/icons-svelte';
  import type { TraceExperience } from '$lib/experience/scene-model';
  import type { Locale } from '$lib/playback/engine';
  import { createCatalog } from '$lib/i18n/catalog';

  export let decode: TraceExperience['decode'];
  export let progress = 0;
  export let locale: Locale = 'en';

  $: t = createCatalog(locale);
  $: completedSteps = Math.min(decode.steps.length, Math.floor(progress * decode.steps.length + .0001));
  // The token shown as selected was sampled from the same logits row. Keep the
  // chart on that completed decision instead of advancing it one step early.
  $: activeStepIndex = Math.max(0, Math.min(decode.steps.length - 1, completedSteps - 1));
  $: activeStep = decode.steps[activeStepIndex];
  $: revealLength = Math.round(decode.completion.length * completedSteps / decode.steps.length);
  $: visibleText = `${decode.prompt}${decode.completion.slice(0, revealLength)}`;
</script>

<div class="decode-scene" data-motion-progress={progress.toFixed(3)}>
  <div class="decode-machine">
    <article class="decode-logits">
      <div class="visual-label"><span>{t('logits')}</span><span class="fidelity real">{t('captured')}</span></div>
      <div class="candidate-chart">
        {#each activeStep.topCandidates as candidate, index}
          <div class:top={index === 0}><span class="mono">{candidate.tokenId}</span><i><b style={`--logit:${candidate.logit / Math.max(...activeStep.topCandidates.map((item) => item.logit))}`}></b></i><strong class="mono">{candidate.logit.toFixed(2)}</strong></div>
        {/each}
      </div>
      <small class="mono">[{activeStep.logitsShape.join(', ')}] · greedy</small>
    </article>

    <IconArrowRight class="decode-arrow" size={24} />

    <article class="decode-sample">
      <small>{t('selectedToken')}</small>
      <strong class="mono">{completedSteps === 0 ? '—' : decode.steps[Math.max(0, completedSteps - 1)].tokenId}</strong>
      <span>{completedSteps} / {decode.steps.length}</span>
    </article>

    <IconRefresh class="decode-loop-icon" size={30} />

    <article class="decode-cache">
      <div class="visual-label"><span>{t('kvCache')}</span><small>{t('reuseState')}</small></div>
      <div>{#each decode.steps as _, index}<i class:filled={index < completedSteps}><span>{index + 1}</span></i>{/each}</div>
    </article>
  </div>

  <div class="decode-output">
    <div class="output-heading"><span>{t('generatedText')}</span><span class="fidelity {completedSteps === decode.steps.length ? 'real' : 'schematic'}">{completedSteps === decode.steps.length ? t('exactOutput') : t('schematicReveal')}</span></div>
    <p>{visibleText}<i></i></p>
    <small>{completedSteps === decode.steps.length ? t('finalStringCaptured') : t('textRevealNote')}</small>
  </div>

  <div class="decode-steps" role="list" aria-label={t('decodeSteps')}>
    {#each decode.steps as step}
      <article role="listitem" class:active={step.index === activeStepIndex && progress > 0} class:complete={step.index < completedSteps}>
        <span>{t('step')} {step.index + 1}</span>
        <strong class="mono">{step.tokenId}</strong>
        <small class="mono">[{step.logitsShape.join(', ')}]</small>
        <i></i>
      </article>
    {/each}
  </div>
</div>
