export function normalizeWord(word?: string) {
  return (word || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeBand(band?: string) {
  const raw = (band || '').trim();
  if (!raw) return '';

  if (/^(basic|n\/a|na|-)/i.test(raw)) {
    return raw.toLowerCase().startsWith('basic') ? 'Basic' : '';
  }

  const match = raw.match(/\d+(?:\.\d+)?/);
  if (!match) {
    const cleaned = raw.replace(/^band\s*/i, '').trim();
    return cleaned.toLowerCase() === 'basic' ? 'Basic' : cleaned;
  }

  const value = Number(match[0]);
  if (!Number.isFinite(value)) return raw.replace(/^band\s*/i, '').trim();

  // Common daily words should not look like IELTS band scores.
  // Anything below Band 5 is displayed as Basic instead of 3.0 / 4.0.
  if (value < 5) return 'Basic';

  const clamped = Math.min(9, Math.max(5, Math.round(value * 2) / 2));
  return clamped.toFixed(1);
}

export function formatBand(band?: string) {
  return normalizeBand(band) || '-';
}
