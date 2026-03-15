import { existsSync, copyFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * External Drive Backup Module for Remember
 * 
 * 원칙: 로컬 저장, 외부 드라이브 연결 시에만 백업
 * Eddie 시스템에서 개발된 패턴
 */

export class ExternalDriveBackup {
  constructor(options = {}) {
    this.dbPath = options.dbPath;
    this.backupPaths = options.backupPaths || [];
    this.strategy = options.strategy || 'on-mount'; // 'on-mount' | 'scheduled'
    this.retentionDays = options.retentionDays || 30;
    this.logger = options.logger || console;
  }

  /**
   * 외부 드라이브 마운트 상태 확인
   */
  async isMounted(mountPath) {
    try {
      // 기본 존재성 체크
      if (!existsSync(mountPath)) {
        return false;
      }

      // 디렉토리인지 확인
      const stats = statSync(mountPath);
      if (!stats.isDirectory()) {
        return false;
      }

      // 쓰기 가능 여부 체크 (선택적)
      if (this.strategy === 'verify-writable') {
        const testFile = join(mountPath, '.remember-write-test');
        try {
          const fd = fs.openSync(testFile, 'w');
          fs.closeSync(fd);
          fs.unlinkSync(testFile);
          return true;
        } catch {
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.warn(`Mount check failed for ${mountPath}:`, error.message);
      return false;
    }
  }

  /**
   * 모든 백업 대상에 대해 백업 수행
   */
  async backup(options = {}) {
    const results = [];
    const timestamp = options.timestamp || this._generateTimestamp();

    for (const backupPath of this.backupPaths) {
      const isAvailable = await this.isMounted(backupPath);
      
      if (!isAvailable) {
        this.logger.log(`⚠️  Skipping backup: ${backupPath} not mounted`);
        results.push({
          path: backupPath,
          status: 'skipped',
          reason: 'not-mounted'
        });
        continue;
      }

      try {
        const result = await this._performBackup(backupPath, timestamp);
        results.push(result);
      } catch (error) {
        this.logger.error(`Backup failed for ${backupPath}:`, error.message);
        results.push({
          path: backupPath,
          status: 'error',
          error: error.message
        });
      }
    }

    return {
      timestamp,
      results,
      success: results.filter(r => r.status === 'success').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errors: results.filter(r => r.status === 'error').length
    };
  }

  /**
   * 단일 경로에 백업 수행
   */
  async _performBackup(backupPath, timestamp) {
    // 백업 디렉토리 생성
    const backupDir = join(backupPath, 'remember-backups');
    mkdirSync(backupDir, { recursive: true });

    // DB 파일 백업
    const dbFileName = `remember_${timestamp}.db`;
    const dbBackupPath = join(backupDir, dbFileName);
    
    copyFileSync(this.dbPath, dbBackupPath);

    // 파일 크기 확인
    const originalSize = statSync(this.dbPath).size;
    const backupSize = statSync(dbBackupPath).size;

    // 오래된 백업 정리
    const deleted = await this._cleanupOldBackups(backupDir);

    this.logger.log(`✅ Backup completed: ${dbFileName} (${this._formatBytes(backupSize)})`);

    return {
      path: backupPath,
      status: 'success',
      file: dbFileName,
      originalSize,
      backupSize,
      deleted
    };
  }

  /**
   * 오래된 백업 파일 정리
   */
  async _cleanupOldBackups(backupDir) {
    if (!existsSync(backupDir)) return 0;

    const { readdirSync, unlinkSync } = await import('node:fs');
    const files = readdirSync(backupDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    let deleted = 0;

    for (const file of files) {
      if (!file.startsWith('remember_') || !file.endsWith('.db')) continue;

      const filePath = join(backupDir, file);
      const stats = statSync(filePath);
      
      if (stats.mtime < cutoffDate) {
        unlinkSync(filePath);
        deleted++;
      }
    }

    if (deleted > 0) {
      this.logger.log(`🗑️  Cleaned up ${deleted} old backups (>${this.retentionDays} days)`);
    }

    return deleted;
  }

  /**
   * 백업 상태 조회
   */
  async status() {
    const status = {
      dbPath: this.dbPath,
      dbExists: existsSync(this.dbPath),
      backupPaths: []
    };

    if (status.dbExists) {
      const stats = statSync(this.dbPath);
      status.dbSize = stats.size;
      status.dbModified = stats.mtime;
    }

    for (const backupPath of this.backupPaths) {
      const isMounted = await this.isMounted(backupPath);
      const backupDir = join(backupPath, 'remember-backups');
      
      let backupInfo = {
        path: backupPath,
        mounted: isMounted
      };

      if (isMounted && existsSync(backupDir)) {
        const { readdirSync } = await import('node:fs');
        const files = readdirSync(backupDir).filter(f => f.endsWith('.db'));
        backupInfo.backupCount = files.length;
        backupInfo.latestBackup = files.sort().pop() || null;
      }

      status.backupPaths.push(backupInfo);
    }

    return status;
  }

  /**
   * 타임스탬프 생성 (YYYYMMDD_HHMMSS)
   */
  _generateTimestamp() {
    const now = new Date();
    return now.toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19)
      .replace('T', '_');
  }

  /**
   * 바이트를 human-readable 형식으로 변환
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

/**
 * 팩토리 함수
 */
export function createBackup(options) {
  return new ExternalDriveBackup(options);
}
