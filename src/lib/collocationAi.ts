import type { CollocationItem } from '../types';
import { normalizeBand, normalizeWord } from './vocabUtils';

const MODEL_CANDIDATES = [
  'gemini-3.1-pro',
  'gemini-2.5-pro',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
];

const BAND_GUIDE = `Band estimates IELTS collocation difficulty, not essay score.
Use "Basic" only for very simple daily collocations.
For IELTS-level collocations, use only: "5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "9.0".`;

export type CollocationPayload = Partial<Pick<CollocationItem, 'phrase' | 'meaning' | 'definition' | 'structure' | 'example' | 'topic' | 'band'>>;

type ImageInput = {
  base64: string;
  mimeType: string;
};

function requireApiKey(apiKey?: string) {
  const key = apiKey?.trim();
  if (!key) throw new Error('Vui lòng vào Settings nhập Gemini API Key rồi bấm Save Settings.');
  return key;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

function extractGenerateContentText(payload: any) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part: any) => part?.text)
    .filter((text: unknown) => typeof text === 'string')
    .join('\n');
}

function shouldTryNextModel(status: number, message: string) {
  const lower = message.toLowerCase();
  return [400, 404, 429, 503].includes(status)
    || lower.includes('high demand')
    || lower.includes('overloaded')
    || lower.includes('temporarily')
    || lower.includes('not found')
    || lower.includes('unsupported')
    || lower.includes('unavailable');
}

function normalizeCollocation(item: CollocationPayload): CollocationPayload | null {
  const phrase = String(item.phrase || '').trim();
  if (!normalizeWord(phrase)) return null;
  return {
    phrase,
    meaning: String(item.meaning || '').trim(),
    definition: String(item.definition || '').trim(),
    structure: String(item.structure || '').trim(),
    example: String(item.example || '').trim(),
    topic: String(item.topic || '').trim() || 'General',
    band: normalizeBand(item.band) || 'Basic',
  };
}

function normalizeCollocationArray(data: unknown): CollocationPayload[] {
  if (!Array.isArray(data)) return [];
  return data
    .map(item => normalizeCollocation(item || {}))
    .filter(Boolean) as CollocationPayload[];
}

async function callGeminiModel(apiKey: string, model: string, prompt: string, image?: ImageInput) {
  const parts: any[] = [
    {
      text: `${prompt}\n\n${BAND_GUIDE}\nReturn JSON only. No markdown.`,
    },
  ];

  if (image) {
    parts.push({
      inline_data: {
        mime_type: image.mimeType,
        data: image.base64,
      },
    });
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      generationConfig: {
        temperature: 0.2,
        response_mime_type: 'application/json',
      },
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || `Gemini API lỗi HTTP ${response.status}.`;
    const error = new Error(message) as Error & { status?: number; model?: string };
    error.status = response.status;
    error.model = model;
    throw error;
  }

  const text = extractGenerateContentText(payload);
  if (!text) throw new Error(`${model} không trả về dữ liệu.`);
  return parseJsonResponse(text);
}

async function generateJson(apiKey: string | undefined, prompt: string, image?: ImageInput) {
  const key = requireApiKey(apiKey);
  let lastMessage = '';

  for (let attempt = 0; attempt < MODEL_CANDIDATES.length; attempt++) {
    const model = MODEL_CANDIDATES[attempt];
    if (attempt > 0) await delay(500);

    try {
      return await callGeminiModel(key, model, prompt, image);
    } catch (err: any) {
      const status = Number(err?.status || 0);
      const message = String(err?.message || 'Gemini API chưa phản hồi.');
      lastMessage = `${model}: ${message}`;

      if (attempt < MODEL_CANDIDATES.length - 1 && shouldTryNextModel(status, message)) {
        continue;
      }

      if (status === 401 || status === 403) {
        throw new Error('Gemini API Key không hợp lệ hoặc chưa có quyền dùng model này. Hãy kiểm tra lại key trong Settings.');
      }

      throw new Error(message);
    }
  }

  throw new Error(`Gemini đang bận hoặc model chưa khả dụng. Đã thử nhiều model. ${lastMessage}`);
}

export async function extractCollocationsFromText(text: string, apiKey?: string, mode: 'raw' | 'paragraph' = 'paragraph') {
  const prompt = mode === 'raw'
    ? `Extract English collocations from this raw vocabulary/collocation list for a Vietnamese IELTS learner.
Return a JSON array. Each item must have exactly: phrase, meaning, definition, structure, example, topic, band.
Raw input: ${text}`
    : `Extract 8-20 useful English collocations from this paragraph for a Vietnamese IELTS learner.
Focus on natural word combinations, not single words.
Return a JSON array. Each item must have exactly: phrase, meaning, definition, structure, example, topic, band.
Paragraph: ${text}`;

  return normalizeCollocationArray(await generateJson(apiKey, prompt));
}

export async function extractCollocationsFromImage(image: ImageInput, apiKey?: string) {
  const prompt = `Read this image and extract useful English collocations for a Vietnamese IELTS learner.
The image may be a textbook page, notes, screenshot, or handwritten/typed vocabulary list.
Extract collocations, not single words when possible.
Return a JSON array. Each item must have exactly: phrase, meaning, definition, structure, example, topic, band.`;

  return normalizeCollocationArray(await generateJson(apiKey, prompt, image));
}
