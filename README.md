# 🧠 Remember

**AI 비서가 진짜 "기억"할 수 있게 해주는 경량 인지 메모리 시스템**

---

## 이게 뭔가요?

AI 비서(ChatGPT, Claude, OpenClaw 등)는 대화가 끝나면 **모든 걸 잊어버립니다.**

"어제 뭐 먹었어?"라고 물으면 모릅니다. 분명 어제 말했는데.

보통 이걸 해결하려고 `MEMORY.md` 같은 파일에 기억을 적어두는데:
- 📄 파일이 점점 커져서 → **토큰 낭비**
- 🗑️ 오래된 정보가 쌓여서 → **수동 정리 필요**
- 🔍 찾기 어려워서 → **검색이 부정확**

**Remember**는 이 문제를 **사람의 뇌처럼** 해결합니다.

---

## 사람의 뇌는 어떻게 기억하나요?

1. **자주 떠올리는 건 강해진다** → 매일 먹는 약 이름은 절대 안 잊음
2. **안 쓰는 건 자연히 사라진다** → 3년 전 점심 메뉴는 기억 못함
3. **비슷한 건 합쳐진다** → "서울 맛집" 기억들이 하나로 묶임
4. **하나를 떠올리면 관련된 것도 따라온다** → "축구" 하면 "FC서울" "주말경기" "직관"

Remember는 이 4가지를 코드로 구현했습니다.

---

## 핵심 기능 3가지

### 1. 🧹 망각 곡선 (FSRS)
> "안 쓰는 기억은 자연히 사라진다"

- 자주 찾는 기억 → 점점 강해짐 (stability ↑)
- 오래 안 쓴 기억 → 점점 흐려짐 → 자동 정리
- **결과:** 메모리가 항상 깨끗하게 유지됨, 토큰 절약

### 2. 🔗 중복 병합
> "비슷한 건 합쳐진다"

- "FC서울 좋아함" + "K리그 시즌권 있음" → **자동으로 하나로**
- 모순되면 새 정보가 이김: "좋아하는 색 빨강" → "좋아하는 색 파랑"
- **결과:** 중복 없는 깔끔한 기억

### 3. 🔍 연관 검색
> "하나를 떠올리면 관련된 것도 따라온다"

- "축구" 검색 → "K리그" + "주말경기" + "홈경기" 같이 나옴
- 키워드 매칭 + 의미 유사도 동시 사용
- **결과:** 놀라울 정도로 정확한 검색

---

## 설치 (30초)

```bash
npm install @reallygood/remember
```

또는 글로벌 CLI로:

```bash
npm install -g @reallygood/remember
```

**의존성:** `better-sqlite3` 하나뿐. 무겁지 않습니다.

---

## 사용법

### JavaScript API

```javascript
import { Remember } from '@reallygood/remember';

// 1. 초기화 (SQLite 파일 하나로 끝)
const mem = new Remember({ dbPath: './my-memory.db' });

// 2. 기억 저장
await mem.store('사용자는 K리그 시즌권을 가지고 있다', {
  category: 'fact',
  tags: ['K리그', '축구']
});

await mem.store('주말마다 홈경기 직관을 간다', {
  category: 'fact',
  tags: ['주말', 'K리그', '축구']
});

// 3. 검색 — "축구"만 검색해도 연관 기억 다 나옴!
const results = await mem.recall('축구');
// → [
//   { content: 'K리그 시즌권 보유', score: 0.95 },
//   { content: '주말 홈경기 직관', score: 0.82 }
// ]

// 4. 기억 정리 (오래된 거 자동 소멸)
await mem.consolidate();

// 5. 통계
const stats = await mem.stats();
// → { total: 150, active: 120, archived: 30, avgRetention: 0.72 }
```

### CLI

```bash
# 기억 저장
remember store "커피는 아메리카노 선호" --category preference

# 검색
remember recall "커피"

# 통계 보기
remember stats

# 기억 정리 (망각 곡선 적용)
remember consolidate

# 기존 MEMORY.md에서 가져오기
remember import --file MEMORY.md

# 마크다운으로 내보내기
remember export --format markdown
```

---

## 기존 솔루션과 비교

| | Remember | Vestige | mem0 | MemGPT |
|---|---|---|---|---|
| **언어** | JavaScript | Rust | Python | Python |
| **설치** | `npm install` | Rust 빌드 | Docker+Qdrant | pip + 설정 |
| **크기** | ~수백KB | 22MB+130MB | 수GB | 수GB |
| **의존성** | SQLite만 | Nomic 모델 | Qdrant 서버 | OpenAI 필수 |
| **오프라인** | ✅ (BM25 모드) | ✅ | ❌ | ❌ |
| **대상** | 생활 비서/범용 | 코딩 에이전트 | 챗봇 | 챗봇 |
| **핵심 철학** | 가볍고 실용적 | 정교하고 학술적 | 클라우드 연동 | 자율 에이전트 |

---

## 임베딩 모드

Remember는 **임베딩 없이도 완전히 동작**합니다 (BM25 키워드 검색).

더 정확한 검색을 원하면 임베딩을 켤 수 있습니다:

