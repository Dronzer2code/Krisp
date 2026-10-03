import type { FeatureExtractionPipeline } from '@huggingface/transformers';
import type { ModelStatus } from './magenta';

// docs/TRD.md → Embeddings (VERIFY-4). all-MiniLM-L6-v2 runs in the browser; loaded lazily on first
// Create / Upload / Search and cached. Output: 384-d, mean-pooled, L2-normalized.

export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

let extractor: Promise<FeatureExtractionPipeline> | null = null;
let status: ModelStatus = 'NotLoaded';
const listeners = new Set<() => void>();

function setStatus(s: ModelStatus) {
  status = s;
  listeners.forEach((cb) => cb());
}

export function getEmbedStatus(): ModelStatus {
  return status;
}

export function subscribeEmbedStatus(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function load(): Promise<FeatureExtractionPipeline> {
  if (!extractor) {
    setStatus('Loading');
    extractor = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.allowLocalModels = false; // fetch from the Hugging Face Hub, never from same-origin /models
      // Cast through unknown: the generic pipeline() union type is too complex for tsc to resolve.
      const make = pipeline as unknown as (task: 'feature-extraction', model: string, opts: { dtype: 'q8' }) => Promise<FeatureExtractionPipeline>;
      const p = await make('feature-extraction', EMBEDDING_MODEL, { dtype: 'q8' }); // quantized ONNX (~23 MB)
      setStatus('Ready');
      return p;
    })().catch((err) => {
      extractor = null;
      setStatus('Failed');
      throw err;
    });
  }
  return extractor;
}

export async function embed(text: string): Promise<number[]> {
  const p = await load();
  const out = await p(text, { pooling: 'mean', normalize: true });
  return Array.from(out.data as Float32Array);
}

/** Embedding text for any Sound (docs/TRD.md): `${name}. ${prompt ?? ''}. ${tags.join(' ')}` */
export function soundEmbeddingText(name: string, prompt: string | null | undefined, tags: string[]): string {
  return `${name}. ${prompt ?? ''}. ${tags.join(' ')}`;
}
