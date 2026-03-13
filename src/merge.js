// Duplicate detection and memory merging

export function findDuplicates(db, content, threshold = 0.85) {
  // Use BM25 score to find potential duplicates
  const candidates = [];
  try {
    const results = db.prepare(`
      SELECT m.*, fts.rank AS score
      FROM memories_fts fts
      JOIN memories m ON m.rowid = fts.rowid
      WHERE memories_fts MATCH ?
        AND m.superseded_by IS NULL
      ORDER BY fts.rank
      LIMIT 10
    `).all(content);

    for (const r of results) {
      const sim = textSimilarity(content, r.content);
      if (sim >= threshold) {
        candidates.push({ ...r, similarity: sim });
      }
    }
  } catch (e) {
    // FTS match can fail on special chars — not a hard error
    if (process.env.DEBUG) console.warn(`[remember] findDuplicates FTS match failed: ${e.message}`);
  }
  return candidates;
}

export function mergeMemories(db, existingId, newContent, opts = {}) {
  const existing = db.prepare(`SELECT * FROM memories WHERE id = ?`).get(existingId);
  if (!existing) return null;

  const merged = opts.strategy === 'supersede'
    ? newContent
    : `${existing.content}\n---\n${newContent}`;

  const now = new Date().toISOString();

  if (opts.strategy === 'supersede') {
    // Mark old as superseded, create new
    db.prepare(`UPDATE memories SET superseded_by = ?, updated_at = ? WHERE id = ?`)
      .run(opts.newId, now, existingId);
    return { action: 'superseded', oldId: existingId, content: merged };
  }

  // Default: append/merge into existing
  db.prepare(`UPDATE memories SET content = ?, updated_at = ? WHERE id = ?`)
    .run(merged, now, existingId);
  return { action: 'merged', id: existingId, content: merged };
}

export function consolidate(db) {
  const active = db.prepare(
    `SELECT * FROM memories WHERE superseded_by IS NULL ORDER BY created_at`
  ).all();

  let mergeCount = 0;
  const seen = new Set();

  for (const mem of active) {
    if (seen.has(mem.id)) continue;

    const dupes = findDuplicates(db, mem.content, 0.85)
      .filter(d => d.id !== mem.id && !seen.has(d.id));

    for (const dupe of dupes) {
      mergeMemories(db, dupe.id, mem.content, {
        strategy: 'supersede',
        newId: mem.id,
      });
      seen.add(dupe.id);
      mergeCount++;
    }
  }

  return { merged: mergeCount, active: active.length - mergeCount };
}

// Simple token-based similarity (Jaccard on trigrams)
function textSimilarity(a, b) {
  const trigramsA = trigrams(a.toLowerCase());
  const trigramsB = trigrams(b.toLowerCase());
  const setA = new Set(trigramsA);
  const setB = new Set(trigramsB);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function trigrams(text) {
  const t = [];
  for (let i = 0; i <= text.length - 3; i++) {
    t.push(text.slice(i, i + 3));
  }
  return t;
}
