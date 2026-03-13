#!/usr/bin/env node

// MEMORY.md → Remember DB migration script
// Parses MEMORY.md structure and imports memories with proper categorization

import Remember from '../../src/index.js';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';

const filepath = process.argv[2];
if (!filepath) {
  console.error('Usage: node migrate.js <path/to/MEMORY.md>');
  console.error('Example: node migrate.js ~/.claude/projects/myproject/memory/MEMORY.md');
  process.exit(1);
}

const resolvedPath = resolve(filepath);
if (!existsSync(resolvedPath)) {
  console.error(`File not found: ${resolvedPath}`);
  process.exit(1);
}

// Setup DB
const rememberDir = join(homedir(), '.remember');
if (!existsSync(rememberDir)) {
  mkdirSync(rememberDir, { recursive: true });
}
const dbPath = process.env.REMEMBER_DB_PATH || join(rememberDir, 'memory.db');

console.log(`Migrating: ${resolvedPath}`);
console.log(`Target DB: ${dbPath}\n`);

const content = readFileSync(resolvedPath, 'utf-8');
const lines = content.split('\n');

// Category mapping from MEMORY.md headers
const categoryMap = {
  'user': 'person',
  'users': 'person',
  'people': 'person',
  'person': 'person',
  'preference': 'preference',
  'preferences': 'preference',
  'settings': 'preference',
  'decision': 'decision',
  'decisions': 'decision',
  'project': 'project',
  'projects': 'project',
  'work': 'project',
  'event': 'event',
  'events': 'event',
  'schedule': 'event',
  'feedback': 'feedback',
  'correction': 'feedback',
  'corrections': 'feedback',
  'reference': 'reference',
  'references': 'reference',
  'links': 'reference',
  'fact': 'fact',
  'facts': 'fact',
  'general': 'general',
};

function detectCategory(header) {
  const lower = header.toLowerCase().trim();
  for (const [key, cat] of Object.entries(categoryMap)) {
    if (lower.includes(key)) return cat;
  }
  return 'general';
}

function extractTags(text) {
  const tags = [];
  // Extract **bold** keywords
  const boldMatches = text.match(/\*\*([^*]+)\*\*/g);
  if (boldMatches) {
    for (const m of boldMatches) {
      tags.push(m.replace(/\*\*/g, '').trim());
    }
  }
  return tags.slice(0, 5); // max 5 tags
}

function extractDates(text) {
  const datePattern = /\d{4}-\d{2}-\d{2}/g;
  return text.match(datePattern) || [];
}

// Parse MEMORY.md
const memories = [];
let currentCategory = 'general';
let currentHeader = '';

for (const line of lines) {
  // Detect headers
  const headerMatch = line.match(/^#{1,3}\s+(.+)/);
  if (headerMatch) {
    currentHeader = headerMatch[1];
    currentCategory = detectCategory(currentHeader);
    continue;
  }

  // Detect list items (actual memory entries)
  const listMatch = line.match(/^[-*]\s+(.+)/);
  if (listMatch) {
    const text = listMatch[1].trim();
    if (text.length < 5) continue; // skip trivially short items

    const tags = extractTags(text);
    const dates = extractDates(text);
    const cleanText = text.replace(/\*\*/g, ''); // remove bold markers

    memories.push({
      content: cleanText,
      category: currentCategory,
      tags,
      dates,
      source: `migrate:${resolvedPath}`,
    });
    continue;
  }

  // Detect plain text paragraphs (non-empty, non-header, non-list)
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---') && trimmed.length > 20) {
    const tags = extractTags(trimmed);
    const cleanText = trimmed.replace(/\*\*/g, '');

    memories.push({
      content: cleanText,
      category: currentCategory,
      tags,
      dates: extractDates(trimmed),
      source: `migrate:${resolvedPath}`,
    });
  }
}

// Import into Remember DB
const mem = new Remember({ dbPath, embedMode: 'none' });
let imported = 0;
let skipped = 0;

for (const m of memories) {
  try {
    await mem.store(m.content, {
      category: m.category,
      tags: m.tags,
      source: m.source,
      dedupe: true,
    });
    imported++;
  } catch (err) {
    console.error(`  Skip: ${m.content.slice(0, 50)}... (${err.message})`);
    skipped++;
  }
}

// Print stats
const stats = mem.stats();
mem.close();

console.log('Migration complete!\n');
console.log(`  Parsed:   ${memories.length} entries`);
console.log(`  Imported: ${imported}`);
console.log(`  Skipped:  ${skipped}`);
console.log(`\nDB Stats:`);
console.log(`  Total memories: ${stats.total}`);
console.log(`  Connections:    ${stats.connections}`);
console.log(`  Categories:`);
for (const c of stats.byCategory) {
  console.log(`    ${c.category}: ${c.count}`);
}
