export type PetActivity =
  | 'walk'
  | 'listen'
  | 'hint'
  | 'idle'
  | 'study'
  | 'think'
  | 'speak'
  | 'cheer'
  | 'hello'
  | 'rest'
  | 'sleep'
  | 'drag';
export type PetDestination = 'learn' | 'conversation' | 'settings';
export type PetAction =
  | 'walk'
  | 'listen'
  | 'hint'
  | 'hello'
  | 'cheer'
  | 'rest'
  | 'sleep'
  | 'idle'
  | 'hide'
  | 'learn'
  | 'conversation'
  | 'settings'
  | 'reset-position';
export type PetPreferences = {
  persona: 'buddy' | 'mentor' | 'whale';
  relationship: 'friend' | 'teacher' | 'partner';
  customPersona: string;
  enabled: boolean;
  locked: boolean;
  reducedMotion: boolean;
  bubbles: boolean;
  scale: number;
};
export type PetSnapshot = {
  chatOpen?: boolean;
  preferences: PetPreferences;
  activity: PetActivity;
  message: string;
  persistenceError: boolean;
};
export interface CompanionApi {
  resetPosition(): Promise<void>;
  getState(): Promise<PetSnapshot>;
  updatePreferences(patch: Partial<PetPreferences>): Promise<PetSnapshot>;
  onState(listener: (state: PetSnapshot) => void): () => void;
}
export interface MainCompanionApi extends CompanionApi {
  onLesson(listener: (lessonId: string) => void): () => void;
  setActivity(activity: 'idle' | 'study' | 'speak'): Promise<void>;
  onNavigate(listener: (destination: PetDestination) => void): () => void;
}
export interface DesktopPetApi extends CompanionApi {
  setChatOpen(open: boolean): Promise<void>;
  getChat(): Promise<PetChatMessage[]>;
  sendChat(message: string): Promise<PetChatMessage[]>;
  clearChat(): Promise<void>;
  openLesson(lessonId: string): Promise<void>;
  act(action: PetAction): Promise<void>;
  beginDrag(): Promise<boolean>;
  endDrag(): Promise<void>;
  setInteractive(interactive: boolean): Promise<void>;
}
export type PetRecommendation = {
  lessonId: string;
  title: string;
  reason: string;
  practice?: 'game' | 'matching' | 'puzzle';
};
export type PetChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  recommendations?: PetRecommendation[];
  followUp?: string;
};
declare global {
  interface Window {
    desktopPet: DesktopPetApi;
  }
}
