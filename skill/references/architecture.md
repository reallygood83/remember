# Remember Architecture

## 시스템 구조

```
┌─────────────────────────────────────────────┐
│              OpenClaw Agent                  │
│  (SKILL.md 규칙에 따라 자동 store/recall)    │
└──────────────┬──────────────────┬───────────┘
               │ store/recall     │ consolidate
               ▼                  ▼
┌──────────────────────────────────────────────┐
│           skill/scripts/remember.js          │
│           (CLI Wrapper, JSON 출력)           │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│              src/index.js                    │
│           Remember 클래스 (핵심)             │
├──────────┬──────────┬──────────┬─────────────┤
│ fsrs.js  │search.js │ merge.js │  embed.js   │
│ 망각곡선 │하이브리드│ 중복감지 │  임베딩     │
│          │  검색    │ & 병합   │  (선택)     │
└──────────┴────┬─────┴──────────┴─────────────┘
                │
                ▼
┌──────────────────────────────────────────────┐
│        SQLite (better-sqlite3)               │
│  ~/.remember/memory.db                       │
│  ┌──────────┐ ┌────────────┐ ┌───────────┐  │
│  │ memories │ │connections │ │memories_fts│  │
│  └──────────┘ └────────────┘ └───────────┘  │
└──────────────────────────────────────────────┘
```

## 핵심 모듈

### FSRS (src/fsrs.js)
Free Spaced Repetition Scheduler. 에빙하우스 망각 곡선 기반.
- `initCard()`: 새 기억 카드 초기화 (stability=1, difficulty=5)
- `retrievability(stability, elapsedDays)`: 현재 기억 강도 계산 (0~1)
- `schedule(card, rating)`: 복습 후 카드 업데이트
- `shouldDecay(memory)`: 소멸 대상 판정 (안정도의 3배 경과 시)

### 하이브리드 검색 (src/search.js)
3가지 검색을 RRF(Reciprocal Rank Fusion)로 결합:
1. **BM25**: SQLite FTS5 전문 검색 (항상 활성)
2. **벡터 검색**: 코사인 유사도 (임베딩 모드 시)
3. **그래프 확산**: connections 테이블 기반 spreading activation

### 중복 감지 (src/merge.js)
- 트라이그램 자카드 유사도로 중복 판정
- 임계값(기본 0.85) 이상이면 supersede 전략으로 병합
- consolidate 시 전체 메모리 대상으로 일괄 처리

### 임베딩 (src/embed.js)
선택적 벡터 임베딩:
- `none`: BM25만 사용 (기본, 외부 의존성 없음)
- `openai`: OpenAI text-embedding-3-small
- `ollama`: 로컬 Ollama 서버
- `cerebras`: Cerebras API

## 데이터 흐름

### Store
```
입력 → 중복 검사 → [병합 or 새 삽입] → 임베딩(선택) → FTS 인덱싱 → 연결 생성
```

### Recall
```
쿼리 → BM25 검색 + 벡터 검색 + 그래프 확산 → RRF 결합 → retrievability 필터 → 자동 reinforce
```

### Consolidate
```
전체 스캔 → shouldDecay 판정 → 소멸 처리 → 중복 병합 → 통계 반환
```

## DB 스키마

### memories 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT PK | UUID |
| content | TEXT | 기억 내용 |
| category | TEXT | 분류 |
| tags | TEXT | JSON 배열 |
| embedding | TEXT | 벡터 (JSON, nullable) |
| stability | REAL | FSRS 안정도 |
| difficulty | REAL | FSRS 난이도 |
| last_review | TEXT | 마지막 접근 시각 |
| next_review | TEXT | 다음 복습 예정 |
| reps | INTEGER | 복습 횟수 |
| lapses | INTEGER | 망각 횟수 |
| state | INTEGER | 카드 상태 |
| source | TEXT | 출처 |
| superseded_by | TEXT | 병합 시 대체 ID |
| created_at | TEXT | 생성 시각 |
| updated_at | TEXT | 수정 시각 |

### connections 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| from_id | TEXT | 출발 기억 ID |
| to_id | TEXT | 도착 기억 ID |
| weight | REAL | 연결 강도 (0~1) |
| reason | TEXT | 연결 이유 |
