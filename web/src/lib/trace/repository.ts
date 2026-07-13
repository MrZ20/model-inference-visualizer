export type ChapterId = 'init' | 'warmup' | 'prefill' | 'decode';

export interface TraceManifest {
  runId: string;
  eventCount: number;
  chapters: Record<ChapterId, number>;
  projections?: Record<string, string>;
  [key: string]: unknown;
}

export interface TraceSession {
  readonly manifest: TraceManifest;
  chapter<T = unknown>(id: ChapterId): Promise<T>;
  artifact<T = unknown>(path: string): Promise<T>;
}

export interface TraceRepository { open(runId: string): Promise<TraceSession>; }

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Trace request failed (${response.status}): ${url}`);
  return response.json() as Promise<T>;
}

class StaticTraceSession implements TraceSession {
  private cache = new Map<string, Promise<unknown>>();
  constructor(readonly manifest: TraceManifest, private readonly root: string) {}
  chapter<T>(id: ChapterId): Promise<T> {
    if (!(id in this.manifest.chapters)) throw new Error(`Chapter not found: ${id}`);
    return this.artifact<T>(`chapters/${id}.json`);
  }
  artifact<T>(path: string): Promise<T> {
    const normalized = path.replace(/^\.\//, '');
    if (!this.cache.has(normalized)) this.cache.set(normalized, loadJson<T>(`${this.root}/${normalized}`));
    return this.cache.get(normalized) as Promise<T>;
  }
}

export class StaticTraceRepository implements TraceRepository {
  constructor(private readonly baseUrl = '/traces') {}
  async open(runId: string): Promise<TraceSession> {
    const root = `${this.baseUrl}/${runId}`;
    return new StaticTraceSession(await loadJson<TraceManifest>(`${root}/manifest.json`), root);
  }
}

export class MemoryTraceRepository implements TraceRepository {
  constructor(private readonly manifests: Record<string, TraceManifest>, private readonly files: Record<string, unknown>) {}
  async open(runId: string): Promise<TraceSession> {
    const manifest = this.manifests[runId];
    if (!manifest) throw new Error(`Run not found: ${runId}`);
    const load = async <T>(path: string) => {
      const value = this.files[`${runId}/${path.replace(/^\.\//, '')}`];
      if (value === undefined) throw new Error(`Artifact not found: ${path}`);
      return value as T;
    };
    return { manifest, chapter: <T>(id: ChapterId) => load<T>(`chapters/${id}.json`), artifact: load };
  }
}
