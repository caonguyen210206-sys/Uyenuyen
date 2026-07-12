const MODEL = "gemini-1.5-flash";

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

async function generateJson(apiKey: string | undefined, prompt: string) {
  const key = requireApiKey(apiKey);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    }
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message || `Gemini API lỗi HTTP ${response.status}.`;
    throw new Error(message);
  }

  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini không trả về dữ liệu.");
  }

  return parseJsonResponse(text);
}

export async function defineWord(word: string, apiKey?: string): Promise<VocabPayload> {
  const prompt = `You are an expert English teacher. You are provided with a word: "${word}".
If the word is misspelled, correct it to the most likely intended valid English word.
Provide the definition of the word (or the corrected word) for a Vietnamese learner.
Respond ONLY with a valid JSON object matching this structure (no markdown, no backticks, just raw JSON):
{
  "correctedWord": "The correct spelling of the word if there was a typo, otherwise the original word",
  "ipa": "phonetic transcription (e.g., /kɒn.fɪˈden.ʃəl/)",
  "wordType": "part of speech (e.g., adj., noun, verb)",
  "meaning": "Vietnamese meaning",
  "definition": "English definition",
  "example": "A short English example sentence",
  "synonyms": "comma-separated synonyms",
  "antonyms": "comma-separated antonyms",
  "band": "IELTS band estimate (e.g., Band 5.5, Band 6)",
  "topic": "General topic category"
}`;

  return generateJson(apiKey, prompt);
}

export async function processRawText(rawText: string, apiKey?: string): Promise<VocabPayload[]> {
  const prompt = `You are an expert English teacher. The user has provided some unstructured raw text containing vocabulary items.
Extract the vocabulary words and their details from the text. For any missing details, fill them in appropriately for a Vietnamese learner.
Respond ONLY with a JSON array of objects matching this structure (no markdown, no backticks, just raw JSON):
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
    "band": "IELTS band estimate",
    "topic": "General topic category"
  }
]

Text to process:
"${rawText}"`;

  const data = await generateJson(apiKey, prompt);
  return Array.isArray(data) ? data : [];
}

export async function extractVocabFromParagraph(paragraph: string, apiKey?: string): Promise<VocabPayload[]> {
  const prompt = `You are an expert English teacher. The user has provided a paragraph.
Identify the most useful, advanced, or important vocabulary words (up to 15 words) for an English learner from this paragraph.
Extract these words and provide detailed definitions for a Vietnamese learner.
Respond ONLY with a JSON array of objects matching this structure (no markdown, no backticks, just raw JSON):
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
    "band": "IELTS band estimate",
    "topic": "General topic category"
  }
]

Paragraph:
"${paragraph}"`;

  const data = await generateJson(apiKey, prompt);
  return Array.isArray(data) ? data : [];
}

export async function testGeminiConnection(apiKey?: string) {
  await defineWord("hello", apiKey);
}
