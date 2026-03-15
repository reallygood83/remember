#!/usr/bin/env node
/**
 * Remember CLI - Backup Commands
 * 
 * 새로운 명령어:
 *   remember backup              - 외부 드라이브 백업 실행
 *   remember backup --status     - 백업 상태 확인
 *   remember backup --dry-run    - 백업 시뮬레이션 (실제 실행X)
 */

import { ExternalDriveBackup } from '../src/backup.js';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// 설정 파일 로드
function loadConfig() {
  const configPath = join(homedir(), '.remember', 'config.json');
  if (existsSync(configPath)) {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  }
  return {
    backup: {
      paths: [],
      retentionDays: 30
    }
  };
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command !== 'backup') {
    console.log('Usage: remember backup [options]');
    console.log('');
    console.log('Options:');
    console.log('  --status     Show backup status');
    console.log('  --dry-run    Simulate backup without writing');
    console.log('  --path       Specify backup path');
    process.exit(1);
  }

  const isStatus = args.includes('--status');
  const isDryRun = args.includes('--dry-run');
  
  // DB 경로 확인
  const dbPath = process.env.REMEMBER_DB || join(homedir(), '.remember', 'memory.db');
  
  if (!existsSync(dbPath)) {
    console.error(`❌ Database not found: ${dbPath}`);
    console.log('   Run "remember init" first to create a database.');
    process.exit(1);
  }

  // 백업 경로 설정
  let backupPaths = [];
  const pathIndex = args.indexOf('--path');
  if (pathIndex !== -1 && args[pathIndex + 1]) {
    backupPaths = [args[pathIndex + 1]];
  } else {
    const config = loadConfig();
    backupPaths = config.backup?.paths || [];
  }

  if (backupPaths.length === 0) {
    console.log('⚠️  No backup paths configured.');
    console.log('   Use --path /path/to/backup or add to ~/.remember/config.json');
    console.log('');
    console.log('Example config:');
    console.log(JSON.stringify({
      backup: {
        paths: ['/Volumes/External Drive/remember-backups'],
        retentionDays: 30
      }
    }, null, 2));
    process.exit(1);
  }

  const backup = new ExternalDriveBackup({
    dbPath,
    backupPaths,
    retentionDays: 30,
    logger: console
  });

  if (isStatus) {
    console.log('📋 Backup Status');
    console.log('=================\n');
    
    const status = await backup.status();
    
    console.log(`Database: ${status.dbPath}`);
    console.log(`Exists: ${status.dbExists ? '✅' : '❌'}`);
    if (status.dbExists) {
      console.log(`Size: ${backup._formatBytes(status.dbSize)}`);
      console.log(`Modified: ${status.dbModified.toISOString()}`);
    }
    
    console.log('\nBackup Paths:');
    for (const bp of status.backupPaths) {
      console.log(`  ${bp.path}`);
      console.log(`    Mounted: ${bp.mounted ? '✅' : '❌'}`);
      if (bp.backupCount !== undefined) {
        console.log(`    Backups: ${bp.backupCount}`);
        console.log(`    Latest: ${bp.latestBackup || 'None'}`);
      }
    }
    
    process.exit(0);
  }

  if (isDryRun) {
    console.log('🔍 Backup Dry Run');
    console.log('==================\n');
    
    for (const path of backupPaths) {
      const mounted = await backup.isMounted(path);
      console.log(`${path}: ${mounted ? '✅ Would backup' : '❌ Not mounted'}`);
    }
    
    process.exit(0);
  }

  // 실제 백업 실행
  console.log('🚀 Starting backup...\n');
  
  const result = await backup.backup();
  
  console.log('\n📊 Backup Summary');
  console.log('=================');
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Success: ${result.success}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Errors: ${result.errors}`);
  
  for (const r of result.results) {
    console.log(`\n  ${r.path}:`);
    console.log(`    Status: ${r.status}`);
    if (r.status === 'success') {
      console.log(`    File: ${r.file}`);
      console.log(`    Size: ${backup._formatBytes(r.backupSize)}`);
      if (r.deleted > 0) {
        console.log(`    Cleaned: ${r.deleted} old backups`);
      }
    } else if (r.status === 'skipped') {
      console.log(`    Reason: ${r.reason}`);
    } else if (r.status === 'error') {
      console.log(`    Error: ${r.error}`);
    }
  }
  
  process.exit(result.errors > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
