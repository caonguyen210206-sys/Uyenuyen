import { normalizeBand } from './vocabUtils';

const MODEL = "gemini-3.5-flash";

export type VocabPayload = {
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

const BAND_GUIDE = `Band must estimate vocabulary difficulty for IELTS learners, not essay score.
For very common daily words such as apple, school, book, happy, big, good, return "Basic" instead of a number.
For IELTS-level vocabulary, return a plain numeric string only, no word "Band". Use only one of these values: "5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "9.0".
B1 useful words: 5.0-5.5. B2 words: 6.0-6.5. C1-C2 or academic/formal words: 7.0-9.0.`;

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

async function generateJson(apiKey: string | undefined, prompt: string) {
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
      input: `${prompt}\n\n${BAND_GUIDE}\n\nReturn only valid JSON. Do not include markdown.`,
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

  return parseJsonResponse(text);
}

export async function defineWord(word: string, apiKey?: string): Promise<VocabPayload> {
  const prompt = `You are an expert English teacher. You are provided with a word: "${word}".
If the word is misspelled, correct it to the most likely intended valid English word.
Provide the definition of the word (or the corrected word) for a Vietnamese learner.
Respond ONLY with a valid JSON object matching this structure:
{
  "correctedWord": "The correct spelling of the word if there was a typo, otherwise the original word",
  "ipa": "phonetic transcription (e.g., /kɒn.fɪˈden.ʃəl/)",
  "wordType": "part of speech (e.g., adj., noun, verb)",
  "meaning": "Vietnamese meaning",
  "definition": "English definition",
  "example": "A short English example sentence",
  "synonyms": "comma-separated synonyms",
  "antonyms": "comma-separated antonyms",
  "band": "Basic for very common words, or numeric IELTS vocabulary difficulty, e.g. 5.5, 7.0",
  "topic": "General topic category"
}`;

  return normalizeVocabPayload(await generateJson(apiKey, prompt));
}

export async function processRawText(rawText: string, apiKey?: string): Promise<VocabPayload[]> {
  const prompt = `You are an expert English teacher. The user has provided some unstructured raw text containing vocabulary items.
Extract the vocabulary words and their details from the text. For any missing details, fill them in appropriately for a Vietnamese learner.
Respond ONLY with a JSON array of objects matching this structure:
[
  {
    "word": "The English word",
    "ipa": "phonetic transcription (e.g., /kɒn.fɪˈden.ʃəl/)",
    "wordType": "part of speech (e.g., adj., noun, verb)",
    "meaning": "Vietnamese meaning",
    "definition": "English definition",
    "example": "A short English example sentence",
    "synonyms": "comma-separated synonyms",
    "antonyms": "comma-separated antonyms",
    "band": "Basic for very common words, or numeric IELTS vocabulary difficulty, e.g. 5.5, 7.0",
    "topic": "General topic category"
  }
]

Text to process:
"${rawText}"`;

  return normalizeVocabArray(await generateJson(apiKey, prompt));
}

export async function extractVocabFromParagraph(paragraph: string, apiKey?: string): Promise<VocabPayload[]> {
  const prompt = `You are an expert English teacher. The user has provided a paragraph.
Identify the most useful, advanced, or important vocabulary words (up to 15 words) for an English learner from this paragraph.
Extract these words and provide detailed definitions for a Vietnamese learner.
Respond ONLY with a JSON array of objects matching this structure:
[
  {
    "word": "The English word",
    "ipa": "phonetic transcription (e.g., /kɒn.fɪˈden.ʃəl/)",
    "wordType": "part of speech (e.g., adj., noun, verb)",
    "meaning": "Vietnamese meaning",
    "definition": "English definition",
    "example": "An example sentence using the word",
    "synonyms": "comma-separated synonyms",
    "antonyms": "comma-separated antonyms",
    "band": "Basic for very common words, or numeric IELTS vocabulary difficulty, e.g. 5.5, 7.0",
    "topic": "General topic category"
  }
]

Paragraph:
"${paragraph}"`;

  return normalizeVocabArray(await generateJson(apiKey, prompt));
}

export async function testGeminiConnection(apiKey?: string) {
  await defineWord("hello", apiKey);
}
