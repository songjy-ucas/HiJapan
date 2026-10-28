import { describe, expect, it } from 'vitest';
import rawContent from '../source/data/travel_priority_content.json';
import { contentPackSchema } from '../src/domain/content-schema';

describe('travel content pack', () => {
  it('matches the runtime schema and expected counts', () => {
    const content = contentPackSchema.parse(rawContent);
    expect(content.vocabulary).toHaveLength(438);
    expect(content.phrases).toHaveLength(231);
    expect(content.grammar).toHaveLength(30);
    expect(content.dialogues).toHaveLength(72);
    expect(content.lessons).toHaveLength(20);
  });

  it('has no missing lesson references', () => {
    const content = contentPackSchema.parse(rawContent);
    const ids = new Set(
      [...content.vocabulary, ...content.phrases].map((item) => item.id),
    );
    const missing = content.lessons.flatMap((lesson) =>
      `${lesson.vocab_ids},${lesson.phrase_ids}`
        .split(',')
        .filter(Boolean)
        .filter((id) => !ids.has(id)),
    );
    expect(missing).toEqual([]);
  });
});
