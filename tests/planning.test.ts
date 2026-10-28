import { describe, expect, it } from 'vitest';
import { buildTodayPlan } from '../src/domain/planning';
import type { LessonSummary } from '../src/shared/contracts';

const lesson: LessonSummary = {
  lessonId: 'HOT-L01',
  scene: 'hotel',
  title: '预约与房型',
  objectives: '确认预约',
  minutes: 8,
  level: 'starter',
  itemCount: 7,
  status: 'not_started',
  reviewStatus: 'draft_needs_native_review',
};

describe('buildTodayPlan', () => {
  it('prioritizes reviews before new lessons', () => {
    const result = buildTodayPlan({
      dailyMinutes: 10,
      dueReviewCount: 8,
      lessons: [lesson],
    });
    expect(result[0]?.type).toBe('review');
    expect(result[1]?.type).toBe('lesson');
  });

  it('is deterministic for identical input', () => {
    const input = { dailyMinutes: 20, dueReviewCount: 0, lessons: [lesson] };
    expect(buildTodayPlan(input)).toEqual(buildTodayPlan(input));
  });

  it('does not require AI input', () => {
    const result = buildTodayPlan({
      dailyMinutes: 5,
      dueReviewCount: 0,
      lessons: [lesson],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.lessonId).toBe('HOT-L01');
  });
});
