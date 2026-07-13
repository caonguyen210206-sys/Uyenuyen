export type ViewState = 'dashboard' | 'library' | 'vocab-list' | 'practice' | 'monthly-review' | 'settings';

export type VocabStatus = 'Storage' | 'Studying' | 'Completed';
export type MasteryLevel = 'New' | 'Beginner' | 'Advanced' | 'Mastery';

export interface MiniQuiz {
  fillBlankQuestion: string;
  fillBlankAnswer: string;
  multipleChoiceQuestion: string;
  multipleChoiceOptions: string[];
  multipleChoiceAnswer: string;
  rewritePrompt: string;
  rewriteAnswer: string;
}

export interface VocabItem {
  id: string;
  word: string;
  ipa: string;
  wordType: string;
  meaning: string;
  definition: string;
  example: string;
  synonyms: string;
  antonyms: string;
  band: string;
  topic: string;
  status: VocabStatus;
  masteryLevel: MasteryLevel;
  source: string;
  createdAt: number;
  updatedAt?: number;
  lastScore?: number;
  timesChecked: number;
  miniQuiz?: MiniQuiz;
  ownerId?: string;
}

export interface QuizSession {
  id: string;
  mode: 'Vietnamese' | 'Foreign';
  questionCount: number;
  criteria: string[];
  score: number;
  submittedAt?: number;
  savedAt?: number;
  ownerId?: string;
  type?: string;
}

export interface QuizAnswer {
  id: string;
  vocabItemId: string;
  question: string; // The prompt shown
  
  // For each criteria
  c1_type?: string;
  c1_answer?: string;
  c1_correct?: string;
  c1_isCorrect?: boolean | 'partial';

  c2_type?: string;
  c2_answer?: string;
  c2_correct?: string;
  c2_isCorrect?: boolean | 'partial';
  
  c3_type?: string;
  c3_answer?: string;
  c3_correct?: string;
  c3_isCorrect?: boolean | 'partial';
}

export interface UserSettings {
  apiKey: string;
  defaultQuestions: number;
  defaultCriteria: string[];
  ownerId?: string;
}
