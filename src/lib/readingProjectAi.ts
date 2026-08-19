import { ReadingSource, ReadingVocabPayload } from '../types';
import { normalizeBand } from './vocabUtils';

const MODEL_CANDIDATES = ['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'];

function requireApiKey(apiKey?: string) {
  const key = apiKey?.trim();
  if (!key) throw new Error('Vui lòng vào Settings nhập Gemini API Key rồi bấm Save Settings.');
  return key;
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

function extractText(payload: any) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((part: any) => part?.text).filter((value: unknown) => typeof value === 'string').join('\n');
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
  if (isQuotaMessage(message)) return false;
  const lower = message.toLowerCase();
  return [400, 404, 503].includes(status)
    || lower.includes('high demand')
    || lower.includes('overloaded')
    || lower.includes('temporarily')
    || lower.includes('not found')
    || lower.includes('unsupported')
    || lower.includes('unavailable');
}

async function generateContent(apiKey: string | undefined, textPrompt: string, sources: ReadingSource[] = []) {
  const key = requireApiKey(apiKey);
  const parts: any[] = [{ text: textPrompt }];

  sources.forEach(source => {
    if (source.type === 'text' && source.text?.trim()) {
      parts.push({ text: `\nSOURCE TEXT (${source.name}):\n${source.text.trim()}` });
      return;
    }
    if (!source.dataUrl) return;
    const base64 = source.dataUrl.includes(',') ? source.dataUrl.split(',')[1] : source.dataUrl;
    if (!base64) return;
    parts.push({
      inline_data: {
        mime_type: source.mimeType,
        data: base64,
      },
    });
  });

  let lastError = '';
  for (let index = 0; index < MODEL_CANDIDATES.length; index++) {
    const model = MODEL_CANDIDATES[index];
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.1,
          },
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error?.message || `Gemini API lỗi HTTP ${response.status}.`;
        lastError = `${model}: ${message}`;
        if (response.status === 401 || response.status === 403) {
          throw new Error('Gemini API Key không hợp lệ hoặc chưa có quyền dùng model này.');
        }
        if (isQuotaMessage(message)) {
          throw new Error('Gemini API đã hết quota free tier. Reading Project đã được lưu; hãy đợi quota reset rồi bấm Extract/Re-extract sau, không cần tạo project lại.');
        }
        if (index < MODEL_CANDIDATES.length - 1 && shouldTryNextModel(response.status, message)) continue;
        throw new Error(message);
      }

      const output = extractText(payload);
      if (!output) throw new Error(`${model} không trả về dữ liệu.`);
      return output;
    } catch (error: any) {
      const message = String(error?.message || 'Gemini API chưa phản hồi.');
      lastError = `${model}: ${message}`;
      if (message.includes('quota free tier') || message.includes('API Key không hợp lệ')) throw error;
      if (index < MODEL_CANDIDATES.length - 1) continue;
      throw new Error(lastError);
    }
  }

  throw new Error(lastError || 'Không thể xử lý Reading Project.');
}

export async function extractReadingText(sources: ReadingSource[], apiKey?: string) {
  if (sources.length === 0) throw new Error('Project chưa có source để extract.');
  const prompt = `You are extracting the full reading passage from user-provided source files for study.
Preserve paragraph order and wording as faithfully as possible.
Do NOT summarize, rewrite, simplify, translate, or extract vocabulary yet.
Ignore page numbers, watermarks, navigation chrome and unrelated UI text when clearly separate from the reading.
If there are multiple images/pages, combine them in the same logical reading order.
Return ONLY the extracted reading text, with paragraph breaks.`;
  return (await generateContent(apiKey, prompt, sources)).trim();
}

export async function extractReadingVocabulary(readingText: string, projectName: string, projectTopic: string, apiKey?: string): Promise<ReadingVocabPayload[]> {
  if (!readingText.trim()) throw new Error('Project chưa có Extracted Reading. Hãy extract bài đọc trước.');
  const prompt = `Extract useful IELTS vocabulary and collocations from this reading passage for a Vietnamese learner.
Project: ${projectName}
Project topic: ${projectTopic || 'General'}

Rules:
- Prefer useful B1-C2 vocabulary, academic words, phrasal verbs, and complete collocations.
- Preserve full multi-word phrases; do not shorten a collocation to one head word.
- Avoid trivial function words and duplicates.
- Keep the exact sentence from the reading where the item appears in sourceSentence.
- Keep a short surrounding paragraph or context in sourceParagraph when useful.
- Return at most 25 items.
- Return JSON array only. Each item must have exactly these fields:
word, ipa, wordType, meaning, definition, example, synonyms, antonyms, band, topic, sourceSentence, sourceParagraph.
- meaning must be Vietnamese.
- definition must be concise English.
- example can be a new natural example; sourceSentence must remain the sentence from the reading.
- band: Basic or one of 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0.

READING:\n${readingText}`;

  const output = await generateContent(apiKey, `${prompt}\n\nReturn JSON only.`);
  const parsed = parseJsonResponse(output);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item: any) => ({
      word: String(item?.word || '').trim(),
      ipa: String(item?.ipa || '').trim(),
      wordType: String(item?.wordType || '').trim(),
      meaning: String(item?.meaning || '').trim(),
      definition: String(item?.definition || '').trim(),
      example: String(item?.example || '').trim(),
      synonyms: String(item?.synonyms || '').trim(),
      antonyms: String(item?.antonyms || '').trim(),
      band: normalizeBand(item?.band),
      topic: String(item?.topic || projectTopic || 'General').trim(),
      sourceSentence: String(item?.sourceSentence || '').trim(),
      sourceParagraph: String(item?.sourceParagraph || '').trim(),
    }))
    .filter(item => item.word);
}
