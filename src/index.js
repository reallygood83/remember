import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initCard, schedule, shouldDecay, retrievability } from './fsrs.js';
import { hybridSearch } from './search.js';
import { findDuplicates, mergeMemories, consolidate as consolidateAll } from './merge.js';
import { createEmbedder } from './embed.js';
import { connectNewMemory, autoConnect } from './connect.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default class Remember {
  constructor(opts = {}) {
    const dbPath = opts.dbPath || ':memory:';
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    this.db.exec(schema);

    this.embedder = createEmbedder(opts.embedMode || 'none', opts.embedOpts || {});
    this.mergeThreshold = opts.mergeThreshold ?? 0.85;
  }

  async store(content, opts = {}) {
    const {
      category = 'general',
      tags = [],
      source = null,
      connections = [],
      dedupe = true,
    } = opts;

    // Check for duplicates
    if (dedupe) {
      const dupes = findDuplicates(this.db, content, this.mergeThreshold);
      if (dupes.length > 0) {
        const best = dupes[0];
        const result = mergeMemories(this.db, best.id, content, {
          strategy: 'supersede',
          newId: randomUUID(),
        });
        if (result?.action === 'superseded') {
          // Store the new version with a fresh ID, inheriting metadata from the best match
          return this._insert(content, {
            category: opts.category || best.category,
            tags: tags.length ? tags : JSON.parse(best.tags || '[]'),
            source,
            stability: best.stability,
            difficulty: best.difficulty,
          });
        }
      }
    }

    const mem = await this._insert(content, { category, tags, source });

    // Create explicit connections
    for (const conn of connections) {
      this.connect(mem.id, conn.id, conn.weight, conn.reason);
    }

    // Auto-connect based on shared keywords
    connectNewMemory(this.db, { id: mem.id, content, tags });

    return mem;
  }

  async _insert(content, opts = {}) {
    const id = opts.id || randomUUID();
    const card = initCard();
    const embedding = await this.embedder.embed(content);
    const tagsJson = JSON.stringify(opts.tags || []);
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO memories (id, content, category, tags, embedding, stability, difficulty,
        last_review, next_review, reps, lapses, state, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, content, opts.category || 'general', tagsJson,
      embedding ? JSON.stringify(embedding) : null,
      opts.stability ?? card.stability, opts.difficulty ?? card.difficulty,
      card.last_review, card.next_review,
      card.reps, card.lapses, card.state,
      opts.source || null, now, now
    );

    return { id, content, category: opts.category || 'general', tags: opts.tags || [] };
  }

  async recall(query, opts = {}) {
    const { limit = 10, category = null, minRetrievability = 0 } = opts;
    const embedding = await this.embedder.embed(query);

    let results = hybridSearch(this.db, query, {
      limit: limit * 2,
      embedding,
      useSpread: opts.spread !== false,
    });

    // Filter by category
    if (category) {
      results = results.filter(r => r.category === category);
    }

    // Compute retrievability and filter
    const now = new Date();
    results = results.map(r => {
      const elapsed = r.last_review
        ? (now - new Date(r.last_review)) / 86400000
        : 0;
      const ret = retrievability(r.stability, elapsed);
      return { ...r, retrievability: ret };
    });

    if (minRetrievability > 0) {
      results = results.filter(r => r.retrievability >= minRetrievability);
    }

    // Reinforce recalled memories
    for (const r of results.slice(0, limit)) {
      this.reinforce(r.id);
    }

    return results.slice(0, limit).map(r => ({
      id: r.id,
      content: r.content,
      category: r.category,
      tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags,
      retrievability: r.retrievability,
      rrf_score: r.rrf_score,
    }));
  }

  reinforce(id, rating = 3) {
    const mem = this.db.prepare(`SELECT * FROM memories WHERE id = ?`).get(id);
    if (!mem) return null;

    const updated = schedule(mem, rating);
    this.db.prepare(`
      UPDATE memories SET stability = ?, difficulty = ?, last_review = ?,
        next_review = ?, reps = ?, lapses = ?, state = ?, updated_at = ?
      WHERE id = ?
    `).run(
      updated.stability, updated.difficulty, updated.last_review,
      updated.next_review, updated.reps, updated.lapses, updated.state,
      new Date().toISOString(), id
    );

    return updated;
  }

  autoConnectAll(opts = {}) {
    return autoConnect(this.db, opts);
  }

  connect(fromId, toId, weight = 1.0, reason = null) {
    this.db.prepare(`
      INSERT OR REPLACE INTO connections (from_id, to_id, weight, reason)
      VALUES (?, ?, ?, ?)
    `).run(fromId, toId, weight, reason);
  }

  consolidate() {
    // Decay old memories
    const all = this.db.prepare(
      `SELECT * FROM memories WHERE superseded_by IS NULL`
    ).all();

    let decayed = 0;
    for (const mem of all) {
      if (shouldDecay(mem)) {
        this.db.prepare(`DELETE FROM memories WHERE id = ?`).run(mem.id);
        this.db.prepare(`DELETE FROM connections WHERE from_id = ? OR to_id = ?`)
          .run(mem.id, mem.id);
        decayed++;
      }
    }

    // Merge duplicates
    const mergeResult = consolidateAll(this.db);

    // Auto-connect all memories
    const connectResult = autoConnect(this.db, { pruneThreshold: 0.1 });

    return { decayed, ...mergeResult, connectionsCreated: connectResult.created };
  }

  stats() {
    const total = this.db.prepare(
      `SELECT COUNT(*) as count FROM memories WHERE superseded_by IS NULL`
    ).get().count;
    const byCategory = this.db.prepare(
      `SELECT category, COUNT(*) as count FROM memories
       WHERE superseded_by IS NULL GROUP BY category`
    ).all();
    const connections = this.db.prepare(
      `SELECT COUNT(*) as count FROM connections`
    ).get().count;
    const avgStability = this.db.prepare(
      `SELECT AVG(stability) as avg FROM memories WHERE superseded_by IS NULL`
    ).get().avg || 0;

    return { total, byCategory, connections, avgStability: Math.round(avgStability * 100) / 100 };
  }

  export(format = 'json') {
    const memories = this.db.prepare(
      `SELECT * FROM memories WHERE superseded_by IS NULL ORDER BY created_at`
    ).all();
    const connections = this.db.prepare(`SELECT * FROM connections`).all();

    if (format === 'json') {
      return JSON.stringify({ memories, connections }, null, 2);
    }

    // Markdown format
    let md = '# Memories\n\n';
    for (const m of memories) {
      const tags = JSON.parse(m.tags || '[]');
      md += `## ${m.category}: ${m.content.slice(0, 60)}\n`;
      md += `- **ID**: ${m.id}\n`;
      md += `- **Tags**: ${tags.join(', ') || 'none'}\n`;
      md += `- **Stability**: ${m.stability.toFixed(2)}\n`;
      md += `- **Created**: ${m.created_at}\n\n`;
      md += `${m.content}\n\n---\n\n`;
    }
    return md;
  }

  importFromMarkdown(filepath) {
    const content = readFileSync(filepath, 'utf-8');
    const blocks = content.split(/^---$/m).filter(b => b.trim());
    const results = [];

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      const headerMatch = lines[0]?.match(/^##?\s+(?:(\w+):\s+)?(.+)/);
      const category = headerMatch?.[1] || 'general';
      const body = lines.slice(1)
        .filter(l => !l.startsWith('- **'))
        .join('\n').trim();

      if (body) {
        results.push(this.store(body, { category, dedupe: true }));
      }
    }

    return Promise.all(results);
  }

  close() {
    this.db.close();
  }
}
