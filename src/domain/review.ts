import type { ReviewGrade } from '../shared/contracts';

export type ReviewState = {
  masteryScore: number;
  intervalDays: number;
  easeFactor: number;
  lapseCount: number;
  lastReviewAt: string | null;
  nextReviewAt: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function scheduleReview(
  previous: ReviewState | null,
  grade: ReviewGrade,
  now: Date,
): ReviewState {
  const current = previous ?? {
    masteryScore: 0,
    intervalDays: 0,
    easeFactor: 2.2,
    lapseCount: 0,
    lastReviewAt: null,
    nextReviewAt: now.toISOString(),
  };

  let masteryDelta = 0;
  let intervalDays = current.intervalDays;
  let lapseCount = current.lapseCount;
  let easeFactor = current.easeFactor;

  if (grade === 'again') {
    masteryDelta = -18;
    intervalDays = 10 / (24 * 60);
    lapseCount += 1;
    easeFactor = clamp(easeFactor - 0.15, 1.3, 3.0);
  } else if (grade === 'hard') {
    masteryDelta = 3;
    intervalDays = Math.max(1, intervalDays * 1.2 || 1);
    easeFactor = clamp(easeFactor - 0.05, 1.3, 3.0);
  } else if (grade === 'good') {
    masteryDelta = 9;
    intervalDays = intervalDays === 0 ? 1 : Math.max(1, intervalDays * 2.2);
  } else {
    masteryDelta = 14;
    intervalDays = intervalDays === 0 ? 3 : Math.max(3, intervalDays * 3.2);
    easeFactor = clamp(easeFactor + 0.05, 1.3, 3.0);
  }

  return {
    masteryScore: clamp(current.masteryScore + masteryDelta, 0, 100),
    intervalDays: Number(intervalDays.toFixed(4)),
    easeFactor: Number(easeFactor.toFixed(2)),
    lapseCount,
    lastReviewAt: now.toISOString(),
    nextReviewAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
  };
}
