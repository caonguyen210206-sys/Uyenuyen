export type ViewState = 'dashboard' | 'library' | 'vocab-list' | 'collocations' | 'crime-collocations' | 'reading-projects' | 'practice' | 'monthly-review' | 'settings';

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

export interface VocabProjectSource {
  projectId: string;
  projectName: string;
  sourceSentence?: string;
  sourceParagraph?: string;
  addedAt: number;
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
  projectIds?: string[];
  projectSources?: VocabProjectSource[];
  ownerId?: string;
}

export interface CollocationItem {
  id: string;
  phrase: string;
  meaning: string;
  definition: string;
  structure: string;
  example: string;
  topic: string;
  band: string;
  status: VocabStatus;
  source: string;
  createdAt: number;
  updatedAt?: number;
  timesChecked: number;
  ownerId?: string;
}

export type ReadingSourceType = 'image' | 'pdf' | 'text';

export interface ReadingSource {
  id: string;
  projectId: string;
  type: ReadingSourceType;
  name: string;
  mimeType: string;
  dataUrl?: string;
  text?: string;
  createdAt: number;
  ownerId?: string;
}

export interface ReadingProject {
  id: string;
  name: string;
  topic: string;
  sourceIds: string[];
  extractedText: string;
  vocabIds: string[];
  createdAt: number;
  updatedAt: number;
  lastExtractedAt?: number;
  lastVocabExtractedAt?: number;
  lastStudiedAt?: number;
  ownerId?: string;
}

export interface ReadingVocabPayload {
  word: string;
  ipa?: string;
  wordType?: string;
  meaning?: string;
  definition?: string;
  example?: string;
  synonyms?: string;
  antonyms?: string;
  band?: string;
  topic?: string;
  sourceSentence?: string;
  sourceParagraph?: string;
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
  question: string;

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
  defaultCollocationsSeeded?: boolean;
  crimeCollocationsSeeded?: boolean;
  crimeCollocationsSeedVersion?: number;
  ownerId?: string;
}
