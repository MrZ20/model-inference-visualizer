import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runId = 'qwen35-a3b-w8a8-20260710-p4r4';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '../..');
const source = path.join(projectRoot, 'data', 'web', runId);
const destination = path.join(scriptDir, '..', 'static', 'traces', runId);

if (!existsSync(source)) {
  throw new Error(`Trace source is missing: ${source}`);
}

mkdirSync(destination, { recursive: true });
cpSync(source, destination, { recursive: true, force: true });
console.log(`Synced ${runId} to ${destination}`);
