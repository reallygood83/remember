// Multi-provider embedding support
// Modes: none (default, BM25 only), cerebras, ollama, openai

export function createEmbedder(mode = 'none', opts = {}) {
  switch (mode) {
    case 'none':
      return { embed: async () => null, dim: 0 };

    case 'openai':
      return {
        dim: 1536,
        async embed(text) {
          try {
            const res = await fetch('https://api.openai.com/v1/embeddings', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${opts.apiKey || process.env.OPENAI_API_KEY}`,
              },
              body: JSON.stringify({
                model: opts.model || 'text-embedding-3-small',
                input: text,
              }),
            });
            if (!res.ok) {
              if (process.env.DEBUG) console.warn(`[remember] OpenAI embedding failed: ${res.status} ${res.statusText}`);
              return null;
            }
            const data = await res.json();
            return data.data?.[0]?.embedding || null;
          } catch (e) {
            if (process.env.DEBUG) console.warn(`[remember] OpenAI embedding error: ${e.message}`);
            return null;
          }
        },
      };

    case 'ollama':
      return {
        dim: opts.dim || 768,
        async embed(text) {
          try {
            const res = await fetch(`${opts.baseUrl || 'http://localhost:11434'}/api/embeddings`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: opts.model || 'nomic-embed-text',
                prompt: text,
              }),
            });
            if (!res.ok) {
              if (process.env.DEBUG) console.warn(`[remember] Ollama embedding failed: ${res.status} ${res.statusText}`);
              return null;
            }
            const data = await res.json();
            return data.embedding || null;
          } catch (e) {
            if (process.env.DEBUG) console.warn(`[remember] Ollama embedding error: ${e.message}`);
            return null;
          }
        },
      };

    case 'cerebras':
      return {
        dim: opts.dim || 1024,
        async embed(text) {
          try {
            const res = await fetch(`${opts.baseUrl || 'https://api.cerebras.ai/v1'}/embeddings`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${opts.apiKey || process.env.CEREBRAS_API_KEY}`,
              },
              body: JSON.stringify({
                model: opts.model || 'cerebras-embed-1',
                input: text,
              }),
            });
            if (!res.ok) {
              if (process.env.DEBUG) console.warn(`[remember] Cerebras embedding failed: ${res.status} ${res.statusText}`);
              return null;
            }
            const data = await res.json();
            return data.data?.[0]?.embedding || null;
          } catch (e) {
            if (process.env.DEBUG) console.warn(`[remember] Cerebras embedding error: ${e.message}`);
            return null;
          }
        },
      };

    default:
      return { embed: async () => null, dim: 0 };
  }
}
