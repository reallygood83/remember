// BM25 + Vector + Spreading Activation + RRF hybrid search

export function bm25Search(db, query, limit = 20) {
  const stmt = db.prepare(`
    SELECT m.*, fts.rank AS bm25_score
    FROM memories_fts fts
    JOIN memories m ON m.rowid = fts.rowid
    WHERE memories_fts MATCH ?
      AND m.superseded_by IS NULL
    ORDER BY fts.rank
    LIMIT ?
  `);
  try {
    return stmt.all(query, limit);
  } catch (e) {
    if (process.env.DEBUG) console.warn(`[remember] bm25Search failed: ${e.message}`);
    return [];
  }
}

export function vectorSearch(memories, queryEmbedding, limit = 20) {
  if (!queryEmbedding || !memories.length) return [];
  return memories
    .map(m => {
      if (!m.embedding) return null;
      const emb = JSON.parse(m.embedding);
      const score = cosineSimilarity(queryEmbedding, emb);
      return { ...m, vector_score: score };
    })
    .filter(Boolean)
    .sort((a, b) => b.vector_score - a.vector_score)
    .slice(0, limit);
}

export function spreadingActivation(db, seedIds, depth = 2, decayFactor = 0.5) {
  const activation = new Map();
  let frontier = seedIds.map(id => [id, 1.0]);

  for (let d = 0; d < depth; d++) {
    const nextFrontier = [];
    for (const [nodeId, energy] of frontier) {
      const conns = db.prepare(
        `SELECT to_id, weight FROM connections WHERE from_id = ?
         UNION
         SELECT from_id, weight FROM connections WHERE to_id = ?`
      ).all(nodeId, nodeId);

      for (const conn of conns) {
        const targetId = conn.to_id || conn.from_id;
        const spread = energy * conn.weight * decayFactor;
        const current = activation.get(targetId) || 0;
        activation.set(targetId, current + spread);
        nextFrontier.push([targetId, spread]);
      }
    }
    frontier = nextFrontier;
  }

  return activation;
}

export function rrfFuse(rankedLists, k = 60) {
  const scores = new Map();

  for (const list of rankedLists) {
    for (let i = 0; i < list.length; i++) {
      const id = list[i].id;
      const current = scores.get(id) || { score: 0, item: list[i] };
      current.score += 1 / (k + i + 1);
      scores.set(id, current);
    }
  }

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .map(({ item, score }) => ({ ...item, rrf_score: score }));
}

export function hybridSearch(db, query, opts = {}) {
  const { limit = 10, embedding = null, useSpread = true } = opts;

  // BM25 results
  const bm25Results = bm25Search(db, query, limit * 2);
  const rankedLists = [bm25Results];

  // Vector search (if embedding provided)
  if (embedding) {
    const allMemories = db.prepare(
      `SELECT * FROM memories WHERE superseded_by IS NULL AND embedding IS NOT NULL`
    ).all();
    const vecResults = vectorSearch(allMemories, embedding, limit * 2);
    rankedLists.push(vecResults);
  }

  // Spreading activation
  if (useSpread && bm25Results.length > 0) {
    const seedIds = bm25Results.slice(0, 3).map(r => r.id);
    const activation = spreadingActivation(db, seedIds);

    if (activation.size > 0) {
      const activated = Array.from(activation.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit * 2)
        .map(([id, score]) => {
          const mem = db.prepare(`SELECT * FROM memories WHERE id = ?`).get(id);
          return mem ? { ...mem, spread_score: score } : null;
        })
        .filter(Boolean);
      rankedLists.push(activated);
    }
  }

  return rrfFuse(rankedLists, 60).slice(0, limit);
}

function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
