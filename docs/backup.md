# External Drive Backup

Remember의 외부 드라이브 백업 모듈입니다. 로컬에 저장하고, 외부 드라이브 연결 시에만 백업하는 원칙을 따릅니다.

## 설치

```bash
npm install @reallygood/remember
```

## 사용법

### 프로그래밍 방식

```javascript
import { ExternalDriveBackup } from '@reallygood/remember/src/backup.js';

const backup = new ExternalDriveBackup({
  dbPath: './memory.db',
  backupPaths: [
    '/Volumes/Brain SSD/remember-backups',
    '/Volumes/External Drive/backups'
  ],
  retentionDays: 30  // 30일 이상 된 백업 자동 삭제
});

// 백업 실행 (연결된 드라이브에만)
const result = await backup.backup();
console.log(result);
// {
//   timestamp: '2026-03-15_22-30-00',
//   success: 1,
//   skipped: 1,
//   errors: 0,
//   results: [...]
// }

// 상태 확인
const status = await backup.status();
console.log(status);
```

### CLI 방식

```bash
# 백업 상태 확인
remember backup --status

# 백업 실행 (연결된 드라이브에만)
remember backup

# 특정 경로에 백업
remember backup --path /Volumes/SSD

# 시뮬레이션 (실제 백업 없이)
remember backup --dry-run
```

## 설정

`~/.remember/config.json`:

```json
{
  "backup": {
    "paths": [
      "/Volumes/Brain SSD/remember-backups",
      "/mnt/backup-drive"
    ],
    "retentionDays": 30
  }
}
```

## 특징

- ✅ **마운트 감지**: 드라이브가 연결되어 있을 때만 백업
- ✅ **자동 정리**: 오래된 백업 자동 삭제
- ✅ **다중 경로**: 여러 백업 대상 지원
- ✅ **원자적 복사**: 안전한 파일 복사
- ✅ **크로스 플랫폼**: macOS, Linux, Windows 지원

## 원리

```
로컬 DB (memory.db)
       │
       ├─── Brain SSD 연결됨? ───✅─── 백업 수행
       │                          ❌─── 스킵
       │
       └─── External Drive 연결됨? ───✅─── 백업 수행
                                      ❌─── 스킵
```

## 기여

이 모듈은 [Eddie AI 시스템](https://github.com/dohoonkim)에서 개발되었습니다.
