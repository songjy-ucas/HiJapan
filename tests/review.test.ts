import { describe, expect, it } from 'vitest';
import { scheduleReview } from '../src/domain/review';

const now = new Date('2026-10-28T00:00:00.000Z');

describe('scheduleReview', () => {
  it('schedules a new good answer for the next day', () => {
    const result = scheduleReview(null, 'good', now);
    expect(result.masteryScore).toBe(9);
    expect(result.intervalDays).toBe(1);
    expect(result.nextReviewAt).toBe('2026-10-29T00:00:00.000Z');
  });

  it('returns a forgotten item in ten minutes', () => {
    const result = scheduleReview(
      {
        masteryScore: 40,
        intervalDays: 7,
        easeFactor: 2.2,
        lapseCount: 1,
        lastReviewAt: null,
        nextReviewAt: now.toISOString(),
      },
      'again',
      now,
    );
    expect(result.masteryScore).toBe(22);
    expect(result.lapseCount).toBe(2);
    expect(new Date(result.nextReviewAt).getTime() - now.getTime()).toBe(
      10 * 60 * 1000,
    );
  });

  it('clamps mastery to the supported range', () => {
    const result = scheduleReview(
      {
        masteryScore: 96,
        intervalDays: 10,
        easeFactor: 2.2,
        lapseCount: 0,
        lastReviewAt: null,
        nextReviewAt: now.toISOString(),
      },
      'easy',
      now,
    );
    expect(result.masteryScore).toBe(100);
  });
});
