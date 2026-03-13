// Example: OpenClaw agent integration with Remember
import Remember from '../src/index.js';

const mem = new Remember({
  dbPath: './agent-memory.db',
  embedMode: 'none', // BM25 only, zero dependencies
  mergeThreshold: 0.85,
});

// Agent stores observations during conversation
await mem.store('사용자는 한국어와 영어를 혼용한다', {
  category: 'user',
  tags: ['language', 'preference'],
  source: 'conversation-001',
});

await mem.store('User prefers concise answers without filler', {
  category: 'feedback',
  tags: ['style', 'preference'],
  source: 'conversation-001',
});

await mem.store('프로젝트는 ESM + SQLite 스택을 사용중', {
  category: 'project',
  tags: ['tech-stack'],
  source: 'conversation-002',
});

// Connect related memories
const prefs = await mem.recall('user preferences');
if (prefs.length >= 2) {
  mem.connect(prefs[0].id, prefs[1].id, 0.8, 'same user preferences');
}

// Later: agent recalls relevant context
const context = await mem.recall('사용자 언어 선호도', { limit: 3 });
console.log('Recalled context:', context);

// Periodic maintenance
const result = mem.consolidate();
console.log('Consolidation:', result);

// Stats
console.log('Memory stats:', mem.stats());

mem.close();
