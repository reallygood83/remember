import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Remember from '../src/index.js';
import { initCard, schedule, retrievability, shouldDecay } from '../src/fsrs.js';

describe('FSRS', () => {
  it('should initialize a card', () => {
    const card = initCard();
    assert.equal(card.stability, 1.0);
    assert.equal(card.difficulty, 0.3);
    assert.equal(card.reps, 0);
    assert.equal(card.state, 0);
  });

  it('should compute retrievability', () => {
    assert.equal(retrievability(1.0, 0), 1.0);
    const r = retrievability(5.0, 5);
    assert.ok(r > 0 && r < 1, `retrievability should be between 0 and 1, got ${r}`);
  });

  it('should schedule a review', () => {
    const card = initCard();
    const updated = schedule(card, 3);
    assert.ok(updated.stability > 0);
    assert.ok(updated.reps === 1);
    assert.ok(updated.last_review);
    assert.ok(updated.next_review);
  });

  it('should detect decay', () => {
    const mem = {
      next_review: new Date(Date.now() - 365 * 86400000).toISOString(),
      stability: 1.0,
    };
    assert.ok(shouldDecay(mem));
  });

  it('should not decay fresh memory', () => {
    const mem = {
      next_review: new Date(Date.now() + 86400000).toISOString(),
      stability: 5.0,
    };
    assert.ok(!shouldDecay(mem));
  });
});

describe('Remember', () => {
  let mem;

  before(() => {
    mem = new Remember({ dbPath: ':memory:' });
  });

  after(() => {
    mem.close();
  });

  it('should store and recall a memory', async () => {
    await mem.store('JavaScript는 프로토타입 기반 언어다', {
      category: 'knowledge',
      tags: ['javascript', 'programming'],
    });

    const results = await mem.recall('JavaScript 프로토타입');
    assert.ok(results.length > 0, 'should find at least one result');
    assert.ok(results[0].content.includes('프로토타입'));
  });

  it('should store multiple memories and search', async () => {
    await mem.store('React uses virtual DOM for efficient rendering', {
      category: 'frontend',
      tags: ['react'],
    });
    await mem.store('Vue.js also uses virtual DOM but with reactivity system', {
      category: 'frontend',
      tags: ['vue'],
    });
    await mem.store('SQLite is an embedded database engine', {
      category: 'database',
      tags: ['sqlite'],
    });

    const results = await mem.recall('virtual DOM', { category: 'frontend' });
    assert.ok(results.length > 0);
    assert.ok(results.every(r => r.category === 'frontend'));
  });

  it('should reinforce a memory', async () => {
    const stored = await mem.store('Node.js runs on V8 engine', { category: 'runtime' });
    const updated = mem.reinforce(stored.id, 4);
    assert.ok(updated);
    assert.ok(updated.reps === 1);
    assert.ok(updated.stability > 1.0);
  });

  it('should create connections between memories', async () => {
    const m1 = await mem.store('HTTP is stateless protocol', { category: 'network' });
    const m2 = await mem.store('REST APIs use HTTP methods', { category: 'network' });
    mem.connect(m1.id, m2.id, 0.9, 'related protocols');

    const stats = mem.stats();
    assert.ok(stats.connections > 0);
  });

  it('should consolidate memories', async () => {
    const result = mem.consolidate();
    assert.ok(typeof result.merged === 'number');
    assert.ok(typeof result.decayed === 'number');
    assert.ok(typeof result.active === 'number');
  });

  it('should export as JSON', () => {
    const exported = mem.export('json');
    const data = JSON.parse(exported);
    assert.ok(Array.isArray(data.memories));
    assert.ok(Array.isArray(data.connections));
  });

  it('should export as markdown', () => {
    const exported = mem.export('markdown');
    assert.ok(exported.includes('# Memories'));
  });

  it('should report stats', () => {
    const s = mem.stats();
    assert.ok(typeof s.total === 'number');
    assert.ok(s.total > 0);
    assert.ok(Array.isArray(s.byCategory));
    assert.ok(typeof s.connections === 'number');
    assert.ok(typeof s.avgStability === 'number');
  });
});
