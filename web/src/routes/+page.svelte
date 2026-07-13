<script lang="ts">
  import { onMount } from 'svelte';
  import { replaceState } from '$app/navigation';
  import { IconArrowRight, IconChevronDown, IconChevronLeft, IconChevronRight, IconDatabase, IconInfoCircle, IconLanguage, IconPlayerPause, IconPlayerPlay, IconRefresh, IconX } from '@tabler/icons-svelte';
  import MatrixGrid from '$lib/components/MatrixGrid.svelte';
  import PulseFlow from '$lib/components/PulseFlow.svelte';
  import { StaticTraceRepository } from '$lib/trace/repository';
  import { CHAPTERS, createPlaybackEngine, type Locale, type PlaybackSnapshot, type SceneId } from '$lib/playback/engine';
  import { createCatalog, type MessageKey } from '$lib/i18n/catalog';

  const RUN_ID = 'qwen35-a3b-w8a8-20260710-p4r4';
  const engine = createPlaybackEngine();
  let playback: PlaybackSnapshot;
  const unsubscribe = engine.state.subscribe((value) => playback = value);
  let loading = true, error = '', evidenceOpen = false;
  let validation: any = null, attention: any = null, parallel: any = null, moeQuant: any = null;
  let observer: IntersectionObserver;
  let t = createCatalog('en');
  $: if (playback) t = createCatalog(playback.locale);
  $: activeAttentionRow = Math.min(4, Math.floor((playback?.progress ?? 0) * 5));
  $: focusScene = playback?.focus?.scene;
  $: focusProgress = playback?.focus?.progress ?? 0;

  async function loadTrace() {
    loading = true; error = '';
    try {
      const session = await new StaticTraceRepository().open(RUN_ID);
      [validation, attention, parallel, moeQuant] = await Promise.all([
        session.artifact('qwen-validation-report.json'), session.artifact('attention-derived.json'),
        session.artifact('parallel-summary.json'), session.artifact('moe-quantization.json')
      ]);
    } catch (caught) { error = caught instanceof Error ? caught.message : String(caught); }
    finally { loading = false; }
  }
  function command(type: 'TOGGLE' | 'NEXT' | 'PREVIOUS') {
    engine.dispatch({ type });
    if (type !== 'TOGGLE') requestAnimationFrame(() => document.getElementById(playback.chapter)?.scrollIntoView({ behavior: playback.motion === 'reduced' ? 'auto' : 'smooth' }));
  }
  function setChapter(chapter: SceneId) {
    engine.dispatch({ type: 'SET_CHAPTER', chapter });
    document.getElementById(chapter)?.scrollIntoView({ behavior: playback.motion === 'reduced' ? 'auto' : 'smooth' });
  }
  function openDetail(scene: SceneId) { engine.dispatch(focusScene === scene ? { type: 'CLOSE_DETAIL' } : { type: 'OPEN_DETAIL', scene }); }
  function setLocale(locale: Locale, syncUrl = true) {
    engine.dispatch({ type: 'SET_LOCALE', locale }); localStorage.setItem('inference-locale', locale);
    if (syncUrl) { const url = new URL(location.href); url.searchParams.set('lang', locale); replaceState(url, {}); }
  }
  function onKeydown(event: KeyboardEvent) {
    if ((event.target as HTMLElement)?.matches('select, input, textarea, button')) return;
    if (event.code === 'Space') { event.preventDefault(); command('TOGGLE'); }
    if (event.key === 'ArrowRight') command('NEXT');
    if (event.key === 'ArrowLeft') command('PREVIOUS');
    if (event.key === 'Escape') { evidenceOpen = false; engine.dispatch({ type: 'CLOSE_DETAIL' }); }
  }
  onMount(() => {
    const query = new URL(location.href).searchParams.get('lang'), saved = localStorage.getItem('inference-locale');
    setLocale(query === 'zh' || saved === 'zh' ? 'zh' : 'en', false);
    engine.dispatch({ type: 'SET_MOTION', motion: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full' });
    loadTrace();
    observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const id = visible?.target.id as SceneId;
      if (id && CHAPTERS.includes(id) && id !== playback.chapter) engine.dispatch({ type: 'SET_CHAPTER', chapter: id });
    }, { threshold: [.3, .55, .75] });
    document.querySelectorAll<HTMLElement>('[data-chapter]').forEach((section) => observer.observe(section));
    window.addEventListener('keydown', onKeydown);
    return () => { observer?.disconnect(); window.removeEventListener('keydown', onKeydown); unsubscribe(); engine.destroy(); };
  });
  const chapterLabel = (scene: SceneId): MessageKey => scene;
