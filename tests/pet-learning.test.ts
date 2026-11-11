import { describe, it, expect } from 'vitest';
import {
  searchPetLessons,
  enforcePetRecommendations,
  personaPrompt,
  petCatalog,
  isPetLearningRequest,
  casualPetPrompt,
} from '../src/domain/pet-learning';
import { defaultPetPreferences } from '../src/domain/pet';
describe('pet course grounding', () => {
  it('does not turn greetings or ordinary conversation into lessons', () => {
    for (const text of [
      'はじめまして',
      'こんにちは！',
      '今天好累啊',
      '我今天学了日语',
      '不想学了，聊聊天',
      '只想聊天',
    ])
      expect(isPetLearningRequest(text, '你觉得哪个是主语？')).toBe(false);
    const prompt = casualPetPrompt(defaultPetPreferences);
    expect(prompt).toContain('当前是普通聊天');
    expect(prompt).toContain('不讲这句话的意思');
    expect(prompt).not.toContain('必须推荐');
  });
  it('only enables instruction for a request or explicit answer to a requested exercise', () => {
    for (const text of [
      'は和が有什么区别',
      'はじめまして是什么意思',
      '帮我翻译这句话',
      '教我五十音',
      '这个词怎么读',
      '推荐相关课程',
    ])
      expect(isPetLearningRequest(text)).toBe(true);
    expect(isPetLearningRequest('是主语', '这里が是什么作用？')).toBe(true);
    expect(isPetLearningRequest('是主语')).toBe(false);
  });
  it('retrieves real grammar courses and fills missing or invalid recommendations', () => {
    const candidates = searchPetLessons('は和が有什么区别');
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.lessonId).toBe('jlpt-n5-001');
    const result = enforcePetRecommendations(
      [{ lessonId: 'invented', title: 'fake', reason: 'fake' }],
      candidates,
    );
    expect(result.length).toBeGreaterThan(0);
    expect(
      candidates.some((item) => item.lessonId === result[0]!.lessonId),
    ).toBe(true);
    expect(enforcePetRecommendations([], [])).toEqual([]);
  });
  it('covers kana and travel as well as JLPT and separates persona from instruction authority', () => {
    expect(petCatalog.some((item) => item.lessonId.startsWith('kana-'))).toBe(
      true,
    );
    expect(petCatalog.some((item) => item.lessonId === 'HOT-L01')).toBe(true);
    const prompt = personaPrompt({
      ...defaultPetPreferences,
      persona: 'whale',
      relationship: 'partner',
    });
    expect(prompt).toContain('鲸鱼');
    expect(prompt).toContain('成年');
    expect(prompt).toContain('不改变知识准确性');
  });
});
