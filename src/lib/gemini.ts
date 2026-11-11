import type { MiniQuiz, VocabItem } from '../types';
import { GEMINI_FLASH_LITE_MODELS, isGeminiKeyError, isGeminiQuotaError } from './geminiModels';
import { normalizeBand, normalizeWord } from './vocabUtils';

const CACHE_VERSION = 'v11';

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

type GeminiError = Error & {
  status?: number;
  network?: boolean;
};

const BAND_GUIDE = `Band estimates IELTS vocabulary difficulty, not essay score.
Very common daily words such as apple, school, book, happy, big, good => "Basic".
IELTS-level words only use: "5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "9.0".
B1 useful words: 5.0-5.5. B2 words: 6.0-6.5. C1-C2/academic/formal words: 7.0-9.0.`;

function requireApiKey(apiKey?: string) {
  if (!apiKey?.trim()) {
    throw new Error('Vui lòng vào Settings nhập Gemini API Key rồi bấm Save Settings.');
  }
  return apiKey.trim();
}

function parseJsonResponse(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
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

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractGenerateContentText(payload: any) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .filter(part => !part?.thought)
    .map((part: any) => part?.text)
    .filter((text: unknown) => typeof text === 'string')
    .join('\n');
}

function buildQuotaError() {
  return new Error(
    'Gemini đã chạm giới hạn sử dụng. Bạn có thể thử lại sau hoặc nhập từ thủ công.'
  );
}

function buildNetworkError() {
  return new Error(
    'Không kết nối được với Gemini. Hãy kiểm tra mạng rồi thử lại.'
  );
}

async function callGeminiModel(apiKey: string, model: string, prompt: string) {
  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${prompt}\n\n${BAND_GUIDE}\nReturn JSON only. No markdown. Keep values concise but complete.`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    });
  } catch (error: any) {
    const networkError = new Error(String(error?.message || 'Failed to fetch')) as GeminiError;
    networkError.network = true;
    throw networkError;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message || `Gemini API lỗi HTTP ${response.status}.`;
    const error = new Error(message) as GeminiError;
    error.status = response.status;
    throw error;
  }

  const text = extractGenerateContentText(payload);
  if (!text) {
    throw new Error(`${model} không trả về dữ liệu.`);
  }

  return parseJsonResponse(text);
}

async function generateJson(apiKey: string | undefined, prompt: string, cacheId?: string) {
  if (cacheId) {
    const cached = readCache<unknown>(cacheId);
    if (cached) return cached;
  }

  const key = requireApiKey(apiKey);
  let networkFailures = 0;

  for (const [attempt, model] of GEMINI_FLASH_LITE_MODELS.entries()) {
    if (attempt > 0) await delay(500);

    try {
      const parsed = await callGeminiModel(key, model, prompt);
      if (cacheId) writeCache(cacheId, parsed);
      return parsed;
    } catch (error) {
      const err = error as GeminiError;
      const status = err.status ?? 0;
      if (err.network) {
        networkFailures += 1;
      }

      if (isGeminiKeyError(status, err.message)) {
        throw new Error('Gemini API Key không hợp lệ hoặc chưa có quyền dùng model này. Hãy kiểm tra lại key trong Settings.');
      }

      if (isGeminiQuotaError(status, err.message)) {
        throw buildQuotaError();
      }
    }
  }

  if (networkFailures === GEMINI_FLASH_LITE_MODELS.length) {
    throw buildNetworkError();
  }

  throw new Error('Gemini đang bận hoặc chưa phản hồi. Bạn có thể thử lại sau hoặc nhập từ thủ công.');
}

export async function defineWord(word: string, apiKey?: string): Promise<VocabPayload> {
  const prompt = `Define this English word for a Vietnamese IELTS learner: "${word}".
If misspelled, fix it in correctedWord; otherwise correctedWord is the original word.
Return one compact JSON object with exactly these fields: correctedWord, ipa, wordType, meaning, definition, example, synonyms, antonyms, band, topic.`;

  return normalizeVocabPayload(await generateJson(apiKey, prompt, cacheKey('define', word)));
}

export async function generateMiniQuiz(item: Pick<VocabItem, 'word' | 'meaning' | 'definition' | 'example' | 'wordType'>, apiKey?: string): Promise<MiniQuiz> {
  const prompt = `Create a short mini quiz for this vocabulary item.
Word: ${item.word}
Meaning: ${item.meaning}
Definition: ${item.definition}
Example: ${item.example}
Word type: ${item.wordType}
Return one JSON object with exactly: fillBlankQuestion, fillBlankAnswer, multipleChoiceQuestion, multipleChoiceOptions, multipleChoiceAnswer, rewritePrompt, rewriteAnswer. Use exactly 4 options.`;

  const quiz = normalizeMiniQuiz(await generateJson(apiKey, prompt, cacheKey('mini-quiz', `${item.word}|${item.meaning}|${item.definition}`)));
  if (!quiz) throw new Error('Gemini không tạo được mini quiz cho từ này.');
  return quiz;
}

export async function processRawText(rawText: string, apiKey?: string): Promise<VocabPayload[]> {
  const prompt = `Extract vocabulary items and collocations from this raw text for a Vietnamese IELTS learner.
IMPORTANT: If the input contains a multi-word phrase/collocation, keep the full phrase exactly in the word field. Do not shorten it to one word or to a smaller phrase.
Examples:
- "make a significant contribution" must remain "make a significant contribution", not "contribution".
- "play a vital role" must remain "play a vital role", not "role".
If the input line already has meaning after a dash/colon/tab, preserve the phrase before the delimiter exactly.
Return a JSON array with at most 20 items. Each item must have: word, ipa, wordType, meaning, definition, example, synonyms, antonyms, band, topic.
For multi-word phrases, use wordType "collocation" or "phrase".
Text: ${rawText}`;

  return normalizeVocabArray(await generateJson(apiKey, prompt, cacheKey('raw-long-phrases', rawText)));
}

export async function extractVocabFromParagraph(paragraph: string, apiKey?: string): Promise<VocabPayload[]> {
  const prompt = `Extract up to 8 useful vocabulary words from this paragraph for a Vietnamese IELTS learner.
Return a JSON array. Each item must have: word, ipa, wordType, meaning, definition, example, synonyms, antonyms, band, topic.
Paragraph: ${paragraph}`;

  return normalizeVocabArray(await generateJson(apiKey, prompt, cacheKey('paragraph', paragraph)));
}

export async function testGeminiConnection(apiKey?: string) {
  const prompt = `Return one JSON object with exactly this field: ok. Set ok to true.`;
  await generateJson(apiKey, prompt);
}
