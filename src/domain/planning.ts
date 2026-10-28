import type { LessonSummary, TodayTask } from '../shared/contracts';

type PlanInput = {
  dailyMinutes: number;
  dueReviewCount: number;
  lessons: LessonSummary[];
};

export function buildTodayPlan(input: PlanInput): TodayTask[] {
  const tasks: TodayTask[] = [];
  let remaining = input.dailyMinutes;

  if (input.dueReviewCount > 0 && remaining > 0) {
    const minutes = Math.min(
      5,
      Math.max(2, Math.ceil(input.dueReviewCount / 4)),
    );
    tasks.push({
      id: 'due-reviews',
      type: 'review',
      title: `复习 ${input.dueReviewCount} 个到期内容`,
      detail: '先巩固已经学过的内容，避免遗忘。',
      minutes,
    });
    remaining -= minutes;
  }

  const nextLesson =
    input.lessons.find((lesson) => lesson.status === 'in_progress') ??
    input.lessons.find((lesson) => lesson.status === 'not_started');

  if (nextLesson && remaining > 0) {
    const minutes = Math.min(nextLesson.minutes, Math.max(3, remaining));
    tasks.push({
      id: `lesson-${nextLesson.lessonId}`,
      type: 'lesson',
      title: nextLesson.title,
      detail: `${nextLesson.objectives} · ${nextLesson.scene}`,
      minutes,
      lessonId: nextLesson.lessonId,
    });
    remaining -= minutes;
  }

  if (remaining >= 3) {
    tasks.push({
      id: 'fixed-dialogue',
      type: 'dialogue',
      title: '固定场景对话',
      detail: '跟读一组经过整理的旅行对话，不需要 AI。',
      minutes: Math.min(remaining, 5),
    });
  }

  return tasks;
}
