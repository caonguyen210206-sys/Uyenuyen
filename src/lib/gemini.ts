import type { MiniQuiz, VocabItem } from '../types';
import { normalizeBand, normalizeWord } from './vocabUtils';

const MODEL = "gemini-3.5-flash";
const CACHE_VERSION = "v5";

type VocabPayload = {
  correctedWord?: string;
  word?: string;
  ipa?: string;
  wordType?: string;
  meaning?: string;
  definition?: string;
  example?: string;
  synonyms?: string;
  antonyms?: string;
  band?: string;
  topic?: string;
  miniQuiz?: MiniQuiz;
};

const BAND_GUIDE = `Band estimates IELTS vocabulary difficulty, not essay score.
Very common daily words such as apple, school, book, happy, big, good => "Basic".
IELTS-level words only use: "5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "9.0".
B1 useful words: 5.0-5.5. B2 words: 6.0-6.5. C1-C2/academic/formal words: 7.0-9.0.`;

function requireApiKey(apiKey?: string) {
  if (!apiKey?.trim()) {
    throw new Error("Vui lòng vào Settings nhập Gemini API Key rồi bấm Save Settings.");
  }
  return apiKey.trim();
}

function parseJsonResponse(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return JSON.parse(cleaned);
}

function normalizeMiniQuiz(raw: any): MiniQuiz | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const options = Array.isArray(raw.multipleChoiceOptions)
    ? raw.multipleChoiceOptions.map((option: unknown) => String(option || '').trim()).filter(Boolean).slice(0, 4)
    : [];

  const quiz: MiniQuiz = {
    fillBlankQuestion: String(raw.fillBlankQuestion || '').trim(),
    fillBlankAnswer: String(raw.fillBlankAnswer || '').trim(),
    multipleChoiceQuestion: String(raw.multipleChoiceQuestion || '').trim(),
    multipleChoiceOptions: options,
    multipleChoiceAnswer: String(raw.multipleChoiceAnswer || '').trim(),
    rewritePrompt: String(raw.rewritePrompt || '').trim(),
    rewriteAnswer: String(raw.rewriteAnswer || '').trim(),
  };

  const hasUsefulContent = quiz.fillBlankQuestion || quiz.multipleChoiceQuestion || quiz.rewritePrompt;
  return hasUsefulContent ? quiz : undefined;
}

function normalizeVocabPayload(item: VocabPayload): VocabPayload {
  const miniQuiz = normalizeMiniQuiz(item.miniQuiz);
  return {
    ...item,
    band: normalizeBand(item.band),
    ...(miniQuiz ? { miniQuiz } : {}),
  };
}

function normalizeVocabArray(data: unknown): VocabPayload[] {
  if (!Array.isArray(data)) return [];
  return data.map(item => normalizeVocabPayload(item || {}));
}

function simpleHash(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = Math.imul(31, hash) + input.charCodeAt(i) | 0;
  }
  return Math.abs(hash).toString(36);
}

function cacheKey(type: string, input: string) {
  return `uyenuyen-ai-cache:${CACHE_VERSION}:${type}:${simpleHash(normalizeWord(input) || input.trim())}`;
}

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Cache is only a speed optimization. Ignore storage errors.
  }
}

function extractInteractionText(payload: any) {
  if (typeof payload?.output_text === "string") {
    return payload.output_text;
  }

  const steps = Array.isArray(payload?.steps) ? payload.steps : [];
  for (let i = steps.length - 1; i >= 0; i--) {
    const content = steps[i]?.content;
    if (!Array.isArray(content)) continue;
    const textParts = content
      .map((part: any) => part?.text)
      .filter((text: unknown) => typeof text === "string");
    if (textParts.length > 0) {
      return textParts.join("\n");
    }
  }

  return "";
}

async function generateJson(apiKey: string | undefined, prompt: string, cacheId?: string) {
  if (cacheId) {
    const cached = readCache<unknown>(cacheId);
    if (cached) return cached;
  }

  const key = requireApiKey(apiKey);
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      model: MODEL,
      store: false,
      input: `${prompt}\n\n${BAND_GUIDE}\nReturn JSON only. Keep values concise but complete.`,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message || `Gemini API lỗi HTTP ${response.status}.`;
    throw new Error(message);
  }

  const text = extractInteractionText(payload);
  if (!text) {
    throw new Error("Gemini không trả về dữ liệu.");
  }

  const parsed = parseJsonResponse(text);
  if (cacheId) writeCache(cacheId, parsed);
  return parsed;
}

export async function defineWord(word: string, apiKey?: string): Promise<VocabPayload> {
  const prompt = `Define this English word for a Vietnamese IELTS learner: "${word}".
If misspelled, fix it in correctedWord; otherwise correctedWord is the original word.
Return one compact JSON object with exactly these fields: correctedWord, ipa, wordType, meaning, definition, example, synonyms, antonyms, band, topic, miniQuiz.
miniQuiz must be an object with exactly these fields:
- fillBlankQuestion: one sentence with one blank shown as _____
- fillBlankAnswer: the target word
- multipleChoiceQuestion: a short question testing meaning or usage
- multipleChoiceOptions: exactly 4 answer options
- multipleChoiceAnswer: the correct option text
- rewritePrompt: one Vietnamese or English prompt asking the learner to use the word in a new sentence
- rewriteAnswer: one natural model answer.`;

  return normalizeVocabPayload(await generateJson(apiKey, prompt, cacheKey('define', word)));
}

export async function generateMiniQuiz(item: Pick<VocabItem, 'word' | 'meaning' | 'definition' | 'example' | 'wordType'>, apiKey?: string): Promise<MiniQuiz> {
  const prompt = `Create a mini quiz for this English vocabulary item for a Vietnamese IELTS learner.
Word: ${item.word}
Meaning in Vietnamese: ${item.meaning}
Definition: ${item.definition}
Example: ${item.example}
Word type: ${item.wordType}
Return one JSON object with exactly these fields: fillBlankQuestion, fillBlankAnswer, multipleChoiceQuestion, multipleChoiceOptions, multipleChoiceAnswer, rewritePrompt, rewriteAnswer.
multipleChoiceOptions must contain exactly 4 options. The correct answer must be included in multipleChoiceOptions.`;

  const quiz = normalizeMiniQuiz(await generateJson(apiKey, prompt, cacheKey('mini-quiz', `${item.word}|${item.meaning}|${item.definition}`)));
  if (!quiz) throw new Error('Gemini không tạo được mini quiz cho từ này.');
  return quiz;
}

export async function processRawText(rawText: string, apiKey?: string): Promise<VocabPayload[]> {
  const prompt = `Extract vocabulary from this raw text for a Vietnamese IELTS learner.
Return a JSON array. Each item must have: word, ipa, wordType, meaning, definition, example, synonyms, antonyms, band, topic.
Text: ${rawText}`;

  return normalizeVocabArray(await generateJson(apiKey, prompt, cacheKey('raw', rawText)));
}

export async function extractVocabFromParagraph(paragraph: string, apiKey?: string): Promise<VocabPayload[]> {
  const prompt = `Extract up to 15 useful vocabulary words from this paragraph for a Vietnamese IELTS learner.
Return a JSON array. Each item must have: word, ipa, wordType, meaning, definition, example, synonyms, antonyms, band, topic.
Paragraph: ${paragraph}`;

  return normalizeVocabArray(await generateJson(apiKey, prompt, cacheKey('paragraph', paragraph)));
}

export async function testGeminiConnection(apiKey?: string) {
  await defineWord("hello", apiKey);
}