</script>

<svelte:head><title>{t('title')}</title><meta name="description" content={t('subtitle')} /></svelte:head>

<header class="topbar">
  <button class="brand" on:click={() => setChapter('overview')}><span class="brand-mark">Q</span><span><strong>{t('title')}</strong><small>{t('subtitle')}</small></span></button>
  <nav aria-label="Trace chapters">{#each CHAPTERS as chapter, index}<button class:active={playback?.chapter === chapter} on:click={() => setChapter(chapter)} title={t(chapterLabel(chapter))}><span>{index}</span></button>{/each}</nav>
  <div class="top-actions"><button class="icon-button language" on:click={() => setLocale(playback.locale === 'en' ? 'zh' : 'en')}><IconLanguage size={18}/><span>{t('language')}</span></button><button class="icon-button" on:click={() => evidenceOpen = true}><IconDatabase size={19}/></button></div>
  <div class="progress-line"><i style={`width:${((playback?.chapterIndex ?? 0) + (playback?.progress ?? 0)) / CHAPTERS.length * 100}%`}></i></div>
</header>

{#if loading}
  <div class="loading"><span></span><p class="mono">{t('loading')}</p></div>
{:else if error}
  <div class="loading error"><IconInfoCircle size={34}/><h1>{t('error')}</h1><p class="mono">{error}</p><button class="detail-button" on:click={loadTrace}><IconRefresh size={17}/>{t('retry')}</button></div>
{:else}
  <main>
    <section id="overview" data-chapter class="hero trace-section"><div class="hero-orbit orbit-one"></div><div class="hero-orbit orbit-two"></div><div class="section-shell hero-inner">
      <div class="hero-badges"><span class="fidelity real">{t('real')}</span><span class="mono run-id">{RUN_ID}</span></div><p class="kicker">{t('heroKicker')}</p><h1 class="display">{t('heroTitle')}</h1><p class="lede">{t('heroBody')}</p>
      <div class="hero-facts"><div><small>{t('prompt')}</small><strong class="mono">Hello, my name is</strong></div><div><small>{t('output')}</small><strong class="mono coral-text">[Your Name], and</strong></div><div><small>{t('model')}</small><strong>Qwen3.5-35B-A3B W8A8</strong></div><div><small>{t('execution')}</small><strong>2 × Ascend NPU · TP=2</strong></div></div>
      <div class="overview-flow"><PulseFlow labels={[t('tokens'), t('prefill'), t('moe'), t('decode')]} progress={playback?.chapter === 'overview' ? playback.progress : .85}/></div>
      <button class="scroll-cue" on:click={() => setChapter('init')}><span>{t('scroll')}</span><IconChevronDown size={22}/></button>
    </div></section>

    <section id="init" data-chapter class="trace-section init-section"><div class="section-shell">{@render Heading(t('initKicker'), t('initTitle'), t('initBody'))}
      <div class="init-visual stage-card"><div class="model-spec"><span class="model-cube">35B</span><strong>Qwen3.5-A3B</strong><small class="mono">{t('layers')} · {t('experts')}</small></div><div class="load-lanes">{#each [0, 1] as rank}<div class="load-lane"><span class="mono">TP RANK {rank}</span><div class="weight-stack">{#each Array(8) as _, i}<i style={`--delay:${i * .07}s`}></i>{/each}</div><b><span></span>{t('ready')}</b></div>{/each}</div><div class="init-flow"><PulseFlow compact labels={[t('metadata'), t('shard'), t('quant'), t('runtime')]} progress={playback.chapter === 'init' ? playback.progress : 1}/></div></div>
    </div></section>

    <section id="tokens" data-chapter class="trace-section token-section"><div class="section-shell">{@render Heading(t('tokenKicker'), t('tokenTitle'), t('tokenBody'))}
      <div class="token-visual"><div class="token-string stage-card"><small>{t('prompt')}</small><p>{#each ['Hello', ',', ' my', ' name', ' is'] as token, i}<span style={`--i:${i}`}>{token}</span>{/each}</p></div><IconArrowRight class="big-arrow" size={36}/><div class="ids stage-card"><small>{t('tokenIds')}</small><div>{#each [9419, 11, 821, 803, 369] as id}<span class="mono">{id}</span>{/each}</div><p class="scheduler-note mono">{t('scheduler')}</p></div><IconArrowRight class="big-arrow" size={36}/><div class="embedding-card stage-card"><div class="embedding-head"><span>{t('embedding')}</span><b class="shape">[5, 2048]</b></div><div class="embedding-grid">{#each Array(60) as _, i}<i style={`--v:${((i * 37) % 100) / 100}`}></i>{/each}</div></div></div>
    </div></section>

    <section id="prefill" data-chapter class="trace-section prefill-section"><div class="section-shell">{@render Heading(t('prefillKicker'), t('prefillTitle'), t('prefillBody'))}
      <div class="prefill-visual stage-card"><div class="tensor-block"><span>{t('hidden')}</span><b>[5, 2048]</b><div class="tensor-bars">{#each Array(5) as _, i}<i style={`--w:${70 + i * 5}%`}></i>{/each}</div></div><div class="operator"><small>OPERATOR</small><strong>{t('norm')}</strong><span class="mono">bfloat16</span></div><div class="operator accent"><small>FUSED OPERATOR</small><strong>{t('qkv')}</strong><span class="mono">[5, 4608] / rank</span></div><div class="qkv-output"><div class="q"><span>Q</span><b>[5, 2048]</b></div><div class="k"><span>K</span><b>[5, 256]</b></div><div class="v"><span>V</span><b>[5, 256]</b></div></div></div>
      <div class="layer-overview stage-card"><div class="layer-label"><strong>{t('layersOverview')}</strong><span><i class="linear-dot"></i>{t('linearAttention')} · 30 <i class="full-dot"></i>{t('fullAttention')} · 10</span></div><div class="layer-ribbon">{#each Array(40) as _, i}<i class:full={i % 4 === 3}><span>{i + 1}</span></i>{/each}</div><div class="attention-types"><div><small>30 × {t('linearAttention')}</small><strong>Conv → Gate → Recurrent state</strong><span class="mono">O(T) sequence path</span></div><div><small>10 × {t('fullAttention')}</small><strong>QKᵀ → Mask → Softmax → V</strong><span class="mono">Layer 3 expanded below</span></div></div></div>
    </div></section>

    <section id="attention" data-chapter class:focused={focusScene === 'attention'} class="trace-section attention-section" style={`--focus:${focusScene === 'attention' ? focusProgress : 0}`}><div class="section-shell">{@render Heading(t('attentionKicker'), t('attentionTitle'), t('attentionBody'), t('expandAttention'), focusScene === 'attention', () => openDetail('attention'))}
      <div class="attention-visual"><div class="matrix-card stage-card"><div class="card-label"><span>{t('softmax')}</span><span class="fidelity derived">{t('derived')}</span></div><MatrixGrid matrix={attention.overview.meanProbabilityMatrix} labels={['Hello', ',', 'my', 'name', 'is']} activeRow={activeAttentionRow}/></div><div class="attention-detail stage-card"><div class="formula mono">softmax((Q × Kᵀ) / √d + mask)</div><div class="attention-pipeline"><div><span>Q × Kᵀ</span><i></i></div><IconArrowRight/><div><span>{t('causalMask')}</span><i class="mask"></i></div><IconArrowRight/><div><span>SOFTMAX</span><i class="soft"></i></div></div><div class="verified"><span class="fidelity derived">{t('derived')}</span><strong>{t('verified')}</strong><small>16 heads · Layer 3 · TP ranks 0 + 1</small></div></div></div>
    </div></section>

    <section id="moe" data-chapter class:focused={focusScene === 'moe'} class="trace-section moe-section" style={`--focus:${focusScene === 'moe' ? focusProgress : 0}`}><div class="section-shell">{@render Heading(t('moeKicker'), t('moeTitle'), t('moeBody'), t('expandMoe'), focusScene === 'moe', () => openDetail('moe'))}
      <div class="moe-visual stage-card"><div class="router-panel"><small>{t('router')} · <span class="shape">[5, 256]</span></small><div class="router-bars">{#each Array(24) as _, i}<i class:selected={validation.routerTopkIds[0].includes(i)} style={`--h:${22 + ((i * 47) % 68)}%`}></i>{/each}</div></div><div class="expert-field">{#each Array(32) as _, i}<div class:selected={validation.routerTopkIds[0].includes(i)}><span>E{i}</span></div>{/each}</div><div class="route-detail"><span class="fidelity real">{t('real')}</span><h3>{t('selected')}</h3><div class="expert-ids">{#each validation.routerTopkIds[0] as id, i}<span class="mono" style={`--delay:${i * .05}s`}>E{id}</span>{/each}</div><div class="route-flow"><b>{t('dispatch')}</b><IconArrowRight/><b>{t('combine')}</b></div><small class="mono">dynamicScale [40] · {moeQuant.steps.length} captured steps</small></div></div>
    </div></section>

    <section id="tp" data-chapter class:focused={focusScene === 'tp'} class="trace-section tp-section" style={`--focus:${focusScene === 'tp' ? focusProgress : 0}`}><div class="section-shell">{@render Heading(t('tpKicker'), t('tpTitle'), t('tpBody'), t('expandTp'), focusScene === 'tp', () => openDetail('tp'))}
      <div class="tp-visual">{@render Rank('0', t('rank0'), t('weightShard'), t('localOutput'))}<div class="collective"><span class="packet left">Q₀</span><div><i></i><strong>{t('collective')}</strong><small class="mono">ALL-REDUCE / ALL-GATHER</small></div><span class="packet right">Q₁</span></div>{@render Rank('1', t('rank1'), t('weightShard'), t('localOutput'))}</div><p class="ep-note"><IconInfoCircle size={17}/>{t('epOff')} · TP = {parallel.configured.tensorParallelSize}</p>
    </div></section>

    <section id="decode" data-chapter class="trace-section decode-section"><div class="section-shell">{@render Heading(t('decodeKicker'), t('decodeTitle'), t('decodeBody'))}
      <div class="decode-visual stage-card"><div class="decode-loop"><div class="logits-bars">{#each Array(42) as _, i}<i class:top={i === 29} style={`--h:${10 + ((i * 31) % 82)}%`}></i>{/each}</div><b class="shape">{t('logits')} [1, 248320]</b><IconArrowRight/><div class="sample-token"><small>{t('sample')}</small><strong class="mono">{validation.generatedTokenIds[Math.min(4, Math.floor(playback.progress * 5))]}</strong></div><IconRefresh class="loop-icon" size={34}/><div class="kv-cache"><span>{t('kv')}</span>{#each Array(5) as _, i}<i class:filled={i <= Math.floor(playback.progress * 5)}></i>{/each}</div></div><div class="generated"><small>{t('finalText')}</small><p>Hello, my name is <span>[Your Name], and</span><i></i></p><div class="token-strip">{#each validation.generatedTokenIds as id, i}<span class="mono"><small>STEP {i + 1}</small>{id}</span>{/each}</div></div></div>
    </div></section>
  </main>
{/if}

<div class="player"><button on:click={() => command('PREVIOUS')}><IconChevronLeft size={18}/></button><button class="play" on:click={() => command('TOGGLE')}>{#if playback?.transport === 'playing'}<IconPlayerPause size={18}/>{:else}<IconPlayerPlay size={18}/>{/if}</button><button on:click={() => command('NEXT')}><IconChevronRight size={18}/></button><span class="mono">{String((playback?.chapterIndex ?? 0) + 1).padStart(2, '0')} / 08</span><select aria-label="Playback speed" value={playback?.speed ?? 1} on:change={(event) => engine.dispatch({ type: 'SET_SPEED', speed: Number(event.currentTarget.value) })}><option value="0.5">0.5×</option><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></div>

{#if evidenceOpen}<button class="drawer-scrim" aria-label={t('close')} on:click={() => evidenceOpen = false}></button><aside class="evidence-drawer"><div class="drawer-head"><div><span class="fidelity real">{t('real')}</span><h2>{t('traceEvidence')}</h2></div><button class="icon-button" on:click={() => evidenceOpen = false}><IconX size={21}/></button></div><p>{t('captured')}</p><dl><div><dt>{t('runId')}</dt><dd class="mono">{RUN_ID}</dd></div><div><dt>{t('model')}</dt><dd>Qwen3.5-35B-A3B W8A8</dd></div><div><dt>{t('execution')}</dt><dd>vLLM Ascend · 2 NPU ranks</dd></div><div><dt>{t('provenance')}</dt><dd>1,722 structured trace events; derived attention is verified offline.</dd></div></dl><div class="tensor-inspector"><h3>{t('tensorInspector')}</h3><strong class="mono">layer3.attention.query</strong><div><span>{t('shape')} <b class="mono">[5, 2048]</b></span><span>{t('dtype')} <b class="mono">bfloat16</b></span><span>{t('device')} <b class="mono">NPU:0 + NPU:1</b></span></div></div><div class="glossary"><h3>{t('glossary')}</h3><p><b>TP</b> Tensor Parallel · 张量并行</p><p><b>KV Cache</b> Reused attention state · 复用的注意力状态</p><p><b>W8A8</b> INT8 weights and activations · 8 位权重与激活</p></div><div class="evidence-files">{#each ['manifest.json', 'qwen-validation-report.json', 'attention-derived.json', 'parallel-summary.json', 'moe-quantization.json'] as file}<span class="mono"><IconDatabase size={14}/>{file}</span>{/each}</div></aside>{/if}

{#snippet Heading(kicker: string, title: string, body: string, detail?: string, open = false, action?: () => void)}
  <div class="section-heading"><div><p class="kicker">{kicker}</p><h2 class="section-title">{title}</h2></div><div><p class="lede">{body}</p>{#if detail && action}<button class="detail-button" aria-expanded={open} on:click={action}>{open ? t('close') : detail}<IconArrowRight size={17}/></button>{/if}</div></div>
{/snippet}
{#snippet Rank(number: string, title: string, weight: string, output: string)}
  <div class="rank-card stage-card"><div class="rank-title"><span>{number}</span><div><small>NPU:{number}</small><strong>{title}</strong></div></div><div class="shard-grid">{#each Array(24) as _, i}<i style={`--v:${number === '0' ? (i % 8) / 8 : 1 - (i % 8) / 8}`}></i>{/each}</div><div class="rank-shape"><span>{weight}</span><b class="mono">[2048, 4608]</b></div><div class="rank-shape"><span>{output}</span><b class="mono">[5, 4608]</b></div></div>
{/snippet}
