// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';

vi.mock('$app/navigation', () => ({ replaceState: vi.fn() }));

import Page from './+page.svelte';

const RUN_ID = 'qwen35-a3b-w8a8-20260710-p4r4';
const fixtureRoot = resolve(dirname(fileURLToPath(import.meta.url)), `../../../data/web/${RUN_ID}`);
const appCss = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../app.css'), 'utf8');
const files = ['manifest.json', 'qwen-validation-report.json', 'attention-derived.json', 'parallel-summary.json', 'moe-quantization.json'];
const fixtures: Record<string, any> = Object.fromEntries(files.map((name) => [name, JSON.parse(readFileSync(resolve(fixtureRoot, name), 'utf8'))]));
fixtures['init.json'] = JSON.parse(readFileSync(resolve(fixtureRoot, 'chapters/init.json'), 'utf8'));
fixtures['prefill.json'] = JSON.parse(readFileSync(resolve(fixtureRoot, 'chapters/prefill.json'), 'utf8'));
fixtures['decode.json'] = JSON.parse(readFileSync(resolve(fixtureRoot, 'chapters/decode.json'), 'utf8'));

class TestIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear()
  });
  vi.stubGlobal('IntersectionObserver', TestIntersectionObserver);
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  const canvasContext = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    lineCap: 'round',
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1
  } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext);
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
    const name = new URL(String(input), 'http://localhost').pathname.split('/').at(-1)!;
    const fixture = fixtures[name];
    return fixture
      ? new Response(JSON.stringify(fixture), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : new Response('not found', { status: 404 });
  }));
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn()
  });
  history.replaceState({}, '', '/?lang=en');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('inference experience', () => {
  it('keeps every chapter moving with document scroll instead of pinning a sticky runway', async () => {
    render(Page);
    await screen.findByRole('list', { name: 'Initialization sequence' });

    const chapterTheme = appCss.match(/\.trace-section\s*\{([^}]*)\}/s)?.[1] ?? '';
    const sharedSceneTheme = appCss.match(/\.scene-sticky\s*\{([^}]*)\}/s)?.[1] ?? '';

    expect(chapterTheme).toContain('min-height: auto');
    expect(sharedSceneTheme).toContain('position: relative');
    expect(sharedSceneTheme).toContain('top: auto');
    expect(sharedSceneTheme).not.toContain('position: sticky');
  });

  it('keeps Decode on the same light editorial canvas as the preceding chapters', async () => {
    render(Page);
    await screen.findByRole('list', { name: 'Generation decisions' });

    const decodeTheme = appCss.match(/\.decode-section\s*\{([^}]*)\}/s)?.[1] ?? '';
    expect(decodeTheme).toContain('background: #faf9ff');
    expect(decodeTheme).toContain('color: var(--ink)');
    expect(decodeTheme).not.toContain('#17182b');
  });

  it('does not complete a scene when the user only browses to another page', async () => {
    render(Page);
    await screen.findByRole('list', { name: '40-layer architecture' });

    await userEvent.click(screen.getByRole('button', { name: '4. Prefill' }));
    await userEvent.click(screen.getByRole('button', { name: '10' }));
    const prefill = document.querySelector<HTMLElement>('#prefill [data-motion-progress]')!;
    const selectedProgress = prefill.dataset.motionProgress;

    await userEvent.click(screen.getByRole('button', { name: '5. Attention' }));

    expect(selectedProgress).not.toBe('1.000');
    expect(prefill).toHaveAttribute('data-motion-progress', selectedProgress);
  });

  it('offers three start positions and single or continuous execution', async () => {
    render(Page);
    await screen.findByRole('button', { name: 'Play inference' });

    await userEvent.click(screen.getByRole('button', { name: 'Playback options' }));

    const startPosition = screen.getByRole('group', { name: 'Start position' });
    expect(within(startPosition).getByRole('radio', { name: 'From beginning' })).toBeVisible();
    expect(within(startPosition).getByRole('radio', { name: 'From current page' })).toBeVisible();
    expect(within(startPosition).getByRole('radio', { name: 'From current step' })).toBeVisible();
    const runMode = screen.getByRole('group', { name: 'Run mode' });
    expect(within(runMode).getByRole('radio', { name: 'Continuous' })).toBeVisible();
    expect(within(runMode).getByRole('radio', { name: 'Single step' })).toBeVisible();
  });

  it('single-steps Overview through all six semantic stages without skipping', async () => {
    render(Page);
    await screen.findByRole('button', { name: 'Open model initialization' });
    const flow = document.querySelector<HTMLElement>('.global-flow-experience')!;

    await userEvent.click(screen.getByRole('button', { name: 'Playback options' }));
    await userEvent.click(screen.getByRole('radio', { name: 'From current page' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Single step' }));
    await userEvent.click(screen.getByRole('button', { name: 'Run one step' }));
    expect(flow).toHaveAttribute('data-motion-progress', '0.167');
    expect(flow).toHaveAttribute('data-active-stage', 'tokens');

    await userEvent.click(screen.getByRole('button', { name: 'Playback options' }));
    await userEvent.click(screen.getByRole('radio', { name: 'From current step' }));
    const expected = [
      ['0.333', 'embedding'],
      ['0.500', 'transformer'],
      ['0.667', 'logits'],
      ['0.833', 'completion'],
      ['1.000', 'completion']
    ] as const;
    for (const [motionProgress, stage] of expected) {
      await userEvent.click(screen.getByRole('button', { name: 'Run one step' }));
      expect(flow).toHaveAttribute('data-motion-progress', motionProgress);
      expect(flow).toHaveAttribute('data-active-stage', stage);
    }
    expect(document.querySelector('.scene-status small')).toHaveTextContent('Cursor: Overview');
  });

  it('browses from a Global Flow stage without moving the Overview cursor', async () => {
    render(Page);
    const stage = await screen.findByRole('button', { name: 'Open model initialization' });
    const flow = document.querySelector<HTMLElement>('.global-flow-experience')!;

    await userEvent.click(stage);

    expect(flow).toHaveAttribute('data-motion-progress', '0.000');
    expect(document.querySelector('.scene-status strong')).toHaveTextContent('Initialize');
    expect(document.querySelector('.scene-status small')).toHaveTextContent('Cursor: Overview · 0%');
  });

  it('single-steps from the visible page, then continues from that independent step', async () => {
    render(Page);
    await screen.findByRole('button', { name: '5. Attention' });
    await userEvent.click(screen.getByRole('button', { name: '5. Attention' }));
    await userEvent.click(screen.getByRole('button', { name: 'Playback options' }));
    await userEvent.click(screen.getByRole('radio', { name: 'From current page' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Single step' }));

    await userEvent.click(screen.getByRole('button', { name: 'Run one step' }));

    const attention = document.querySelector<HTMLElement>('#attention [data-motion-progress]')!;
    expect(attention).toHaveAttribute('data-motion-progress', '0.167');
    expect(document.querySelector('.scene-status small')).toHaveTextContent('Cursor: Attention');

    await userEvent.click(screen.getByRole('button', { name: '7. Tensor Parallel' }));
    expect(document.querySelector('.scene-status strong')).toHaveTextContent('Tensor Parallel');
    expect(document.querySelector('.scene-status small')).toHaveTextContent('Cursor: Attention');
    await userEvent.click(screen.getByRole('button', { name: 'Playback options' }));
    await userEvent.click(screen.getByRole('radio', { name: 'From current step' }));
    await userEvent.click(screen.getByRole('button', { name: 'Run one step' }));

    expect(attention).toHaveAttribute('data-motion-progress', '0.333');
    expect(document.querySelector('.scene-status strong')).toHaveTextContent('Attention');
  });

  it('keeps continuous playback running while wheel scrolling takes camera control', async () => {
    render(Page);
    const start = await screen.findByRole('button', { name: 'Play inference: Initialize' });
    await userEvent.click(start);
    expect(screen.getByRole('button', { name: 'Pause inference' })).toBeVisible();

    const motion = document.querySelector<HTMLElement>('#init [data-motion-progress]')!;
    await waitFor(() => expect(Number(motion.dataset.motionProgress)).toBeGreaterThan(0));
    const before = Number(motion.dataset.motionProgress);

    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120 }));

    expect(screen.getByRole('button', { name: 'Pause inference' })).toBeVisible();
    await waitFor(() => expect(Number(motion.dataset.motionProgress)).toBeGreaterThan(before));
  });

  it('keeps continuous playback running while touch scrolling takes camera control', async () => {
    render(Page);
    const start = await screen.findByRole('button', { name: 'Play inference: Initialize' });
    await userEvent.click(start);
    expect(screen.getByRole('button', { name: 'Pause inference' })).toBeVisible();

    window.dispatchEvent(new Event('touchstart'));

    await new Promise((resolve) => window.setTimeout(resolve, 40));
    expect(screen.getByRole('button', { name: 'Pause inference' })).toBeVisible();
  });

  it('keeps inference running when chapter navigation takes camera control', async () => {
    render(Page);
    const start = await screen.findByRole('button', { name: 'Play inference: Initialize' });
    await userEvent.click(start);
    const motion = document.querySelector<HTMLElement>('#init [data-motion-progress]')!;
    await waitFor(() => expect(Number(motion.dataset.motionProgress)).toBeGreaterThan(0));
    const before = Number(motion.dataset.motionProgress);

    await userEvent.click(screen.getByRole('button', { name: '5. Attention' }));

    expect(screen.getByRole('button', { name: 'Pause inference' })).toBeVisible();
    expect(document.querySelector('.scene-status strong')).toHaveTextContent('Attention');
    expect(document.querySelector('.scene-status small')).toHaveTextContent('Cursor: Initialize');
    await waitFor(() => expect(Number(motion.dataset.motionProgress)).toBeGreaterThan(before));
  });

  it('starts animated playback and brings the initialization scene into view', async () => {
    render(Page);
    const start = await screen.findByRole('button', { name: 'Play inference: Initialize' });

    await userEvent.click(start);

    expect(screen.getByRole('button', { name: 'Pause inference' })).toBeVisible();
    await waitFor(() => expect(document.getElementById('init')).toHaveAttribute('data-scene-state', 'playing'));
    const motion = document.querySelector<HTMLElement>('#init [data-motion-progress]');
    await waitFor(() => expect(Number(motion?.dataset.motionProgress)).toBeGreaterThan(0));
    await waitFor(() => expect(document.querySelectorAll('#init .init-timeline li.active').length).toBeGreaterThan(0));
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('reveals accessible attention details when the user expands Attention', async () => {
    render(Page);
    const button = await screen.findByRole('button', { name: 'Explore attention internals' });

    expect(screen.queryByRole('region', { name: 'Attention internals' })).not.toBeInTheDocument();

    await userEvent.click(button);

    await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'true'));
    const detail = screen.getByRole('region', { name: 'Attention internals' });
    expect(detail).toBeVisible();
    expect(detail).toHaveTextContent('Q × Kᵀ');
    expect(detail).toHaveTextContent('0.999998892');

    const softmaxPanel = detail.querySelector<HTMLElement>('.softmax-source')!;
    expect(softmaxPanel.style.getPropertyValue('--stage')).toBe('0');
    await userEvent.click(within(detail).getByRole('button', { name: '05Softmax probabilities' }));
    await waitFor(() => expect(Number(softmaxPanel.style.getPropertyValue('--stage'))).toBeGreaterThan(.2));
  });

  it('reveals the captured linear-attention boundaries and structural recurrent path', async () => {
    render(Page);
    const button = await screen.findByRole('button', { name: 'Explore linear attention' });

    expect(screen.queryByRole('region', { name: 'Linear attention internals' })).not.toBeInTheDocument();

    await userEvent.click(button);

    await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'true'));
    const detail = screen.getByRole('region', { name: 'Linear attention internals' });
    expect(detail).toHaveTextContent('QwenGatedDeltaNetAttention');
    expect(detail).toHaveTextContent('npu_causal_conv1d_custom');
    expect(detail).toHaveTextContent('chunk_gated_delta_rule');
    expect(detail).toHaveTextContent('-27.00');
    expect(detail).toHaveTextContent('0.01623');
    expect(detail).toHaveTextContent('Only bounded samples and statistics were retained');
    expect(within(detail).getAllByText('Summary').length).toBeGreaterThan(0);

    const recurrentPanel = detail.querySelector<HTMLElement>('.recurrent-panel')!;
    expect(recurrentPanel.style.getPropertyValue('--stage')).toBe('0');
    await userEvent.click(within(detail).getByRole('button', { name: '04Gated delta recurrence' }));
    await waitFor(() => expect(Number(recurrentPanel.style.getPropertyValue('--stage'))).toBeGreaterThan(.2));
  });

  it('reveals real p4r4 expert routing when the user expands MoE', async () => {
    render(Page);
    const button = await screen.findByRole('button', { name: 'Explore MoE + W8A8' });
    const expertMap = screen.getByRole('list', { name: '256 router experts' });
    expect(within(expertMap).getAllByRole('listitem')).toHaveLength(256);

    expect(screen.queryByRole('region', { name: 'MoE + W8A8 internals' })).not.toBeInTheDocument();

    await userEvent.click(button);

    const detail = await screen.findByRole('region', { name: 'MoE + W8A8 internals' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(expertMap.querySelectorAll('.selected')).toHaveLength(8);
    expect(detail).toHaveTextContent('E214');
    expect(detail).toHaveTextContent('E202');
    expect(detail).toHaveTextContent('[40]');
    expect(detail).toHaveTextContent('[40, 2048]');
  });

  it('reveals both real tensor-parallel rank spans when TP is expanded', async () => {
    render(Page);
    const button = await screen.findByRole('button', { name: 'Explore tensor parallelism' });

    expect(screen.queryByRole('region', { name: 'Tensor parallel internals' })).not.toBeInTheDocument();

    await userEvent.click(button);

    const detail = await screen.findByRole('region', { name: 'Tensor parallel internals' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(detail).toHaveTextContent('6.440 ms');
    expect(detail).toHaveTextContent('6.515 ms');
    expect(detail).toHaveTextContent('8 Q / 1 KV');
    expect(detail).toHaveTextContent('[5, 4608]');
  });

  it('renders the exact 40-layer mix and five decode steps from p4r4', async () => {
    render(Page);

    const layers = await screen.findByRole('list', { name: '40-layer architecture' });
    expect(within(layers).getAllByRole('listitem')).toHaveLength(40);
    expect(layers.querySelectorAll('[title*="linear_attention"]')).toHaveLength(30);
    expect(layers.querySelectorAll('[title*="full_attention"]')).toHaveLength(10);

    expect(screen.getAllByText('Hello, my name is')).toHaveLength(2);
    const decodeSteps = screen.getByRole('list', { name: 'Generation decisions' });
    expect(within(decodeSteps).getAllByRole('listitem')).toHaveLength(5);
    expect(within(decodeSteps).getAllByText('[1, 248320]')).toHaveLength(5);
    expect(within(decodeSteps).getByText('7525')).toBeVisible();
    expect(within(decodeSteps).getByText('321')).toBeVisible();
  });

  it('keeps only one expanded scene open and supports collapse', async () => {
    render(Page);
    const linearButton = await screen.findByRole('button', { name: 'Explore linear attention' });
    const attentionButton = await screen.findByRole('button', { name: 'Explore attention internals' });
    const moeButton = screen.getByRole('button', { name: 'Explore MoE + W8A8' });

    await userEvent.click(linearButton);
    expect(screen.getByRole('region', { name: 'Linear attention internals' })).toBeVisible();

    await userEvent.click(attentionButton);
    expect(screen.queryByRole('region', { name: 'Linear attention internals' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Attention internals' })).toBeVisible();

    await userEvent.click(moeButton);
    expect(screen.queryByRole('region', { name: 'Attention internals' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'MoE + W8A8 internals' })).toBeVisible();

    await userEvent.click(moeButton);
    await waitFor(() => expect(screen.queryByRole('region', { name: 'MoE + W8A8 internals' })).not.toBeInTheDocument());
  });

  it('reopens a focus scene when the entry is clicked during its closing transition', async () => {
    render(Page);
    const linearButton = await screen.findByRole('button', { name: 'Explore linear attention' });

    await userEvent.click(linearButton);
    const detail = screen.getByRole('region', { name: 'Linear attention internals' });
    await userEvent.click(within(detail).getByRole('button', { name: 'Close' }));
    await userEvent.click(linearButton);
    await new Promise((resolve) => setTimeout(resolve, 520));

    expect(screen.getByRole('region', { name: 'Linear attention internals' })).toBeVisible();
    expect(linearButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('switches the complete interface to zh-CN without losing the open scene', async () => {
    render(Page);
    const attentionButton = await screen.findByRole('button', { name: 'Explore attention internals' });
    await userEvent.click(attentionButton);
    expect(screen.getByRole('region', { name: 'Attention internals' })).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: '中文' }));

    expect(await screen.findByRole('region', { name: 'Attention 内部过程' })).toBeVisible();
    expect(screen.getByRole('button', { name: '展开 Attention 内部' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('播放速度')).toHaveValue('1');
  });

  it('exposes evidence as a keyboard-dismissible dialog and restores trigger focus', async () => {
    render(Page);
    const trigger = await screen.findByRole('button', { name: 'Evidence' });

    await userEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Trace evidence' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Trace evidence' })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('localizes navigation and every explanatory evidence sentence in zh-CN', async () => {
    render(Page);
    await screen.findByRole('button', { name: 'Evidence' });

    await userEvent.click(screen.getByRole('button', { name: '中文' }));
    expect(screen.getByRole('navigation', { name: '轨迹章节' })).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: '数据证据' }));
    const dialog = screen.getByRole('dialog', { name: '轨迹证据' });
    expect(dialog).toHaveTextContent('vLLM Ascend · 2 个 NPU Rank · eager 可观察模式');
    expect(dialog).toHaveTextContent('来自 p4r4 的完整直接采集值。');
    expect(dialog).toHaveTextContent('直接采集 Tensor 的统计与受控长度样本。');
    expect(dialog).toHaveTextContent('由真实输入确定性计算，并与采集输出完成验证。');
    expect(dialog).toHaveTextContent('用于教学的运动，不声称是采集到的中间值。');
  });

  it('supports global keyboard playback, chapter navigation and focused-scene escape', async () => {
    render(Page);
    await screen.findByRole('button', { name: 'Play inference' });

    document.body.focus();
    await userEvent.keyboard(' ');
    expect(screen.getByRole('button', { name: 'Pause inference' })).toBeVisible();
    expect(document.querySelector('.scene-status strong')).toHaveTextContent('Initialize');

    await userEvent.keyboard('{ArrowRight}');
    expect(document.querySelector('.scene-status strong')).toHaveTextContent('Tokenize');
    expect(document.querySelector('.scene-status small')).toHaveTextContent('Cursor: Initialize');
    expect(screen.getByRole('button', { name: 'Pause inference' })).toBeVisible();

    const attentionButton = screen.getByRole('button', { name: 'Explore attention internals' });
    await userEvent.click(attentionButton);
    expect(screen.getByRole('region', { name: 'Attention internals' })).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Attention internals' })).not.toBeInTheDocument());
  });

  it('lets an explicit English URL override a previously saved Chinese locale', async () => {
    localStorage.setItem('inference-locale', 'zh-CN');
    history.replaceState({}, '', '/?lang=en');

    render(Page);

    expect(await screen.findByRole('heading', { name: 'Watch one real inference unfold' })).toBeVisible();
    expect(screen.getByRole('button', { name: '中文' })).toBeVisible();
  });
});
