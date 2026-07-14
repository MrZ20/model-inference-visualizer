// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import DecodeScene from './DecodeScene.svelte';

afterEach(cleanup);

describe('DecodeScene', () => {
  it('keeps the logits and selected token on the same completed decision', () => {
    const { container } = render(DecodeScene, {
      decode: {
        prompt: 'Hello, my name is',
        finalText: 'Hello, my name is [Your Name], and',
        completion: ' [Your Name], and',
        fidelity: 'EXACT',
        steps: [
          {
            index: 0,
            tokenId: 498,
            sourcePhase: 'prefill',
            logicalStepIndex: 0,
            logitsShape: [1, 248320],
            topCandidates: [{ tokenId: 498, logit: 10.63 }],
            logitsFidelity: 'SUMMARY',
            selectionFidelity: 'EXACT'
          },
          {
            index: 1,
            tokenId: 7525,
            sourcePhase: 'decode',
            logicalStepIndex: 1,
            logitsShape: [1, 248320],
            topCandidates: [{ tokenId: 7525, logit: 15.38 }],
            logitsFidelity: 'SUMMARY',
            selectionFidelity: 'EXACT'
          }
        ]
      },
      progress: 0.55,
      locale: 'en'
    });

    expect(container.querySelector('.decode-logits')).toHaveTextContent('498');
    expect(container.querySelector('.decode-logits')).not.toHaveTextContent('7525');
    expect(container.querySelector('.decode-sample strong')).toHaveTextContent('498');
    expect(container.querySelectorAll('.decode-cache i.filled')).toHaveLength(0);
    expect(container.querySelector('.decode-steps article:first-child')).toHaveTextContent('Prefill selection');
  });

  it('fills KV reuse only for decode passes after the prefill selection', () => {
    const { container } = render(DecodeScene, {
      decode: {
        prompt: 'Hello, my name is',
        finalText: 'Hello, my name is [Your Name], and',
        completion: ' [Your Name], and',
        fidelity: 'EXACT',
        steps: [
          {
            index: 0,
            tokenId: 498,
            sourcePhase: 'prefill',
            logicalStepIndex: 0,
            logitsShape: [1, 248320],
            topCandidates: [{ tokenId: 498, logit: 10.63 }],
            logitsFidelity: 'SUMMARY',
            selectionFidelity: 'EXACT'
          },
          {
            index: 1,
            tokenId: 7525,
            sourcePhase: 'decode',
            logicalStepIndex: 1,
            logitsShape: [1, 248320],
            topCandidates: [{ tokenId: 7525, logit: 15.38 }],
            logitsFidelity: 'SUMMARY',
            selectionFidelity: 'EXACT'
          }
        ]
      },
      progress: 1,
      locale: 'en'
    });

    expect(container.querySelectorAll('.decode-cache i')).toHaveLength(1);
    expect(container.querySelectorAll('.decode-cache i.filled')).toHaveLength(1);
    expect(container.querySelector('.decode-steps article:nth-child(2)')).toHaveTextContent('Decode 1');
  });
});
