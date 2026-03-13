#!/usr/bin/env node

// Remember initial setup script
// Creates ~/.remember/ directory, initializes DB, and generates default config

import Remember from '../../src/index.js';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';

const rememberDir = join(homedir(), '.remember');
const dbPath = process.env.REMEMBER_DB_PATH || join(rememberDir, 'memory.db');
const configPath = join(rememberDir, 'config.json');

console.log('Remember — Initial Setup\n');

// Step 1: Create directory
if (!existsSync(rememberDir)) {
  mkdirSync(rememberDir, { recursive: true });
  console.log(`[1/3] Created ${rememberDir}`);
} else {
  console.log(`[1/3] Directory exists: ${rememberDir}`);
}

// Step 2: Initialize DB
const mem = new Remember({ dbPath, embedMode: 'none' });
const stats = mem.stats();
console.log(`[2/3] Database initialized: ${dbPath}`);
console.log(`      Existing memories: ${stats.total}`);
mem.close();

// Step 3: Create default config
const defaultConfig = {
  dbPath,
  embedMode: 'none',
  mergeThreshold: 0.85,
  categories: ['fact', 'preference', 'decision', 'event', 'person', 'project', 'feedback', 'reference', 'general'],
  consolidate: {
    schedule: 'daily',
    time: '03:00',
  },
};

if (!existsSync(configPath)) {
  writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
  console.log(`[3/3] Config created: ${configPath}`);
} else {
  console.log(`[3/3] Config exists: ${configPath}`);
}

// Step 4: Optional MEMORY.md migration
const memoryMdArg = process.argv[2];
if (memoryMdArg) {
  console.log(`\nMigrating MEMORY.md: ${memoryMdArg}`);
  const migrateMem = new Remember({ dbPath, embedMode: 'none' });
  try {
    const results = await migrateMem.importFromMarkdown(memoryMdArg);
    console.log(`Imported ${results.length} memories from MEMORY.md`);
  } finally {
    migrateMem.close();
  }
}

console.log('\nSetup complete! Remember is ready.');
console.log(`\nUsage:`);
console.log(`  node skill/scripts/remember.js store "내용" --category fact --tags "태그1,태그2"`);
console.log(`  node skill/scripts/remember.js recall "검색어"`);
console.log(`  node skill/scripts/remember.js stats`);
