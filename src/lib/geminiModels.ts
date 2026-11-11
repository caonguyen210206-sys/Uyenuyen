// Both Flash-Lite models are available on Gemini's free tier.
export const GEMINI_FLASH_LITE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
] as const;

export function isGeminiQuotaError(status: number, message: string) {
  return status === 429 || /quota|rate limit|resource_exhausted|free_tier/i.test(message);
}

export function isGeminiKeyError(status: number, message: string) {
  return status === 401 || status === 403
    || (status === 400 && /api_key_invalid|api key (?:is )?not valid|invalid api key/i.test(message));
}
