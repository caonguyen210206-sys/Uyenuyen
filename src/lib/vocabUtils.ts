export function normalizeWord(word?: string) {
  return (word || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeBand(band?: string) {
  const raw = (band || '').trim();
  if (!raw) return '';

  const match = raw.match(/\d+(?:\.\d+)?/);
  if (!match) return raw.replace(/^band\s*/i, '').trim();

  const value = Number(match[0]);
  if (!Number.isFinite(value)) return raw.replace(/^band\s*/i, '').trim();

  const clamped = Math.min(9, Math.max(1, Math.round(value * 2) / 2));
  return clamped.toFixed(1);
}

export function formatBand(band?: string) {
  return normalizeBand(band) || '-';
}
