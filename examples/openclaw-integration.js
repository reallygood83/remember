// Example: OpenClaw agent integration with Remember
//
// 이 예시는 OpenClaw의 AGENTS.md에서 Remember 스킬을
// 어떻게 참조하고 사용하는지 보여줍니다.

import Remember from '../src/index.js';
import { join } from 'node:path';
import { homedir } from 'node:os';

// ============================================================
// 1. 기본 사용법 — 에이전트 대화 중 기억 관리
// ============================================================

const mem = new Remember({
  dbPath: join(homedir(), '.remember', 'memory.db'),
  embedMode: 'none', // BM25 only, zero dependencies
  mergeThreshold: 0.85,
});

// 세션 시작 시: 관련 기억 불러오기
const userPrefs = await mem.recall('사용자 선호', { limit: 5 });
const recentProjects = await mem.recall('진행 중인 프로젝트', { limit: 5 });
console.log('Session context loaded:', {
  preferences: userPrefs.length,
  projects: recentProjects.length,
});

// 대화 중: 중요 정보 저장
await mem.store('사용자는 한국어와 영어를 혼용한다', {
  category: 'preference',
  tags: ['language', '설정'],
  source: 'conversation-001',
});

await mem.store('Conway Trader는 STOCH DNA 전략으로 결정', {
  category: 'decision',
  tags: ['trading', 'Conway', '전략'],
  source: 'conversation-001',
});

await mem.store('문정님 딸 고은이는 4학년', {
  category: 'person',
  tags: ['가족', '고은'],
  source: 'conversation-002',
});

// 연관 기억 연결
const trading = await mem.recall('Conway 전략');
const projects = await mem.recall('Conway Trader');
if (trading.length > 0 && projects.length > 0) {
  mem.connect(trading[0].id, projects[0].id, 0.9, 'same project context');
}

// 통계 확인
console.log('Memory stats:', mem.stats());

mem.close();

// ============================================================
// 2. AGENTS.md 스킬 참조 예시
// ============================================================

/*
AGENTS.md 에서 Remember 스킬을 참조하는 방법:

```yaml
skills:
  - name: remember
    path: ./skills/remember    # 또는 clawhub에서 설치한 경로
    description: 인지 메모리 시스템

agents:
  main:
    skills: [remember]
    heartbeat:
      interval: 300  # 5분마다
      actions:
        - remember recall "진행 중인 작업" --limit 5
        - remember stats

    session_start:
      actions:
        - remember recall "사용자 선호" --limit 10
        - remember recall "최근 프로젝트" --limit 5
        - remember recall "주의사항" --limit 5
```
*/

// ============================================================
// 3. 크론잡 설정 예시
// ============================================================

/*
OpenClaw 크론 설정 (AGENTS.md 또는 cron config):

```yaml
cron:
  # 매일 새벽 3시: 기억 정리
  consolidate:
    schedule: "0 3 * * *"
    command: node skill/scripts/remember.js consolidate

  # 매주 월요일: 통계 리포트
  weekly_stats:
    schedule: "0 9 * * 1"
    command: node skill/scripts/remember.js stats

  # 매월 1일: 백업 내보내기
  monthly_export:
    schedule: "0 0 1 * *"
    command: node skill/scripts/remember.js export --format json > ~/.remember/backup-$(date +%Y%m).json
```
*/

// ============================================================
// 4. MEMORY.md 마이그레이션
// ============================================================

/*
기존 Claude Code MEMORY.md를 Remember DB로 마이그레이션:

```bash
# 단일 프로젝트 MEMORY.md
node skill/scripts/migrate.js ~/.claude/projects/myproject/memory/MEMORY.md

# 설정과 함께 초기 셋업
node skill/scripts/setup.js ~/.claude/projects/myproject/memory/MEMORY.md
```
*/
