// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTraceExperience } from '$lib/experience/scene-model';
import { createCatalog } from '$lib/i18n/catalog';
import GlobalFlow from './GlobalFlow.svelte';

const RUN_ID = 'qwen35-a3b-w8a8-20260710-p4r4';
const root = resolve(dirname(fileURLToPath(import.meta.url)), `../../../../data/web/${RUN_ID}`);
const read = (path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const experience = buildTraceExperience({
  initEvents: read('chapters/init.json'),
  prefillEvents: read('chapters/prefill.json'),
  decodeEvents: read('chapters/decode.json'),
  validation: read('qwen-validation-report.json'),
  attention: read('attention-derived.json'),
  parallel: read('parallel-summary.json'),
  moeQuantization: read('moe-quantization.json'),
  eventCount: 1722
});

const observe = vi.fn();
const disconnect = vi.fn();
class TestResizeObserver {
  observe = observe;
  disconnect = disconnect;
}

beforeEach(() => {
  observe.mockClear();
  disconnect.mockClear();
  vi.stubGlobal('ResizeObserver', TestResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('GlobalFlow', () => {
  it('renders the real six-stage pipeline as semantic objects with decorative flow layers', () => {
    const { container } = render(GlobalFlow, {
      experience,
      progress: 0.6,
      locale: 'en',
      motion: 'full',
      onNavigate: vi.fn()
    });

    expect(container.querySelectorAll('[data-global-flow-stage]')).toHaveLength(6);
    expect(container.querySelectorAll('[data-weight-shard]')).toHaveLength(10);
    expect(container.querySelectorAll('[data-token-capsule]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-layer-plate]')).toHaveLength(40);
    expect(container.querySelectorAll('[data-logit-candidate]')).toHaveLength(8);
    expect(container.querySelectorAll('[data-generation-decision]')).toHaveLength(5);
    expect(container.querySelector('svg[data-flow-ribbons]')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('canvas[data-particle-field]')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('[data-active-stage="transformer"]')).toHaveAttribute('data-active-layer', '24');
    expect(container).toHaveTextContent('[5, 2048]');
    expect(container).toHaveTextContent('[1, 248320]');
    expect(container).toHaveTextContent('1 prefill selection + 4 decode passes');
    expect(container.querySelector('[data-particle-seed]')).not.toHaveAttribute('data-particle-seed', '0');
  });

  it('maps six real button clicks to browsing without changing progress', async () => {
    const onNavigate = vi.fn();
    const { container } = render(GlobalFlow, {
      experience,
      progress: 0.6,
      locale: 'en',
      motion: 'full',
      onNavigate
    });
    const root = container.querySelector('.global-flow-experience');

    const actions = [
      ['Open model initialization', 'init'],
      ['Open tokenization', 'tokens'],
      ['Open token embedding', 'tokens'],
      ['Open prefill', 'prefill'],
      ['Open logits and decode', 'decode'],
      ['Open completion and KV reuse', 'decode']
    ] as const;

    for (const [name] of actions) {
      const button = screen.getByRole('button', { name });
      expect(button.tagName).toBe('BUTTON');
      await fireEvent.click(button);
    }

    expect(onNavigate.mock.calls.map(([scene]) => scene)).toEqual(actions.map(([, scene]) => scene));
    expect(root).toHaveAttribute('data-motion-progress', '0.600');
    expect(root).toHaveAttribute('data-active-stage', 'transformer');
  });

  it('keeps completion semantics readable in Chinese reduced motion', () => {
    const { container } = render(GlobalFlow, {
      experience,
      progress: 0.9,
      locale: 'zh-CN',
      motion: 'reduced',
      onNavigate: vi.fn()
    });

    const root = container.querySelector('.global-flow-experience');
    expect(root).toHaveAttribute('data-motion', 'reduced');
    expect(root).toHaveAttribute('data-active-stage', 'completion');
    expect(container.querySelectorAll('[data-generation-decision]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-generation-decision].complete')).toHaveLength(2);
    expect(container).toHaveTextContent('1 次 Prefill 选择 + 4 次 Decode');
    expect(screen.getByRole('button', { name: '打开生成结果与 KV 复用' })).toBeVisible();
  });

  it('keeps pending internal objects inactive and exposes trace facts as descriptions', () => {
    const { container } = render(GlobalFlow, {
      experience,
      progress: 0,
      locale: 'en',
      motion: 'full',
      onNavigate: vi.fn()
    });

    expect(container.querySelector('.global-flow-experience')).toHaveAttribute('data-active-layer', 'none');
    expect(container.querySelector('.transformer-tunnel > i.active')).toBeNull();
    expect(container.querySelector('.generation-track > span.active')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open tokenization' }))
      .toHaveAccessibleDescription(/5 prompt tokens.*Exact token IDs/i);
    expect(screen.getByRole('button', { name: 'Open prefill' }))
      .toHaveAccessibleDescription(/40 layers.*30 linear.*10 full/i);
  });

  it('renders tensor-parallel banks and overview hints from data instead of p4r4 constants', () => {
    const variant = structuredClone(experience);
    variant.run.tensorParallelSize = 3;
    const { container } = render(GlobalFlow, {
      experience: variant,
      progress: 0,
      locale: 'en',
      motion: 'full',
      onNavigate: vi.fn()
    });
    const t = createCatalog('en');

    expect(container.querySelectorAll('[data-tp-bank]')).toHaveLength(3);
    expect(container).toHaveTextContent('TP2');
    expect(t('weightAssemblyHint')).not.toMatch(/ten|TP=2/i);
    expect(t('tokenStreamHint')).not.toMatch(/five/i);
    expect(t('embeddingTensorHint')).not.toMatch(/five/i);
    expect(t('transformerTunnel')).not.toMatch(/40/);
    expect(t('decodeLoopHint')).not.toMatch(/five|four/i);
  });

  it('grows schematic completion text before switching to the exact final string', async () => {
    const result = render(GlobalFlow, {
      experience,
      progress: 0.9,
      locale: 'en',
      motion: 'full',
      onNavigate: vi.fn()
    });
    const partial = result.container.querySelector('.completion-text');
    const firstPartial = partial?.textContent;

    expect(partial).toHaveAttribute('data-text-fidelity', 'SCHEMATIC');
    await result.rerender({ experience, progress: 0.97, locale: 'en', motion: 'full', onNavigate: vi.fn() });
    expect(partial?.textContent?.length).toBeGreaterThan(firstPartial?.length ?? 0);
    expect(partial).toHaveAttribute('data-text-fidelity', 'SCHEMATIC');
    await result.rerender({ experience, progress: 1, locale: 'en', motion: 'full', onNavigate: vi.fn() });
    expect(partial).toHaveTextContent(experience.decode.finalText);
    expect(partial).toHaveAttribute('data-text-fidelity', 'EXACT');
  });

  it('disconnects geometry observers when the flow unmounts', () => {
    const { unmount } = render(GlobalFlow, {
      experience,
      progress: 0,
      locale: 'en',
      motion: 'full',
      onNavigate: vi.fn()
    });

    expect(observe).toHaveBeenCalledTimes(13);
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('guards the component against trace-fact constants and autonomous clocks', () => {
    const componentSource = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'GlobalFlow.svelte'), 'utf8');
    const cssSource = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../app.css'), 'utf8');
    const flowCss = cssSource.slice(
      cssSource.indexOf('.global-flow-experience'),
      cssSource.indexOf('.init-section')
    );

    expect(componentSource).not.toContain('[5, 2048]');
    expect(componentSource).not.toContain('[1, 248320]');
    expect(componentSource).not.toMatch(/const\s+tokens\s*=/);
    expect(componentSource).not.toMatch(/>TP0<|>TP1</);
    expect(componentSource).not.toMatch(/Math\.random|Date\.now|performance\.now|setInterval/);
    expect(flowCss).not.toMatch(/animation\s*:[^;]*infinite/);
  });
});
