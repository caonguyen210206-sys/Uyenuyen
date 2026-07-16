import type { CollocationItem } from '../types';
import { normalizeBand, normalizeWord } from './vocabUtils';

// Free-tier friendly: collocation import is often heavier than word define, so use only light models.
const MODEL_CANDIDATES = [
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
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

function isQuotaMessage(message: string) {
  const lower = message.toLowerCase();
  return lower.includes('quota')
    || lower.includes('rate limit')
    || lower.includes('resource_exhausted')
    || lower.includes('free_tier')
    || lower.includes('exceeded');
}

function shouldTryNextModel(status: number, message: string) {
  const lower = message.toLowerCase();
  if (isQuotaMessage(message)) return false;
  return [400, 404, 503].includes(status)
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

function cleanRawLine(line: string) {
  return line
    .replace(/^\s*(?:\d+|[IVXLCDM]+)[\).\-:]\s+/i, '')
    .replace(/^\s*[-•*]\s+/, '')
    .trim();
}

function splitRawLine(line: string) {
  const cleaned = cleanRawLine(line);
  if (!cleaned) return null;

  const delimiterPatterns = [
    /\t+/,                 // table copy
    /\s{2,}/,              // two-column text copied from PDF/image
    /\s+[–—-]\s+/,         // phrase - meaning / phrase – meaning
    /\s*[:：]\s+/,          // phrase: meaning
  ];

  for (const pattern of delimiterPatterns) {
    const parts = cleaned.split(pattern).map(part => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return {
        phrase: parts[0],
        meaning: parts.slice(1).join(' '),
      };
    }
  }

  return {
    phrase: cleaned,
    meaning: '',
  };
}

function looksLikeUsefulPhrase(phrase: string) {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  if (phrase.length > 90) return false;
  return /[a-z]/i.test(phrase);
}

function parseRawCollocationList(text: string): CollocationPayload[] {
  const lines = text
    .split(/\r?\n/)
    .map(splitRawLine)
    .filter(Boolean) as Array<{ phrase: string; meaning: string }>;

  const parsed: CollocationPayload[] = [];
  const seen = new Set<string>();

  lines.forEach((item) => {
    const phrase = item.phrase.trim();
    const key = normalizeWord(phrase);
    if (!key || seen.has(key) || !looksLikeUsefulPhrase(phrase)) return;
    seen.add(key);

    parsed.push({
      phrase,
      meaning: item.meaning.trim(),
      definition: item.meaning.trim(),
      structure: 'IELTS Writing collocation',
      example: '',
      topic: 'IELTS Writing',
      band: '6.5',
    });
  });

  return parsed;
}

function buildQuotaError() {
  return new Error(
    'Gemini API key đã hết quota free tier trong project hiện tại. Để tiết kiệm quota, app đã dừng retry. Hãy nhập thủ công vài collocation, import text ngắn hơn, tránh import ảnh liên tục, đợi quota reset hoặc bật billing cho project API.'
  );
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
    if (attempt > 0) await delay(350);

    try {
      return await callGeminiModel(key, model, prompt, image);
    } catch (err: any) {
      const status = Number(err?.status || 0);
      const message = String(err?.message || 'Gemini API chưa phản hồi.');
      lastMessage = `${model}: ${message}`;

      if (status === 401 || status === 403) {
        throw new Error('Gemini API Key không hợp lệ hoặc chưa có quyền dùng model này. Hãy kiểm tra lại key trong Settings.');
      }

      if (isQuotaMessage(message)) {
        throw buildQuotaError();
      }

      if (attempt < MODEL_CANDIDATES.length - 1 && shouldTryNextModel(status, message)) {
        continue;
      }

      if (attempt < MODEL_CANDIDATES.length - 1) {
        continue;
      }
    }
  }

  throw new Error(`Gemini đang bận hoặc model nhẹ chưa khả dụng. App chỉ thử model nhẹ để tiết kiệm free quota. ${lastMessage}`);
}

export async function extractCollocationsFromText(text: string, apiKey?: string, mode: 'raw' | 'paragraph' = 'paragraph') {
  if (mode === 'raw') {
    const parsed = parseRawCollocationList(text);
    if (parsed.length > 0) return parsed.slice(0, 80);
  }

  const prompt = mode === 'raw'
    ? `Extract English collocations from this raw vocabulary/collocation list for a Vietnamese IELTS learner.
IMPORTANT: Preserve the full phrase exactly as written in the input. Do not shorten a long collocation to its head word or a shorter phrase. If a line is "make a significant contribution - đóng góp đáng kể", phrase must be exactly "make a significant contribution".
Prefer multi-word collocations of 2-7 words. Do not output single words unless the input itself is a single word.
Return a JSON array with at most 20 items. Each item must have exactly: phrase, meaning, definition, structure, example, topic, band.
Raw input: ${text}`
    : `Extract 5-10 useful English collocations from this paragraph for a Vietnamese IELTS learner.
Focus on natural word combinations, not single words.
Keep complete collocations such as "play a vital role" or "make a significant contribution"; do not shorten them to "play a role" or "contribution".
Return a JSON array. Each item must have exactly: phrase, meaning, definition, structure, example, topic, band.
Paragraph: ${text}`;

  return normalizeCollocationArray(await generateJson(apiKey, prompt));
}

export async function extractCollocationsFromImage(image: ImageInput, apiKey?: string) {
  const prompt = `Read this image and extract 5-10 useful English collocations for a Vietnamese IELTS learner.
The image may be a textbook page, notes, screenshot, or vocabulary list.
Extract complete collocations, not single words when possible. Preserve long collocations exactly as shown in the image.
Return a JSON array. Each item must have exactly: phrase, meaning, definition, structure, example, topic, band.`;

  return normalizeCollocationArray(await generateJson(apiKey, prompt, image));
}
