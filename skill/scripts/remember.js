#!/usr/bin/env node

// Remember CLI wrapper for OpenClaw skill
// Usage: node remember.js <command> [args] [--options]
// Commands: store, recall, consolidate, stats, export, import, reinforce
// DB path: REMEMBER_DB_PATH env or ~/.remember/memory.db

import Remember from '../../src/index.js';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const command = args[0];

// Default DB path: ~/.remember/memory.db
const defaultDbDir = join(homedir(), '.remember');
const defaultDbPath = join(defaultDbDir, 'memory.db');
const dbPath = process.env.REMEMBER_DB_PATH || defaultDbPath;

// Ensure DB directory exists
const dbDir = resolve(dbPath, '..');
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

if (!command || command === '--help' || command === '-h') {
  console.log(`remember - cognitive memory for AI agents (OpenClaw skill)

Usage:
  remember store <content> [--category <cat>] [--tags <t1,t2>] [--source <src>]
  remember recall <query> [--limit <n>] [--category <cat>]
  remember reinforce <id> [--rating <1-4>]
  remember stats
  remember consolidate
  remember export [--format json|markdown]
  remember import <filepath>

Environment:
  REMEMBER_DB_PATH  Path to SQLite database (default: ~/.remember/memory.db)
  REMEMBER_EMBED    Embedding mode: none|openai|ollama|cerebras`);
  process.exit(0);
}

const mem = new Remember({
  dbPath,
  embedMode: process.env.REMEMBER_EMBED || 'none',
});

function parseFlag(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
}

try {
  switch (command) {
    case 'store': {
      const content = args[1];
      if (!content) {
        console.error('Usage: remember store <content> [--category <cat>] [--tags <t1,t2>]');
        process.exit(1);
      }
      const category = parseFlag('--category');
      const tagsStr = parseFlag('--tags');
      const source = parseFlag('--source');
      const result = await mem.store(content, {
        category: category || 'general',
        tags: tagsStr ? tagsStr.split(',').map(t => t.trim()) : [],
        source,
      });
      console.log(JSON.stringify({ stored: true, id: result.id, category: result.category, tags: result.tags }));
      break;
    }

    case 'recall': {
      const query = args[1];
      if (!query) {
        console.error('Usage: remember recall <query> [--limit <n>] [--category <cat>]');
        process.exit(1);
      }
      const limit = parseInt(parseFlag('--limit') || '10', 10);
      const category = parseFlag('--category');
      const results = await mem.recall(query, { limit, category });
      if (results.length === 0) {
        console.log(JSON.stringify({ results: [], count: 0 }));
      } else {
        console.log(JSON.stringify({
          results: results.map(r => ({
            id: r.id,
            content: r.content,
            category: r.category,
            tags: r.tags,
            retrievability: Math.round(r.retrievability * 100),
            score: r.rrf_score,
          })),
          count: results.length,
        }));
      }
      break;
    }

    case 'reinforce': {
      const id = args[1];
      if (!id) {
        console.error('Usage: remember reinforce <id> [--rating <1-4>]');
        process.exit(1);
      }
      const rating = parseInt(parseFlag('--rating') || '3', 10);
      const result = mem.reinforce(id, rating);
      if (result) {
        console.log(JSON.stringify({ reinforced: true, id, stability: result.stability, difficulty: result.difficulty }));
      } else {
        console.error(`Memory not found: ${id}`);
        process.exit(1);
      }
      break;
    }

    case 'stats': {
      const s = mem.stats();
      console.log(JSON.stringify(s));
      break;
    }

    case 'consolidate': {
      const result = mem.consolidate();
      console.log(JSON.stringify({ consolidated: true, ...result }));
      break;
    }

    case 'export': {
      const format = parseFlag('--format') || 'json';
      console.log(mem.export(format));
      break;
    }

    case 'import': {
      const filepath = args[1];
      if (!filepath) {
        console.error('Usage: remember import <filepath>');
        process.exit(1);
      }
      const results = await mem.importFromMarkdown(resolve(filepath));
      console.log(JSON.stringify({ imported: true, count: results.length }));
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "node remember.js --help" for usage.');
      process.exit(1);
  }
} finally {
  mem.close();
}
