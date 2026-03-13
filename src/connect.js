/**
 * Auto-connect: 기억 간 연결 자동 생성
 * 전략 1: 키워드 동시 등장 (무료, 즉시)
 * 전략 2: Cerebras LLM 엔티티 추출 (무료, 비동기)
 */

const STOPWORDS_KO = new Set(['은','는','이','가','을','를','의','에','에서','로','와','과','하고','한다','있다','되다','것','수','등','및','또는','그','저','더','도','만','까지','하는','된다','위해','통해','대한','같은','이런','그런','때','중','후','전','간','내','외','위','아래','모든','각','매']);
const STOPWORDS_EN = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','for','and','or','but','in','on','at','to','from','by','with','of','not','no','if','then','than','that','this','it','its','as','so','up','out','about','into','over','after','before','between','under','again','further','once','here','there','when','where','why','how','all','both','each','few','more','most','other','some','such','only','own','same','too','very','just']);

// 한국어 조사 패턴 (단어 끝에 붙는 것)
const KO_SUFFIXES = /(?:은|는|이|가|을|를|의|에|에서|로|으로|와|과|도|만|까지|부터|에게|한테|보다|처럼|같이|마다|이나|이라|라서)$/;

/** 텍스트에서 키워드 추출 */
export function extractKeywords(text) {
  if (!text) return new Set();
  return new Set(
    text.toLowerCase()
      .replace(/[`\'\'"()\[\]{}<>:\/\\]/g, ' ')
      .replace(/[^\w\sㄱ-ㅎ가-힣-]/g, ' ')
      .split(/\s+/)
      .map(w => w.replace(KO_SUFFIXES, ''))  // 조사 제거
      .filter(w => w.length >= 2)
      .filter(w => !STOPWORDS_KO.has(w) && !STOPWORDS_EN.has(w))
      .filter(w => !/^\d+$/.test(w))
  );
}

/** 새 기억 저장 시 기존 기억과 연결 (store 시 호출) */
export function connectNewMemory(db, { id, content, tags }) {
  const memories = db.prepare(
    'SELECT id, content, tags FROM memories WHERE superseded_by IS NULL AND id != ?'
  ).all(id);

  const sourceKw = extractKeywords(content);
  if (tags) {
    (Array.isArray(tags) ? tags : []).forEach(t => sourceKw.add(t.toLowerCase()));
  }
  if (sourceKw.size === 0) return { created: 0 };

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO connections (from_id, to_id, weight)
    VALUES (?, ?, ?)
  `);

  const candidates = new Map();
  for (const mem of memories) {
    const targetKw = extractKeywords(mem.content);
    if (mem.tags) {
      try {
        const t = JSON.parse(mem.tags);
        if (Array.isArray(t)) t.forEach(x => targetKw.add(x.toLowerCase()));
      } catch (e) { /* tags JSON parse failed for memory ${mem.id} */ }
    }
    let shared = 0;
    for (const k of sourceKw) { if (targetKw.has(k)) shared++; }
    if (shared === 0) continue;
    const unionSize = new Set([...sourceKw, ...targetKw]).size;
    candidates.set(mem.id, shared / unionSize);
  }

  // 상위 10개만
  let created = 0;
  const sorted = [...candidates.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [targetId, weight] of sorted) {
    if (weight < 0.05) continue;
    try { upsert.run(id, targetId, Math.round(weight * 100) / 100); created++; } catch (e) {
      if (process.env.DEBUG) console.warn(`[remember] connectNewMemory upsert failed: ${e.message}`);
    }
  }
  return { created };
}

/** 전체 기억 재스캔 + 연결 생성 (consolidate 시 호출) */
export function autoConnect(db, opts = {}) {
  const { pruneThreshold = 0.05, dryRun = false } = opts;
  
  if (!dryRun) {
    // 기존 약한 연결 정리
    db.prepare('DELETE FROM connections WHERE weight < ?').run(pruneThreshold);
  }

  const memories = db.prepare(
    'SELECT id, content, tags FROM memories WHERE superseded_by IS NULL'
  ).all();

  const keywordIndex = new Map();
  const memKeywords = new Map();

  for (const mem of memories) {
    const kw = extractKeywords(mem.content);
    if (mem.tags) {
      try {
        const t = JSON.parse(mem.tags);
        if (Array.isArray(t)) t.forEach(x => kw.add(x.toLowerCase()));
      } catch (e) { /* tags JSON parse failed for memory ${mem.id} */ }
    }
    memKeywords.set(mem.id, kw);
    for (const k of kw) {
      if (!keywordIndex.has(k)) keywordIndex.set(k, new Set());
      keywordIndex.get(k).add(mem.id);
    }
  }

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO connections (from_id, to_id, weight) VALUES (?, ?, ?)
  `);

  let created = 0;
  for (const mem of memories) {
    const sourceKw = memKeywords.get(mem.id);
    if (!sourceKw || sourceKw.size === 0) continue;

    const candidates = new Map();
    for (const kw of sourceKw) {
      const targets = keywordIndex.get(kw);
      if (!targets) continue;
      for (const tid of targets) {
        if (tid === mem.id) continue;
        candidates.set(tid, (candidates.get(tid) || 0) + 1);
      }
    }

    const sorted = [...candidates.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [targetId, shared] of sorted) {
      const targetKw = memKeywords.get(targetId);
      const unionSize = new Set([...sourceKw, ...targetKw]).size;
      const weight = Math.round(Math.min(shared / unionSize, 1.0) * 100) / 100;
      if (weight < pruneThreshold) continue;
      if (dryRun) { created++; continue; }
      try { upsert.run(mem.id, targetId, weight); created++; } catch (e) {
        if (process.env.DEBUG) console.warn(`[remember] autoConnect upsert failed: ${e.message}`);
      }
    }
  }
  if (dryRun) {
    return { created: 0, total: created, preview: true };
  }
  const totalConn = db.prepare('SELECT COUNT(*) as c FROM connections').get().c;
  return { created, total: totalConn };
}

/** Cerebras LLM으로 엔티티+관계 추출 (전략 2) */
export async function extractWithLLM(content, apiKey = null) {
  const key = apiKey || process.env.CEREBRAS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'qwen-3-235b-a22b-instruct-2507',
        messages: [
          { role: 'system', content: 'Extract entities and relations. Return ONLY JSON: {"entities":["e1","e2"],"relations":[["e1","rel","e2"]]}\nMax 5 each. No explanation. No markdown.' },
          { role: 'user', content }
        ],
        max_tokens: 300, temperature: 0
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    const jsonStr = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
    return JSON.parse(jsonStr);
  } catch { return null; }
}

/** LLM 결과로 connection 강화 */
export async function enhanceWithLLM(db, memoryId, content) {
  const result = await extractWithLLM(content);
  if (!result?.entities) return { enhanced: 0 };

  const upsert = db.prepare(`
    INSERT INTO connections (from_id, to_id, weight) VALUES (?, ?, ?)
    ON CONFLICT(from_id, to_id) DO UPDATE SET weight = MAX(connections.weight, excluded.weight)
  `);

  let enhanced = 0;
  for (const entity of result.entities) {
    try {
      const matches = db.prepare(
        'SELECT rowid FROM memories_fts WHERE memories_fts MATCH ? LIMIT 5'
      ).all(entity);
      for (const match of matches) {
        const mem = db.prepare(
          'SELECT id FROM memories WHERE rowid = ? AND id != ? AND superseded_by IS NULL'
        ).get(match.rowid, memoryId);
        if (!mem) continue;
        upsert.run(memoryId, mem.id, 0.7);
        enhanced++;
      }
    } catch (e) {
      if (process.env.DEBUG) console.warn(`[remember] enhanceWithLLM FTS match failed: ${e.message}`);
    }
  }
  return { enhanced, entities: result.entities, relations: result.relations || [] };
}
