# 🧠 Remember — Cognitive Memory for AI Agents

> **Give your AI assistant a memory that works like yours.**

[![GitHub](https://img.shields.io/badge/GitHub-reallygood83-181717?logo=github)](https://github.com/reallygood83)
[![YouTube](https://img.shields.io/badge/YouTube-배움의_달인-FF0000?logo=youtube)](https://youtube.com/@reallygood83)
[![X](https://img.shields.io/badge/X-@reallygood83-000000?logo=x)](https://x.com/reallygood83)

---

## Why?

Current AI assistants load their entire memory (thousands of tokens) every session. It's like re-reading your entire diary from page 1 before answering a question.

**Remember** changes this:
- ✅ **Load only what you need** — 97.6% token reduction
- ✅ **Auto-forget the unimportant** — FSRS forgetting curve
- ✅ **Find related memories** — spreading activation search
- ✅ **Zero dependencies** — just `better-sqlite3`

---

## Features

| Feature | How | Benefit |
|---------|-----|---------|
| **FSRS Forgetting Curve** | Memories decay naturally if not reinforced | Auto-cleanup, stay focused on what matters |
| **BM25 + Hybrid Search** | Keyword + spreading activation + optional vectors | Fast, accurate recall without embeddings |
| **Dual Auto-Connect** | Keyword co-occurrence + Cerebras LLM entity extraction | Rich relationship graph, automatically built |
| **Duplicate Merge** | Trigram Jaccard similarity ≥ 0.85 | No memory bloat |

---

## Installation

```bash
npm install @reallygood/remember
```

Or clone and use directly:
```bash
git clone https://github.com/reallygood83/remember.git
cd remember && npm install
```

---

## Quick Start

```javascript
import Remember from '@reallygood/remember';

const mem = new Remember({ dbPath: './memory.db' });

// Store a memory
await mem.store('Conway Trader runs on PM2 for process management', {
  category: 'project',
  tags: ['conway', 'pm2', 'trading']
});

// Recall — returns top matches with spreading activation
const results = mem.recall('Conway trading', { limit: 5 });
// → Finds "Conway Trader" AND related "PM2" memories via connections

// Reinforce — strengthen memory (like reviewing)
mem.reinforce(memoryId, { rating: 4 }); // 0-5 rating

// Consolidate — apply forgetting curve, clean weak memories
mem.consolidate();
```

---

## How It Works

### 1. Dual-Strategy Auto-Connect

When you store a memory, Remember automatically builds connections:

**Strategy A: Keyword Co-occurrence (Free, Instant)**
```
Memory A: "Conway uses PM2" → keywords: {conway, pm2}
Memory B: "PM2 process monitoring" → keywords: {pm2, monitoring}
                                          ↑
                                    Shared: "pm2" → AUTO-CONNECT
```

**Strategy B: Cerebras LLM Entity Extraction (Free, Async)**
```
Input: "Conway trades on OKX demo account using SWAP"

Cerebras Qwen3-235B:
→ entities: ["Conway", "OKX", "SWAP"]
→ relations: [["Conway", "uses", "OKX"], ["Conway", "trades", "SWAP"]]

→ Enhances connections with semantic understanding
```

### 2. FSRS Forgetting Curve

```
Day 0: Learn something new
  ↓
Day 3: Still 90% retrievable
  ↓
Day 7: 60% — time to reinforce! (search triggers this)
  ↓
Day 30: 20% — marked for cleanup (consolidate removes it)
```

### 3. Spreading Activation Search

```
Query: "Conway"

Direct Match (BM25):
  "Conway Trader runs on PM2" — score: 0.95

Spreading Activation (via connections):
  "PM2 process manager" — score: 0.72 (connected to Conway)
  "Kill switch script" — score: 0.68 (connected to Conway)
  "Trading reports cron" — score: 0.65 (connected to Conway)
```

---

## Benchmarks (Measured)

Tested on a real AI assistant with 493-line MEMORY.md (14,460 tokens):

| Metric | Before (Full Load) | After (Remember) | Improvement |
|--------|-------------------|------------------|-------------|
| **Tokens/session** | 14,460 | 344 | **97.6% reduction** |
| **Cost (Claude Opus)** | $130.14/month | $3.10/month | **$127 saved** |
| **Search speed** | ~2-3s (file parse) | ~10ms (SQLite) | **200x faster** |

**Real application:** 347 memories, 2,690 connections (avg 7.7 connections/memory)

---

## Scientific Backing

| Claim | Evidence |
|-------|----------|
| FSRS reduces reviews 20-30% | [FSRS Benchmark](https://github.com/open-spaced-repetition/fsrs-benchmark) — official Anki integration |
| BM25 + vectors reduce failures 49% | [Anthropic Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval) (2024) |
| RAG is 1,250x cheaper than full-context | [Elasticsearch Labs](https://www.elastic.co/search-labs) benchmark |
| Spreading activation models human memory | [Wikipedia: Spreading Activation](https://en.wikipedia.org/wiki/Spreading_activation) |

---

## OpenClaw Integration

Remember includes an OpenClaw skill for seamless agent integration:

```bash
# After installation
node skill/scripts/setup.js

# Store from CLI
node skill/scripts/remember.js store "Important fact" --category fact --tags "tag1,tag2"

# Recall
node skill/scripts/remember.js recall "search query" --limit 5

# Consolidate daily (add to your cron)
node skill/scripts/remember.js consolidate
```

See `skill/SKILL.md` for full agent behavior rules.

---

## Architecture

```
remember/
├── src/
│   ├── index.js      # Main Remember class
│   ├── fsrs.js       # Forgetting curve math
│   ├── search.js     # BM25 + spreading activation
│   ├── connect.js    # Dual-strategy auto-connect ⭐
│   ├── merge.js      # Duplicate detection & merging
│   └── embed.js      # Optional embedding providers
├── skill/            # OpenClaw skill integration
└── test/             # 19 test suites

Dependencies: better-sqlite3 (only one!)
Lines of code: ~800 (core)
```

---

## Comparison with Alternatives

| Feature | Remember | mem0 | Letta | Zep |
|---------|----------|------|-------|-----|
| **Self-hostable** | ✅ | ⚠️ Cloud | ✅ | ⚠️ Cloud |
| **Dependencies** | 1 (sqlite) | Many | Many | Many |
| **Install size** | ~2MB | ~100MB+ | ~50MB+ | ~100MB+ |
| **Cost** | Free (Cerebras tier) | Paid API | Open | Paid |
| **FSRS** | ✅ | ❌ | ❌ | ❌ |
| **Auto-connect** | ✅ Dual | ✅ | ⚠️ | ✅ |
| **Code size** | ~800 LOC | 10k+ | 10k+ | 10k+ |

**Remember is for:** People who want a lightweight, understandable, self-hosted memory system.

**Others are for:** Enterprise users who need managed services.

---

## Roadmap

- [x] v0.1 — Core system (FSRS, BM25, merge)
- [x] v0.2 — Dual auto-connect (keyword + LLM)
- [ ] v0.3 — Multi-agent shared memory
- [ ] v0.4 — ClawHub distribution
- [ ] v1.0 — Production ready with comprehensive docs

---

## License

MIT — Built with ❤️ by [@reallygood83](https://github.com/reallygood83)

---

## Connect

[![YouTube](https://img.shields.io/badge/Watch_on_YouTube-FF0000?logo=youtube&logoColor=white&style=for-the-badge)](https://youtube.com/@reallygood83)
[![X](https://img.shields.io/badge/Follow_on_X-000000?logo=x&logoColor=white&style=for-the-badge)](https://x.com/reallygood83)
[![GitHub](https://img.shields.io/badge/Star_on_GitHub-181717?logo=github&logoColor=white&style=for-the-badge)](https://github.com/reallygood83/remember)

---

*"Memory is the diary that we all carry about with us." — Oscar Wilde*

*Let's give AI agents a diary that actually works.* 🧠
