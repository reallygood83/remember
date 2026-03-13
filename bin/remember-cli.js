#!/usr/bin/env node

import Remember from '../src/index.js';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const command = args[0];
const dbPath = process.env.REMEMBER_DB || resolve(process.cwd(), '.remember.db');

if (!command || command === '--help' || command === '-h') {
  console.log(`remember - cognitive memory for AI agents

Usage:
  remember store <content> [--category <cat>] [--tags <t1,t2>] [--source <src>]
  remember recall <query> [--limit <n>] [--category <cat>]
  remember connect [--dry]
  remember stats
  remember consolidate
  remember export [--format json|markdown]
  remember import <filepath>

Environment:
  REMEMBER_DB  Path to SQLite database (default: ./.remember.db)
  REMEMBER_EMBED  Embedding mode: none|openai|ollama|cerebras`);
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
      if (!content) { console.error('Usage: remember store <content>'); process.exit(1); }
      const category = parseFlag('--category');
      const tagsStr = parseFlag('--tags');
      const source = parseFlag('--source');
      const result = await mem.store(content, {
        category: category || 'general',
        tags: tagsStr ? tagsStr.split(',') : [],
        source,
      });
      console.log(`Stored: ${result.id}`);
      break;
    }

    case 'recall': {
      const query = args[1];
      if (!query) { console.error('Usage: remember recall <query>'); process.exit(1); }
      const limit = parseInt(parseFlag('--limit') || '5', 10);
      const category = parseFlag('--category');
      const results = await mem.recall(query, { limit, category });
      if (results.length === 0) {
        console.log('No memories found.');
      } else {
        for (const r of results) {
          console.log(`[${r.category}] ${r.content.slice(0, 100)}`);
          console.log(`  id=${r.id} retrievability=${(r.retrievability * 100).toFixed(0)}%`);
        }
      }
      break;
    }

    case 'connect': {
      const dryRun = args.includes('--dry');
      const result = mem.autoConnectAll({ dryRun });
      if (dryRun) {
        console.log(`[Dry run] Would create ${result.created} connections`);
        if (result.preview) {
          for (const p of result.preview) {
            console.log(`  ${p.from.slice(0, 8)}.. → ${p.to.slice(0, 8)}.. (weight: ${p.weight})`);
          }
        }
      } else {
        console.log(`Connections: ${result.created} created, ${result.updated} updated, ${result.pruned} pruned`);
        console.log(`Total connections: ${result.total}`);
      }
      break;
    }

    case 'stats': {
      const s = mem.stats();
      console.log(`Total memories: ${s.total}`);
      console.log(`Connections: ${s.connections}`);
      console.log(`Avg stability: ${s.avgStability}`);
      for (const c of s.byCategory) {
        console.log(`  ${c.category}: ${c.count}`);
      }
      break;
    }

    case 'consolidate': {
      const result = mem.consolidate();
      console.log(`Consolidated: ${result.merged} merged, ${result.decayed} decayed, ${result.active} active`);
      break;
    }

    case 'export': {
      const format = parseFlag('--format') || 'json';
      console.log(mem.export(format));
      break;
    }

    case 'import': {
      const filepath = args[1];
      if (!filepath) { console.error('Usage: remember import <filepath>'); process.exit(1); }
      const results = await mem.importFromMarkdown(resolve(filepath));
      console.log(`Imported ${results.length} memories`);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
} finally {
  mem.close();
}
