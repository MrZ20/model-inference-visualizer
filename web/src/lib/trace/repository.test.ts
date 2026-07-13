import { describe, expect, it } from 'vitest';
import { MemoryTraceRepository, type TraceManifest } from './repository';
const manifest: TraceManifest = { runId: 'demo', eventCount: 4, chapters: { init: 1, warmup: 1, prefill: 1, decode: 1 } };
describe('MemoryTraceRepository', () => {
  it('resolves chapter data', async () => {
    const session = await new MemoryTraceRepository({ demo: manifest }, { 'demo/chapters/init.json': { phase: 'init' } }).open('demo');
    await expect(session.chapter('init')).resolves.toEqual({ phase: 'init' });
  });
  it('reports missing runs', async () => { await expect(new MemoryTraceRepository({}, {}).open('x')).rejects.toThrow('Run not found'); });
});
