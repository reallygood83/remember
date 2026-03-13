---
name: remember
description: AI 에이전트용 인지 메모리 시스템. 대화 중 중요한 정보를 자동 저장하고, 망각 곡선(FSRS)으로 관리하고, 하이브리드 검색(BM25 + 벡터 + 그래프)으로 필요한 기억만 불러온다.
---

# Remember — Cognitive Memory for AI Agents

## 개요

Remember는 AI 에이전트가 대화 간 컨텍스트를 유지하기 위한 경량 인지 메모리 시스템이다.
핵심 특징:
- **FSRS 망각 곡선**: 자주 쓰는 기억은 강화, 안 쓰는 기억은 자연 소멸
- **하이브리드 검색**: BM25 키워드 + 벡터 유사도 + 그래프 확산
- **중복 감지**: 트라이그램 자카드 유사도로 자동 병합
- **제로 의존성 임베딩**: BM25 only 모드로 외부 API 없이 동작

## 설치

프로젝트 루트에서:
```bash
npm install
npm run setup
```

## 사용법

### 기억 저장 (store)

대화 중 중요한 정보를 감지하면 즉시 저장한다:

```bash
node skill/scripts/remember.js store "사용자는 다크모드를 선호한다" --category preference --tags "UI,설정"
```

```bash
node skill/scripts/remember.js store "Conway Trader는 STOCH DNA 전략 사용" --category decision --tags "트레이딩,전략"
```

```bash
node skill/scripts/remember.js store "문정님 딸 고은이는 4학년" --category person --tags "가족"
```

### 기억 검색 (recall)

새 세션 시작 시, 또는 맥락이 필요할 때:

```bash
node skill/scripts/remember.js recall "사용자 선호" --limit 10
```

```bash
node skill/scripts/remember.js recall "트레이딩 전략" --category decision --limit 5
```

### 기억 강화 (reinforce)

중요한 기억을 명시적으로 강화:

```bash
node skill/scripts/remember.js reinforce <memory-id> --rating 4
```

Rating: 1=again, 2=hard, 3=good, 4=easy

### 기억 정리 (consolidate)

매일 크론으로 실행. 약한 기억 소멸 + 중복 병합:

```bash
node skill/scripts/remember.js consolidate
```

### 통계 (stats)

```bash
node skill/scripts/remember.js stats
```

### 내보내기/가져오기

```bash
node skill/scripts/remember.js export --format json
node skill/scripts/remember.js export --format markdown
node skill/scripts/remember.js import /path/to/memories.md
```

### MEMORY.md 마이그레이션

기존 MEMORY.md 파일을 Remember DB로 마이그레이션:

```bash
node skill/scripts/migrate.js /path/to/MEMORY.md
```

### 초기 설정

```bash
node skill/scripts/setup.js
```

## 에이전트 행동 규칙

### 언제 저장하나?

다음 상황을 감지하면 **즉시** store를 호출한다:

- **선호도 변경**: "나 이제 다크모드 좋아해", "한국어로 대화하자"
- **중요한 결정**: "Conway는 STOCH DNA로 가기로 했다", "크론잡을 Haiku로 전환"
- **새로운 사실**: "문정님 딸 고은이는 4학년", "사무실은 판교에 있다"
- **이벤트/일정**: "KBS 출연 3/17", "다음주 화요일 미팅"
- **프로젝트 상태**: "인증 미들웨어 리팩토링 완료", "v2 API 베타 오픈"
- **피드백**: "테스트에서 DB 목 쓰지 마", "요약 생략해줘"

### 언제 검색하나?

- **세션 시작 시**: `recall("사용자 선호")` + `recall("최근 프로젝트")` + `recall("오늘 할 일")`
- **질문에 답할 때**: `recall(질문의 핵심 키워드)`
- **작업 전 맥락 파악**: `recall("프로젝트명")` 또는 `recall("관련 결정")`
- **하트비트에서**: `recall("진행 중인 작업")` + `recall("주의사항")`

### 언제 정리하나?

- **매일 크론**: `consolidate` 실행 (새벽 시간대 권장)
- **하트비트**: 주기적으로 `stats` 체크, 기억 수가 과도하면 `consolidate`

### 저장 시 카테고리 선택 기준

| 카테고리 | 설명 | 예시 |
|---------|------|-----|
| `fact` | 객관적 사실 | "문정님은 초등교사" |
| `preference` | 사용자 선호/설정 | "한국어 대화 선호" |
| `decision` | 결정사항 | "크론은 Haiku 모델" |
| `event` | 이벤트/일정 | "KBS 출연 3/17" |
| `person` | 인물 정보 | "딸 고은이 4학년" |
| `project` | 프로젝트 상태 | "Conway Trader 개발 중" |
| `feedback` | 사용자 피드백/교정 | "요약 생략해줘" |
| `reference` | 외부 리소스 참조 | "버그는 Linear INGEST에서 추적" |
| `general` | 기타 | 위 카테고리에 해당 안 될 때 |

### 태그 작성 규칙

- 쉼표로 구분: `"태그1,태그2,태그3"`
- 한국어/영어 혼용 가능
- 핵심 키워드만 추출 (3-5개 이내)
- 기존 태그 재사용 우선 (일관성 유지)

## 환경변수

| 변수 | 설명 | 기본값 |
|------|------|-------|
| `REMEMBER_DB_PATH` | SQLite DB 경로 | `~/.remember/memory.db` |
| `REMEMBER_EMBED` | 임베딩 모드 | `none` |
| `OPENAI_API_KEY` | OpenAI 임베딩용 | - |
| `CEREBRAS_API_KEY` | Cerebras 임베딩용 | - |

## 아키텍처

자세한 아키텍처는 `skill/references/architecture.md` 참조.
