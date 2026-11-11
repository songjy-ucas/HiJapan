import type { PetActivity, PetPreferences } from '../shared/pet-contracts';

export const defaultPetPreferences: PetPreferences = {
  persona: 'buddy',
  relationship: 'friend',
  customPersona: '',
  enabled: true,
  locked: false,
  reducedMotion: false,
  bubbles: true,
  scale: 1,
};
export type WorkArea = { x: number; y: number; width: number; height: number };
export function clampPetPosition(
  position: { x: number; y: number },
  size: { width: number; height: number },
  area: WorkArea,
) {
  return {
    x: Math.round(
      Math.max(
        area.x,
        Math.min(position.x, area.x + Math.max(0, area.width - size.width)),
      ),
    ),
    y: Math.round(
      Math.max(
        area.y,
        Math.min(position.y, area.y + Math.max(0, area.height - size.height)),
      ),
    ),
  };
}
export function resolvePetActivity(
  base: PetActivity,
  reaction: PetActivity | null,
  dragging: boolean,
): PetActivity {
  if (dragging) return 'drag';
  if (base === 'sleep' || base === 'rest') return base;
  return reaction ?? base;
}
export const petMessages: Record<PetActivity, string> = {
  walk: '活动一下，再继续学习。',
  listen: '我在认真听你说，文字输入即可。',
  hint: '试着用自己的话回答刚才的问题。',
  idle: '今天也一起学一点日语吧。',
  hello: 'こんにちは！很高兴见到你。',
  study: '我在这里陪你，慢慢来。',
  think: '正在等候你的 AI 服务回复…',
  speak: '听一听，再跟着读一次吧。',
  cheer: 'よくできました！又前进了一步。',
  rest: '休息一下，喝口水吧。',
  sleep: 'おやすみ。点击菜单可唤醒我。',
  drag: '轻轻地，把我放在喜欢的位置。',
};