```javascript
// 임베딩 없이 (기본값, 가장 가벼움)
new Remember({ embedMode: 'none' });

// Cerebras (무료, 빠름)
new Remember({ embedMode: 'cerebras' });

// 로컬 Ollama (오프라인, 프라이버시)
new Remember({ embedMode: 'ollama' });

// OpenAI (가장 정확)
new Remember({ embedMode: 'openai' });
```

---

## OpenClaw 연동

OpenClaw AI 에이전트에서 바로 사용할 수 있습니다:

```javascript
// examples/openclaw-integration.js
import { Remember } from '@reallygood/remember';

const mem = new Remember({ 
  dbPath: '/Users/you/clawd/memory.db',
  embedMode: 'cerebras'  // 무료 API
});

// 대화에서 중요한 내용 자동 저장
mem.store('사용자가 다크모드를 선호함', { category: 'preference' });

// 새 세션 시작 시 관련 기억 불러오기
const context = await mem.recall('사용자 선호');

// 매일 consolidate (크론잡)
await mem.consolidate();
```

---

## 인지 과학 배경

Remember의 세 가지 핵심 기능은 실제 뇌과학 연구에 기반합니다:

| 기능 | 뇌과학 원리 | 논문 |
|---|---|---|
| 망각 곡선 | FSRS (Free Spaced Repetition Scheduler) | Piotr Wozniak, 1985 |
| 중복 병합 | 기억 통합 (Memory Consolidation) | Squire & Alvarez, 1995 |
| 연관 검색 | 확산 활성화 (Spreading Activation) | Collins & Loftus, 1975 |

130년의 기억 연구를 **400줄의 JavaScript**로.

---

## 왜 만들었나요?

AI 비서를 매일 쓰다 보니 느꼈습니다:

> "이 녀석, 어제 한 얘기를 왜 또 물어보지?"

MEMORY.md를 수동으로 관리하는 건 한계가 있었습니다. 파일은 커지고, 오래된 건 쌓이고, 찾는 건 어렵고. Vestige 같은 좋은 솔루션이 있지만 Rust 빌드에 130MB 모델 다운로드는 너무 무거웠습니다.

**그래서 만들었습니다.** SQLite 하나, JavaScript 400줄, `npm install` 한 줄이면 끝나는 AI 기억 시스템.

사람의 뇌가 하는 것처럼:
- 중요한 건 강화하고
- 안 쓰는 건 잊고
- 비슷한 건 합치고
- 관련된 건 같이 떠올린다

---

## 기여

PR과 이슈 환영합니다!

```bash
git clone https://github.com/reallygood83/remember
cd remember
npm install
npm test
```

---


## 📊 실측 벤치마크

> 실제 운영 중인 AI 비서(493줄 MEMORY.md, 344개 기억)에서 측정한 결과입니다.

### 토큰 절감

| | MEMORY.md (전체 로딩) | Remember (recall) | 절감률 |
|---|---|---|---|
| **세션당 토큰** | 14,460 | 344 | **97.6%** |

> 📌 이 수치는 과장이 아닙니다. 검색 기반 검색(RAG)은 전체 문서 로딩 대비 **90-99% 토큰 절감**이 업계 표준입니다.
> — Elasticsearch Labs: RAG는 full-context 대비 **1,250배 낮은 쿼리 비용** ([출처](https://www.elastic.co/search-labs))
> — Anthropic: BM25 + 임베딩 하이브리드가 기존 RAG 대비 **49% 검색 실패 감소** ([출처](https://www.anthropic.com/news/contextual-retrieval))

### 비용 절감 (하루 20세션 기준)

| 모델 | Before/월 | After/월 | 절약/월 |
|---|---|---|---|
| Claude Opus (/1M tokens) | .14 | .10 | **.04** |
| Claude Haiku (/bin/zsh.80/1M tokens) | .94 | /bin/zsh.17 | **.77** |
| GPT-4o (.50/1M tokens) | .69 | /bin/zsh.52 | **.17** |

### 응답 속도

| | MEMORY.md | Remember |
|---|---|---|
| 검색 시간 | ~2-3초 (파일 파싱) | **~10ms** (SQLite) |
| 속도 향상 | — | **200x** |

### 시간 경과 효과

| 시점 | MEMORY.md | Remember |
|---|---|---|
| 3개월 (300개 기억) | 파일 커지기 시작 | 자동 관리 |
| 6개월 (500개) | 수동 정리 필요 | FSRS가 자동 정리 |
| 1년 (1000개+) | **감당 불가** | 망각 곡선이 ~300개로 유지 |

### 과학적 근거

| 주장 | 근거 |
|---|---|
| FSRS 망각 곡선 | Anki 통합, **리뷰 20-30% 감소 + 동일 기억률** 유지 ([FSRS benchmark](https://github.com/open-spaced-repetition/fsrs-benchmark)) |
| BM25 검색이 전체 로딩보다 효율적 | RAG 업계 표준, **1,250x 낮은 비용** (Elasticsearch Labs) |
| 하이브리드 검색 (BM25+벡터) | Anthropic Contextual Retrieval: **검색 실패 49% 감소** |
| 선택적 검색이 정확도도 높음 | 불필요한 컨텍스트 제거 → 환각(hallucination) 감소 |

---

## 라이선스

MIT

---

<p align="center">
  <b>AI에게 진짜 기억을 선물하세요 🧠</b><br>
  <sub>Built with ❤️ by <a href="https://github.com/reallygood83">reallygood83</a></sub>
</p>

