import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ExternalDriveBackup } from '../src/backup.js';

// 테스트용 임시 디렉토리 생성
function createTempDir() {
  return mkdtempSync(join(tmpdir(), 'remember-test-'));
}

// 테스트용 DB 파일 생성
function createTestDB(dir) {
  const dbPath = join(dir, 'test.db');
  writeFileSync(dbPath, 'test database content');
  return dbPath;
}

test('ExternalDriveBackup - constructor', () => {
  const backup = new ExternalDriveBackup({
    dbPath: '/tmp/test.db',
    backupPaths: ['/Volumes/SSD'],
    strategy: 'on-mount',
    retentionDays: 7
  });

  assert.strictEqual(backup.dbPath, '/tmp/test.db');
  assert.deepStrictEqual(backup.backupPaths, ['/Volumes/SSD']);
  assert.strictEqual(backup.strategy, 'on-mount');
  assert.strictEqual(backup.retentionDays, 7);
});

test('ExternalDriveBackup - isMounted returns false for non-existent path', async () => {
  const backup = new ExternalDriveBackup({
    dbPath: '/tmp/test.db',
    backupPaths: ['/nonexistent-path-12345']
  });

  const isMounted = await backup.isMounted('/nonexistent-path-12345');
  assert.strictEqual(isMounted, false);
});

test('ExternalDriveBackup - isMounted returns true for existing directory', async () => {
  const tempDir = createTempDir();
  const backup = new ExternalDriveBackup({
    dbPath: join(tempDir, 'test.db')
  });

  const isMounted = await backup.isMounted(tempDir);
  assert.strictEqual(isMounted, true);

  // cleanup
  rmSync(tempDir, { recursive: true });
});

test('ExternalDriveBackup - backup skips when drive not mounted', async () => {
  const tempDir = createTempDir();
  const dbPath = createTestDB(tempDir);
  
  const backup = new ExternalDriveBackup({
    dbPath: dbPath,
    backupPaths: ['/nonexistent-drive'],
    logger: { log: () => {}, warn: () => {}, error: () => {} }
  });

  const result = await backup.backup();
  
  assert.strictEqual(result.skipped, 1);
  assert.strictEqual(result.success, 0);
  assert.strictEqual(result.results[0].status, 'skipped');

  // cleanup
  rmSync(tempDir, { recursive: true });
});

test('ExternalDriveBackup - backup succeeds when drive mounted', async () => {
  const tempDir = createTempDir();
  const backupDir = createTempDir();
  const dbPath = createTestDB(tempDir);
  
  const backup = new ExternalDriveBackup({
    dbPath: dbPath,
    backupPaths: [backupDir],
    logger: { log: () => {}, warn: () => {}, error: () => {} }
  });

  const result = await backup.backup({ timestamp: '20260315_120000' });
  
  assert.strictEqual(result.success, 1);
  assert.strictEqual(result.skipped, 0);
  assert.strictEqual(result.results[0].status, 'success');
  
  // 백업 파일 확인
  const backupFile = join(backupDir, 'remember-backups', 'remember_20260315_120000.db');
  assert.strictEqual(existsSync(backupFile), true);

  // cleanup
  rmSync(tempDir, { recursive: true });
  rmSync(backupDir, { recursive: true });
});

test('ExternalDriveBackup - cleanup old backups', async () => {
  const tempDir = createTempDir();
  const backupDir = createTempDir();
  const dbPath = createTestDB(tempDir);
  
  // 오래된 백업 파일 생성
  const oldBackupDir = join(backupDir, 'remember-backups');
  mkdirSync(oldBackupDir, { recursive: true });
  writeFileSync(join(oldBackupDir, 'remember_20240101_120000.db'), 'old');
  writeFileSync(join(oldBackupDir, 'remember_20260315_120000.db'), 'new');
  
  const backup = new ExternalDriveBackup({
    dbPath: dbPath,
    backupPaths: [backupDir],
    retentionDays: 30, // 30일 이상 된 파일 삭제
    logger: { log: () => {}, warn: () => {}, error: () => {} }
  });

  const result = await backup.backup({ timestamp: '20260315_130000' });
  
  // 오래된 파일이 삭제되었는지 확인
  assert.strictEqual(existsSync(join(oldBackupDir, 'remember_20240101_120000.db')), false);
  assert.strictEqual(existsSync(join(oldBackupDir, 'remember_20260315_120000.db')), true);
  assert.strictEqual(result.results[0].deleted, 1);

  // cleanup
  rmSync(tempDir, { recursive: true });
  rmSync(backupDir, { recursive: true });
});

test('ExternalDriveBackup - status returns correct info', async () => {
  const tempDir = createTempDir();
  const backupDir = createTempDir();
  const dbPath = createTestDB(tempDir);
  
  const backup = new ExternalDriveBackup({
    dbPath: dbPath,
    backupPaths: [backupDir, '/nonexistent'],
    logger: { log: () => {}, warn: () => {}, error: () => {} }
  });

  const status = await backup.status();
  
  assert.strictEqual(status.dbExists, true);
  assert.strictEqual(status.dbSize, 21); // 'test database content'.length
  assert.strictEqual(status.backupPaths.length, 2);
  assert.strictEqual(status.backupPaths[0].mounted, true);
  assert.strictEqual(status.backupPaths[1].mounted, false);

  // cleanup
  rmSync(tempDir, { recursive: true });
  rmSync(backupDir, { recursive: true });
});

test('ExternalDriveBackup - formatBytes works correctly', () => {
  const backup = new ExternalDriveBackup({ dbPath: '/tmp/test.db' });
  
  assert.strictEqual(backup._formatBytes(0), '0 B');
  assert.strictEqual(backup._formatBytes(512), '512 B');
  assert.strictEqual(backup._formatBytes(1024), '1 KB');
  assert.strictEqual(backup._formatBytes(1536), '1.5 KB');
  assert.strictEqual(backup._formatBytes(1024 * 1024), '1 MB');
});
