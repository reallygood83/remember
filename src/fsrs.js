// FSRS (Free Spaced Repetition Scheduler) - lightweight implementation
// Based on the FSRS-4.5 algorithm

const DECAY = -0.5;
const FACTOR = 19 / 81;

export function initCard() {
  return {
    stability: 1.0,
    difficulty: 0.3,
    reps: 0,
    lapses: 0,
    state: 0, // 0=new, 1=learning, 2=review, 3=relearning
    last_review: null,
    next_review: null,
  };
}

export function retrievability(stability, elapsedDays) {
  if (stability <= 0 || elapsedDays <= 0) return 1.0;
  return Math.pow(1 + FACTOR * elapsedDays / stability, DECAY);
}

export function nextStability(s, d, r, rating) {
  // rating: 1=again, 2=hard, 3=good, 4=easy
  if (rating === 1) {
    // Lapse
    return Math.max(0.1, s * 0.5 * Math.pow(d, -0.2));
  }
  const hardPenalty = rating === 2 ? 0.8 : 1.0;
  const easyBonus = rating === 4 ? 1.3 : 1.0;
  // When r ≈ 1.0 (fresh review), use a minimum growth factor
  const retrievabilityFactor = Math.max(0.1, Math.exp((1 - r) * 0.5) - 1);
  return s * (1 + Math.exp(5.5 - d) * Math.pow(s, -0.2) *
    retrievabilityFactor * hardPenalty * easyBonus);
}

export function nextDifficulty(d, rating) {
  const delta = rating - 3;
  const next = d - delta * 0.1;
  // Mean reversion toward 0.5
  return Math.max(0.01, Math.min(1.0, next * 0.9 + 0.05));
}

export function schedule(card, rating = 3) {
  const now = new Date();
  const elapsed = card.last_review
    ? (now - new Date(card.last_review)) / 86400000
    : 0;

  const r = retrievability(card.stability, elapsed);
  const newS = nextStability(card.stability, card.difficulty, r, rating);
  const newD = nextDifficulty(card.difficulty, rating);

  const interval = Math.max(1, Math.round(newS * 9)); // days until ~90% retrievability
  const nextReview = new Date(now.getTime() + interval * 86400000);

  return {
    stability: newS,
    difficulty: newD,
    reps: card.reps + 1,
    lapses: rating === 1 ? card.lapses + 1 : card.lapses,
    state: rating === 1 ? 3 : 2,
    last_review: now.toISOString(),
    next_review: nextReview.toISOString(),
    retrievability: r,
    interval,
  };
}

export function shouldDecay(memory) {
  if (!memory.next_review) return false;
  const now = new Date();
  const next = new Date(memory.next_review);
  const elapsed = (now - next) / 86400000;
  // If overdue by more than 3x the stability, consider decayed
  return elapsed > memory.stability * 3;
}
