import { normalizeBand, normalizeWord } from './vocabUtils';

const MODEL = "gemini-3.5-flash";
const CACHE_VERSION = "v4";

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

function normalizeVocabPayload(item: VocabPayload): VocabPayload {
  return {
    ...item,
    band: normalizeBand(item.band),
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
Return one compact JSON object with exactly these fields: correctedWord, ipa, wordType, meaning, definition, example, synonyms, antonyms, band, topic.`;

  return normalizeVocabPayload(await generateJson(apiKey, prompt, cacheKey('define', word)));
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
