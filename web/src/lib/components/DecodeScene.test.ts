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
            logitsShape: [1, 248320],
            topCandidates: [{ tokenId: 498, logit: 10.63 }]
          },
          {
            index: 1,
            tokenId: 7525,
            logitsShape: [1, 248320],
            topCandidates: [{ tokenId: 7525, logit: 15.38 }]
          }
        ]
      },
      progress: 0.55,
      locale: 'en'
    });

    expect(container.querySelector('.decode-logits')).toHaveTextContent('498');
    expect(container.querySelector('.decode-logits')).not.toHaveTextContent('7525');
    expect(container.querySelector('.decode-sample strong')).toHaveTextContent('498');
  });
});
