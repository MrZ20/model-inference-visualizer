import { describe, expect, it } from 'vitest';
import { normalize, projectMatrix, stageProgress, topEntries } from './projector';
describe('scene projector', () => {
  it('projects and ranks', () => { expect(projectMatrix([[1, 2], [3, 4]])).toHaveLength(4); expect(topEntries([.1, .9, .4], 2).map(x => x.index)).toEqual([1, 2]); });
  it('normalizes and stages', () => { expect(normalize([7, 7])).toEqual([.5, .5]); expect(stageProgress(.3, 1, 4)).toBeCloseTo(.2); });
});
