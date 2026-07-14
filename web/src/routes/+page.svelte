<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { replaceState } from '$app/navigation';
  import {
    IconArrowRight,
    IconChevronLeft,
    IconChevronRight,
    IconDatabase,
    IconInfoCircle,
    IconLanguage,
    IconPlayerPause,
    IconPlayerPlay,
    IconRefresh,
    IconX
  } from '@tabler/icons-svelte';
  import AttentionScene from '$lib/components/AttentionScene.svelte';
  import DecodeScene from '$lib/components/DecodeScene.svelte';
  import GlobalFlow from '$lib/components/GlobalFlow.svelte';
  import InitializationScene from '$lib/components/InitializationScene.svelte';
  import LinearAttentionScene from '$lib/components/LinearAttentionScene.svelte';
  import MoeScene from '$lib/components/MoeScene.svelte';
  import TensorParallelScene from '$lib/components/TensorParallelScene.svelte';
  import { StaticTraceRepository } from '$lib/trace/repository';
  import {
    CHAPTERS,
    createPlaybackEngine,
    type DetailId,
    type Locale,
    type PlaybackSnapshot,
    type RunMode,
    type SceneId,
    type StartOrigin
  } from '$lib/playback/engine';
  import { createCatalog, type MessageKey } from '$lib/i18n/catalog';
  import { buildTraceExperience, type TraceEvent, type TraceExperience } from '$lib/experience/scene-model';
  import { stageProgress } from '$lib/projection/projector';

  const RUN_ID = 'qwen35-a3b-w8a8-20260710-p4r4';
  const engine = createPlaybackEngine();
  let playback: PlaybackSnapshot;
  const unsubscribe = engine.state.subscribe((value) => playback = value);
  let loading = true;
  let error = '';
  let evidenceOpen = false;
  let playbackOptionsOpen = false;
  let startOrigin: StartOrigin = 'beginning';
  let runMode: RunMode = 'continuous';
  let evidenceTrigger: HTMLButtonElement;
  let evidenceCloseButton: HTMLButtonElement;
  let experience: TraceExperience | null = null;
  let observer: IntersectionObserver;
  let navigationTimer: number | undefined;
  let programmaticNavigation = false;
  let followPlaybackCamera = true;
  let mounted = false;
  let lastAutoChapter: SceneId | undefined;
  let speedControl = 1;
  let t = createCatalog('en');

  $: if (playback) {
    t = createCatalog(playback.locale);
    speedControl = playback.speed;
  }
  $: focusScene = playback?.focus?.scene;
  $: focusProgress = playback?.focus?.progress ?? 0;
  $: activeLayer = Math.min(39, Math.floor(sceneProgress('prefill') * 40));

  async function loadTrace() {
    loading = true;
    error = '';
    try {
      const session = await new StaticTraceRepository().open(RUN_ID);
      const [initEvents, prefillEvents, decodeEvents, validation, attention, parallel, moeQuantization] = await Promise.all([
        session.chapter<TraceEvent[]>('init'),
        session.chapter<TraceEvent[]>('prefill'),
        session.chapter<TraceEvent[]>('decode'),
        session.artifact<Record<string, any>>('qwen-validation-report.json'),
        session.artifact<Record<string, any>>('attention-derived.json'),
        session.artifact<Record<string, any>>('parallel-summary.json'),
        session.artifact<Record<string, any>>('moe-quantization.json')
      ]);
      experience = buildTraceExperience({
        initEvents,
        prefillEvents,
        decodeEvents,
        validation,
        attention,
        parallel,
        moeQuantization,
        eventCount: session.manifest.eventCount
      });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    } finally {
      loading = false;
    }
  }

  let sceneProgress: (scene: SceneId) => number;
  $: sceneProgress = (scene: SceneId) => {
    if (!playback) return 0;
    return playback.progressByChapter[scene];
  };

  let sceneState: (scene: SceneId) => 'playing' | 'active' | 'complete' | 'pending';
  $: sceneState = (scene: SceneId) => {
    if (!playback) return 'pending';
    if (playback.chapter === scene) return playback.transport === 'playing' ? 'playing' : 'active';
    if (playback.progressByChapter[scene] >= 1) return 'complete';
    return playback.viewChapter === scene ? 'active' : 'pending';
  };

  function navigateToChapter(chapter: SceneId) {
    const target = document.getElementById(chapter);
    if (!target) return;
    programmaticNavigation = true;
    target.scrollIntoView({ block: 'start', behavior: playback.motion === 'reduced' ? 'auto' : 'smooth' });
    if (navigationTimer) window.clearTimeout(navigationTimer);
    navigationTimer = window.setTimeout(() => programmaticNavigation = false, playback.motion === 'reduced' ? 0 : 900);
  }

  function browse(type: 'NEXT' | 'PREVIOUS') {
    takeCameraControl();
    engine.dispatch({ type });
    requestAnimationFrame(() => navigateToChapter(playback.viewChapter));
  }

  function followPlaybackView() {
    followPlaybackCamera = true;
    if (playback.transport === 'playing') lastAutoChapter = playback.chapter;
    requestAnimationFrame(() => navigateToChapter(playback.viewChapter));
  }

  function executePlayback() {
    playbackOptionsOpen = false;
    if (playback.transport === 'playing') {
      engine.dispatch({ type: 'PAUSE' });
      return;
    }
    engine.dispatch({ type: 'START', origin: startOrigin, mode: runMode });
    followPlaybackView();
  }

  function playActiveScene(scene: SceneId) {
    const progress = playback.progressByChapter[scene];
    engine.dispatch({ type: 'SEEK_SCENE', scene, progress: progress >= 1 ? 0 : progress });
    engine.dispatch({ type: 'START', origin: 'step', mode: 'continuous' });
    followPlaybackView();
  }

  function setViewChapter(chapter: SceneId) {
    takeCameraControl();
    engine.dispatch({ type: 'SET_VIEW_CHAPTER', chapter });
    navigateToChapter(chapter);
  }

  function startTrace() {
    startOrigin = 'beginning';
    runMode = 'continuous';
    engine.dispatch({ type: 'START', origin: 'beginning', mode: 'continuous' });
    followPlaybackView();
  }

  function openDetail(scene: DetailId) {
    const activeFocus = playback.focus;
    if (activeFocus?.scene === scene && activeFocus.phase !== 'closing') {
      engine.dispatch({ type: 'CLOSE_DETAIL' });
      return;
    }
    const chapter: SceneId = scene === 'linear' ? 'prefill' : scene;
    engine.dispatch({ type: 'SEEK_SCENE', scene: chapter, progress: playback.progressByChapter[chapter] });
    engine.dispatch({ type: 'PAUSE' });
    engine.dispatch({ type: 'OPEN_DETAIL', scene });
    window.setTimeout(() => {
      programmaticNavigation = true;
      document.querySelector<HTMLElement>(`[data-detail="${scene}"]`)?.scrollIntoView?.({
        block: 'center',
        behavior: playback.motion === 'reduced' ? 'auto' : 'smooth'
      });
      if (navigationTimer) window.clearTimeout(navigationTimer);
      navigationTimer = window.setTimeout(() => programmaticNavigation = false, playback.motion === 'reduced' ? 0 : 900);
    }, playback.motion === 'reduced' ? 0 : 460);
  }

  function seekScene(scene: SceneId, progress: number) {
    engine.dispatch({ type: 'SEEK_SCENE', scene, progress });
  }

  function setLocale(locale: Locale, syncUrl = true) {
    engine.dispatch({ type: 'SET_LOCALE', locale });
    localStorage.setItem('inference-locale', locale);
    if (syncUrl) {
      const url = new URL(location.href);
      url.searchParams.set('lang', locale);
      replaceState(url, {});
    }
  }

  function updateSpeed() {
    engine.dispatch({ type: 'SET_SPEED', speed: Number(speedControl) });
  }

  async function openEvidence() {
    evidenceOpen = true;
    await tick();
    evidenceCloseButton?.focus();
  }

  async function closeEvidence() {
    if (!evidenceOpen) return;
    evidenceOpen = false;
    await tick();
    evidenceTrigger?.focus();
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      playbackOptionsOpen = false;
      void closeEvidence();
      engine.dispatch({ type: 'CLOSE_DETAIL' });
      return;
    }
    if ((event.target as HTMLElement)?.matches('select, input, textarea, button')) return;
    if (event.code === 'Space') {
      event.preventDefault();
      executePlayback();
    }
    if (event.key === 'ArrowRight') browse('NEXT');
    if (event.key === 'ArrowLeft') browse('PREVIOUS');
  }

  function takeCameraControl() {
    followPlaybackCamera = false;
    programmaticNavigation = false;
    if (navigationTimer) window.clearTimeout(navigationTimer);
  }

  function onManualNavigation() {
    takeCameraControl();
  }

  function onScrollNavigation() {
    if (!programmaticNavigation) onManualNavigation();
  }

  function observeChapters() {
    document.querySelectorAll<HTMLElement>('[data-chapter]').forEach((section) => observer.observe(section));
  }

  $: if (mounted && playback?.transport === 'playing' && followPlaybackCamera && playback.chapter !== lastAutoChapter) {
    lastAutoChapter = playback.chapter;
    engine.dispatch({ type: 'SET_VIEW_CHAPTER', chapter: playback.chapter });
    requestAnimationFrame(() => navigateToChapter(playback.chapter));
  }

  onMount(() => {
    mounted = true;
    const query = new URL(location.href).searchParams.get('lang');
    const saved = localStorage.getItem('inference-locale');
    const requestedLocale =
      query === 'zh-CN' || query === 'zh'
        ? 'zh-CN'
        : query === 'en'
          ? 'en'
          : saved === 'zh-CN' || saved === 'zh'
            ? 'zh-CN'
            : 'en';
    setLocale(requestedLocale, false);
    engine.dispatch({ type: 'SET_MOTION', motion: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full' });
    observer = new IntersectionObserver((entries) => {
      if (programmaticNavigation || (playback.transport === 'playing' && followPlaybackCamera)) return;
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const id = visible?.target.id as SceneId;
      if (id && CHAPTERS.includes(id) && id !== playback.viewChapter) engine.dispatch({ type: 'SET_VIEW_CHAPTER', chapter: id });
    }, { threshold: [.25, .5, .72] });
    void loadTrace().then(tick).then(observeChapters);
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('wheel', onManualNavigation, { passive: true });
    window.addEventListener('touchstart', onManualNavigation, { passive: true });
    window.addEventListener('scroll', onScrollNavigation, { passive: true });
    return () => {
      mounted = false;
      observer?.disconnect();
      if (navigationTimer) window.clearTimeout(navigationTimer);
      window.removeEventListener('keydown', onKeydown);
      window.removeEventListener('wheel', onManualNavigation);
      window.removeEventListener('touchstart', onManualNavigation);
      window.removeEventListener('scroll', onScrollNavigation);
      unsubscribe();
      engine.destroy();
    };
  });

  const chapterLabel = (scene: SceneId): MessageKey => scene;
</script>

<svelte:head>
  <title>{t('title')}</title>
  <meta name="description" content={t('subtitle')} />
</svelte:head>

<header class="topbar">
  <button class="brand" aria-label={`${t('title')} · ${t('overview')}`} on:click={() => setViewChapter('overview')}>
    <span class="brand-mark">Q</span>
    <span><strong>{t('title')}</strong><small>{t('subtitle')}</small></span>
  </button>

  <label class="prompt-control">
    <span>{t('recordedPrompt')}</span>
    <input value={experience?.run.prompt ?? 'Hello, my name is'} readonly />
  </label>

  <div class="transport" aria-label={t('playbackControls')}>
    <button aria-label={t('previous')} title={t('previous')} on:click={() => browse('PREVIOUS')}><IconChevronLeft size={18} /></button>
    <div class="play-choice">
      <button class="primary-play" aria-label={playback?.transport === 'playing' ? t('pause') : runMode === 'single' ? t('runOneStep') : t('play')} on:click={executePlayback}>
        {#if playback?.transport === 'playing'}<IconPlayerPause size={18} />{:else}<IconPlayerPlay size={18} />{/if}
        <span>{playback?.transport === 'playing' ? t('pause') : runMode === 'single' ? t('runOneStep') : t('play')}</span>
      </button>
      <button class="play-options-toggle" aria-label={t('playbackOptions')} aria-expanded={playbackOptionsOpen} aria-controls="playback-options" on:click={() => playbackOptionsOpen = !playbackOptionsOpen}><span>•••</span></button>
      {#if playbackOptionsOpen}
        <div id="playback-options" class="playback-options" role="dialog" aria-label={t('playbackOptions')}>
          <fieldset aria-label={t('startPosition')}>
            <legend>{t('startPosition')}</legend>
            <label><input type="radio" aria-label={t('fromBeginning')} bind:group={startOrigin} value="beginning" /><span><strong>{t('fromBeginning')}</strong><small>{t('fromBeginningHint')}</small></span></label>
            <label><input type="radio" aria-label={t('fromCurrentPage')} bind:group={startOrigin} value="page" /><span><strong>{t('fromCurrentPage')}</strong><small>{t('fromCurrentPageHint')}</small></span></label>
            <label><input type="radio" aria-label={t('fromCurrentStep')} bind:group={startOrigin} value="step" /><span><strong>{t('fromCurrentStep')}</strong><small>{t('fromCurrentStepHint')}</small></span></label>
          </fieldset>
          <fieldset class="mode-options" aria-label={t('runMode')}>
            <legend>{t('runMode')}</legend>
            <label><input type="radio" aria-label={t('continuous')} bind:group={runMode} value="continuous" /><span>{t('continuous')}</span></label>
            <label><input type="radio" aria-label={t('singleStep')} bind:group={runMode} value="single" /><span>{t('singleStep')}</span></label>
          </fieldset>
        </div>
      {/if}
    </div>
    <button aria-label={t('next')} title={t('next')} on:click={() => browse('NEXT')}><IconChevronRight size={18} /></button>
  </div>

  <div class="scene-status">
    <span>{t('viewing')}</span>
    <strong>{t(chapterLabel(playback?.viewChapter ?? 'overview'))}</strong>
    <small class="mono">{t('inferenceCursor')}: {t(chapterLabel(playback?.chapter ?? 'overview'))} · {Math.round((playback?.progress ?? 0) * 100)}%</small>
  </div>

  <div class="model-status"><strong>35B · W8A8 · TP=2</strong><small class="mono">{RUN_ID}</small></div>

  <div class="top-actions">
    <label class="speed-control"><span>{t('playbackSpeed')}</span><select bind:value={speedControl} on:change={updateSpeed}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select></label>
    <button class="icon-button language" on:click={() => setLocale(playback.locale === 'en' ? 'zh-CN' : 'en')}><IconLanguage size={18} /><span>{t('language')}</span></button>
    <button bind:this={evidenceTrigger} class="icon-button" aria-label={t('evidence')} title={t('evidence')} aria-expanded={evidenceOpen} aria-controls="trace-evidence-drawer" on:click={openEvidence}><IconDatabase size={19} /></button>
  </div>
  <div class="progress-line"><i style={`width:${((playback?.chapterIndex ?? 0) + (playback?.progress ?? 0)) / CHAPTERS.length * 100}%`}></i></div>
</header>

<nav class="chapter-rail" aria-label={t('traceChapters')}>
  {#each CHAPTERS as chapter, index}
    <button class:active={playback?.viewChapter === chapter} class:cursor={playback?.chapter === chapter} class:complete={(playback?.progressByChapter[chapter] ?? 0) >= 1} aria-label={`${index + 1}. ${t(chapterLabel(chapter))}`} on:click={() => setViewChapter(chapter)}>
      <span>{index + 1}</span><strong>{t(chapterLabel(chapter))}</strong>
    </button>
  {/each}
</nav>

{#if loading}
  <div class="loading"><span></span><p class="mono">{t('loading')}</p></div>
{:else if error}
  <div class="loading error"><IconInfoCircle size={34} /><h1>{t('error')}</h1><p class="mono">{error}</p><button class="action-button" on:click={loadTrace}><IconRefresh size={17} />{t('retry')}</button></div>
{:else if experience}
  <main data-transport={playback.transport}>
    <section id="overview" data-chapter data-scene-state={sceneState('overview')} class="trace-section overview-section" style={`--scene-progress:${sceneProgress('overview')}`}>
      <div class="visual-shell overview-shell">
        <div class="overview-copy">
          <div class="hero-badges"><span class="fidelity real">{t('captured')}</span><span class="fidelity derived">{t('derived')}</span><span class="mono run-id">{experience.run.eventCount.toLocaleString()} events</span></div>
          <p class="kicker">{t('heroKicker')}</p>
          <h1>{t('heroTitle')}</h1>
          <p class="lede">{t('heroBody')}</p>
          <button class="action-button hero-play" aria-label={`${t('startTrace')}: ${t('init')}`} on:click={startTrace}><IconPlayerPlay size={18} />{t('startTrace')}</button>
        </div>
        <div class="flow-intro"><h2>{t('globalFlowTitle')}</h2><p>{t('globalFlowBody')}</p></div>
        <GlobalFlow
          {experience}
          progress={sceneProgress('overview')}
          locale={playback.locale}
          motion={playback.motion}
          onNavigate={setViewChapter}
        />
        <div class="overview-evidence">
          <span><small>{t('prompt')}</small><strong class="mono">{experience.run.prompt}</strong></span>
          <span><small>{t('model')}</small><strong>Qwen3.5-35B-A3B · W8A8</strong></span>
          <span><small>{t('execution')}</small><strong>2 × Ascend NPU · TP=2 · EP=false</strong></span>
          <span><small>{t('output')}</small><strong class="mono">{experience.decode.completion.trim()}</strong></span>
        </div>
      </div>
    </section>

    <section id="init" data-chapter data-scene-state={sceneState('init')} class="trace-section init-section" style={`--scene-progress:${sceneProgress('init')}`}>
      <div class="visual-shell scene-sticky">
        {@render SectionHeading(t('initKicker'), t('initTitle'), t('initBody'), [t('captured'), `${experience.initialization.weightShards.length} shards`, 'TP=2'])}
        <InitializationScene initialization={experience.initialization} layers={experience.layers} progress={sceneProgress('init')} locale={playback.locale} />
      </div>
    </section>

    <section id="tokens" data-chapter data-scene-state={sceneState('tokens')} class="trace-section token-section" style={`--scene-progress:${sceneProgress('tokens')}`}>
      <div class="visual-shell scene-sticky">
        {@render SectionHeading(t('tokenKicker'), t('tokenTitle'), t('tokenBody'), [t('captured'), '[5, 2048]', 'BF16'])}
        <div class="token-story" data-motion-progress={sceneProgress('tokens').toFixed(3)}>
          <article class="prompt-stage stage-panel">
            <span class="visual-label">{t('prompt')}</span>
            <p>{#each experience.run.promptPieces as piece, index}<span style={`--token:${stageProgress(sceneProgress('tokens'), index, experience.run.promptPieces.length)}`}>{piece}</span>{/each}</p>
            <small class="mono">“{experience.run.prompt}”</small>
          </article>
          <IconArrowRight class="story-arrow" size={24} />
          <article class="ids-stage stage-panel">
            <span class="visual-label">{t('tokenIds')}</span>
            <div>{#each experience.run.promptTokenIds as id, index}<span class="mono" style={`--token:${stageProgress(sceneProgress('tokens'), index + 1, 7)}`}>{id}</span>{/each}</div>
            <small class="mono">{t('scheduler')}</small>
          </article>
          <IconArrowRight class="story-arrow" size={24} />
          <article class="embedding-stage stage-panel">
            <div class="visual-label"><span>{t('embeddingMatrix')}</span><span class="fidelity real">{t('captured')}</span></div>
            <div class="embedding-rows">{#each experience.run.promptPieces as piece, row}<div><strong>{piece}</strong><span>{#each Array(16) as _, column}<i style={`--cell:${stageProgress(sceneProgress('tokens'), row * 16 + column, 80)};--v:${((row * 19 + column * 37) % 100) / 100}`}></i>{/each}</span></div>{/each}</div>
            <strong class="mono shape-caption">[5, 2048] · bfloat16</strong>
          </article>
        </div>
      </div>
    </section>

    <section id="prefill" data-chapter data-scene-state={sceneState('prefill')} class:focused={focusScene === 'linear'} class="trace-section prefill-section" style={`--scene-progress:${sceneProgress('prefill')}`}>
      <div class="visual-shell scene-sticky">
        {@render SectionHeading(t('prefillKicker'), t('prefillTitle'), t('prefillBody'), [t('structural'), '30 linear', '10 full'])}
        <div class="prefill-story" data-motion-progress={sceneProgress('prefill').toFixed(3)}>
          <div class="prefill-input stage-panel">
            <span class="visual-label">{t('hidden')}</span><strong class="mono">[{experience.linearAttention.hiddenShape.join(', ')}]</strong>
            <div>{#each Array(5) as _, row}<span>{#each Array(12) as _, column}<i style={`--v:${((row * 17 + column * 31) % 100) / 100}`}></i>{/each}</span>{/each}</div>
          </div>
          <IconArrowRight class="story-arrow" size={24} />
          <div class="layer-stack-stage stage-panel">
            <div class="visual-label"><span>{t('layerStack')}</span><span class="mono">Layer {activeLayer + 1} / 40</span></div>
            <div class="layer-ribbon" role="list" aria-label={t('layersOverview')}>
              {#each experience.layers as layer}
                <span role="listitem"><button class:full={layer.type === 'full_attention'} class:active={layer.index === activeLayer} class:complete={layer.index < activeLayer} title={`Layer ${layer.index + 1}: ${layer.type}`} on:click={() => seekScene('prefill', (layer.index + .35) / 40)}><span>{layer.index + 1}</span></button></span>
              {/each}
            </div>
            <div class="layer-legend"><span><i class="linear"></i>30 × {t('linearAttention')}</span><span><i class="full"></i>10 × {t('fullAttention')}</span></div>
          </div>
          <IconArrowRight class="story-arrow" size={24} />
          <div class="representative-stack">
            <LinearAttentionScene attention={experience.linearAttention} mode="overview" progress={sceneProgress('prefill')} focused={focusScene === 'linear'} {focusProgress} locale={playback.locale} onToggle={() => openDetail('linear')} onSeek={(progress) => seekScene('prefill', progress)} onPlay={() => playActiveScene('prefill')} />
            <button class="layer-detail-stage stage-panel" aria-label={t('openFullAttention')} on:click={() => openDetail('attention')}>
              <span class="visual-label">Layer 3 · {t('fullAttention')} <span class="fidelity real">{t('captured')}</span></span>
              <div class="operator-flow"><span>{t('norm')}</span><IconArrowRight size={16} /><span>{t('qkv')}</span><IconArrowRight size={16} /><span>Q K V</span></div>
              <dl><div><dt>Q</dt><dd class="mono">[{experience.fullAttention.queryShape.join(', ')}]</dd></div><div><dt>K / V</dt><dd class="mono">[{experience.fullAttention.keyShape.join(', ')}]</dd></div></dl>
              <small>{t('expandAttention')} <IconArrowRight size={15} /></small>
            </button>
          </div>
        </div>
        {#if focusScene === 'linear'}
          <LinearAttentionScene attention={experience.linearAttention} mode="focus" progress={sceneProgress('prefill')} focused {focusProgress} locale={playback.locale} onToggle={() => openDetail('linear')} onSeek={(progress) => seekScene('prefill', progress)} onPlay={() => playActiveScene('prefill')} />
        {/if}
      </div>
    </section>

    <section id="attention" data-chapter data-scene-state={sceneState('attention')} class:focused={focusScene === 'attention'} class="trace-section attention-section" style={`--scene-progress:${sceneProgress('attention')}`}>
      <div class="visual-shell scene-sticky">
        {@render SectionHeading(t('attentionKicker'), t('attentionTitle'), t('attentionBody'), [t('captured'), t('derived'), 'Layer 3'])}
        <AttentionScene attention={experience.fullAttention} promptTokenIds={experience.run.promptTokenIds} progress={sceneProgress('attention')} focused={focusScene === 'attention'} {focusProgress} locale={playback.locale} onToggle={() => openDetail('attention')} onSeek={(progress) => seekScene('attention', progress)} onPlay={() => playActiveScene('attention')} />
      </div>
    </section>

    <section id="moe" data-chapter data-scene-state={sceneState('moe')} class:focused={focusScene === 'moe'} class="trace-section moe-section" style={`--scene-progress:${sceneProgress('moe')}`}>
      <div class="visual-shell scene-sticky">
        {@render SectionHeading(t('moeKicker'), t('moeTitle'), t('moeBody'), [t('captured'), '256 experts', 'top-8'])}
        <MoeScene moe={experience.moe} promptPieces={experience.run.promptPieces} progress={sceneProgress('moe')} focused={focusScene === 'moe'} {focusProgress} locale={playback.locale} onToggle={() => openDetail('moe')} onSeek={(progress) => seekScene('moe', progress)} onPlay={() => playActiveScene('moe')} />
      </div>
    </section>

    <section id="tp" data-chapter data-scene-state={sceneState('tp')} class:focused={focusScene === 'tp'} class="trace-section tp-section" style={`--scene-progress:${sceneProgress('tp')}`}>
      <div class="visual-shell scene-sticky">
        {@render SectionHeading(t('tpKicker'), t('tpTitle'), t('tpBody'), [t('captured'), 'TP=2', 'EP=false'])}
        <TensorParallelScene parallel={experience.tensorParallel} progress={sceneProgress('tp')} focused={focusScene === 'tp'} {focusProgress} locale={playback.locale} onToggle={() => openDetail('tp')} onSeek={(progress) => seekScene('tp', progress)} onPlay={() => playActiveScene('tp')} />
      </div>
    </section>

    <section id="decode" data-chapter data-scene-state={sceneState('decode')} class="trace-section decode-section" style={`--scene-progress:${sceneProgress('decode')}`}>
      <div class="visual-shell scene-sticky">
        {@render SectionHeading(t('decodeKicker'), t('decodeTitle'), t('decodeBody'), [t('captured'), '5 tokens', '[1, 248320]'])}
        <DecodeScene decode={experience.decode} progress={sceneProgress('decode')} locale={playback.locale} />
      </div>
    </section>
  </main>
{/if}

{#if evidenceOpen && experience}
  <button class="drawer-scrim" aria-label={`${t('close')} · ${t('traceEvidence')}`} on:click={closeEvidence}></button>
  <div id="trace-evidence-drawer" class="evidence-drawer" role="dialog" aria-modal="true" aria-labelledby="trace-evidence-title">
    <div class="drawer-head"><div><span class="fidelity real">{t('captured')}</span><h2 id="trace-evidence-title">{t('traceEvidence')}</h2></div><button bind:this={evidenceCloseButton} class="icon-button" aria-label={t('close')} on:click={closeEvidence}><IconX size={21} /></button></div>
    <p>{t('methodNote')}</p>
    <dl>
      <div><dt>{t('runId')}</dt><dd class="mono">{RUN_ID}</dd></div>
      <div><dt>{t('eventCount')}</dt><dd class="mono">{experience.run.eventCount.toLocaleString()}</dd></div>
      <div><dt>{t('model')}</dt><dd>Qwen3.5-35B-A3B W8A8</dd></div>
      <div><dt>{t('execution')}</dt><dd>{t('evidenceExecutionValue')}</dd></div>
      <div><dt>{t('provenance')}</dt><dd>{t('evidenceProvenance')}</dd></div>
    </dl>
    <div class="fidelity-legend">
      <span class="fidelity real">{t('captured')}</span><p>{t('capturedDefinition')}</p>
      <span class="fidelity summary">{t('summary')}</span><p>{t('summaryDefinition')}</p>
      <span class="fidelity derived">{t('derived')}</span><p>{t('derivedDefinition')}</p>
      <span class="fidelity structural">{t('structural')}</span><p>{t('structuralDefinition')}</p>
      <span class="fidelity schematic">{t('schematic')}</span><p>{t('schematicDefinition')}</p>
    </div>
    <div class="tensor-inspector"><h3>{t('tensorInspector')}</h3><strong class="mono">layer3.attention.query</strong><div><span>{t('shape')}<b class="mono">[{experience.fullAttention.queryShape.join(', ')}]</b></span><span>{t('dtype')}<b class="mono">bfloat16</b></span><span>{t('device')}<b class="mono">NPU:0 + NPU:1</b></span></div></div>
    <div class="evidence-files"><h3>{t('sourceFiles')}</h3>{#each ['manifest.json', 'qwen-validation-report.json', 'attention-derived.json', 'parallel-summary.json', 'moe-quantization.json'] as file}<span class="mono"><IconDatabase size={14} />{file}</span>{/each}</div>
  </div>
{/if}

{#snippet SectionHeading(kicker: string, title: string, body: string, badges: string[] = [])}
  <div class="section-heading">
    <div><p class="kicker">{kicker}</p><h2>{title}</h2></div>
    <div><p class="lede">{body}</p><div class="heading-badges">{#each badges as badge}<span>{badge}</span>{/each}</div></div>
  </div>
{/snippet}
