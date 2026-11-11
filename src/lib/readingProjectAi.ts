import { ReadingSource, ReadingVocabPayload } from '../types';
import { GEMINI_FLASH_LITE_MODELS, isGeminiKeyError, isGeminiQuotaError } from './geminiModels';
import { normalizeBand } from './vocabUtils';

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

async function generateContent(apiKey: string | undefined, textPrompt: string, sources: ReadingSource[] = [], maxOutputTokens = 8192) {
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
  for (const model of GEMINI_FLASH_LITE_MODELS) {
    let response: Response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens,
          },
        }),
      });
    } catch (error: any) {
      const message = String(error?.message || 'Gemini API chưa phản hồi.');
      lastError = `${model}: ${message}`;
      continue;
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.error?.message || `Gemini API lỗi HTTP ${response.status}.`;
      if (isGeminiKeyError(response.status, message)) {
        throw new Error('Gemini API Key không hợp lệ hoặc chưa có quyền dùng model này.');
      }
      if (isGeminiQuotaError(response.status, message)) {
        throw new Error('Gemini API đã chạm giới hạn sử dụng. Reading Project đã được lưu. Hãy thử lại với Extract/Re-extract sau.');
      }
      lastError = `${model}: ${message}`;
      continue;
    }

    const output = extractText(payload);
    if (output) return output;
    lastError = `${model} không trả về dữ liệu.`;
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
  return (await generateContent(apiKey, prompt, sources, 8192)).trim();
}

function getVocabularyTarget(readingText: string) {
  const wordCount = readingText.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 300) return { targetMin: 18, targetMax: 30 };
  if (wordCount < 600) return { targetMin: 25, targetMax: 38 };
  if (wordCount < 1000) return { targetMin: 32, targetMax: 45 };
  return { targetMin: 38, targetMax: 50 };
}

export async function extractReadingVocabulary(readingText: string, projectName: string, projectTopic: string, apiKey?: string): Promise<ReadingVocabPayload[]> {
  if (!readingText.trim()) throw new Error('Project chưa có Extracted Reading. Hãy extract bài đọc trước.');
  const { targetMin, targetMax } = getVocabularyTarget(readingText);

  const prompt = `Extract a COMPREHENSIVE study list of useful IELTS vocabulary and collocations from this reading passage for a Vietnamese learner.
Project: ${projectName}
Project topic: ${projectTopic || 'General'}

TARGET SIZE:
- Aim for about ${targetMin}-${targetMax} useful items when the passage contains enough material.
- Do NOT stop after only the most advanced words.
- Cover the WHOLE reading evenly, including later paragraphs.

WHAT TO INCLUDE:
- Useful B1, B2, C1 and C2 vocabulary that a learner is likely to reuse.
- Academic words and topic-specific vocabulary.
- Complete collocations and lexical chunks.
- Phrasal verbs, useful verb phrases, adjective+noun combinations, noun phrases, and recurring academic expressions.
- Longer natural phrases should be preserved in full when the phrase is more useful than the isolated head word.
- Include useful intermediate words if they are important to understand the passage or reusable in IELTS Writing/Speaking.

WHAT TO AVOID:
- Articles, pronouns, prepositions and other trivial function words.
- Extremely basic A1/A2 vocabulary unless it is part of a useful multi-word expression.
- Duplicate items or near-duplicate variants that teach essentially the same thing.
- Do not invent vocabulary that does not occur in the reading.

CONTEXT RULES:
- Preserve full multi-word phrases; never shorten a useful collocation to only its head word.
- Keep the exact sentence from the reading where the item appears in sourceSentence.
- Keep a short surrounding paragraph or context in sourceParagraph when useful.
- meaning must be Vietnamese.
- definition must be concise English.
- example can be a new natural example; sourceSentence must remain the sentence from the reading.
- band: Basic or one of 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0.

OUTPUT:
Return JSON array only. Each item must have exactly these fields:
word, ipa, wordType, meaning, definition, example, synonyms, antonyms, band, topic, sourceSentence, sourceParagraph.

READING:\n${readingText}`;

  const output = await generateContent(apiKey, `${prompt}\n\nReturn JSON only.`, [], 16384);
  const parsed = parseJsonResponse(output);
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<string>();
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
    .filter(item => {
      if (!item.word) return false;
      const key = item.word.toLowerCase().replace(/\s+/g, ' ').trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, targetMax);
}
