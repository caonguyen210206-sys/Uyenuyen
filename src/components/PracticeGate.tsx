import { useLayoutEffect } from 'react';
import Practice from './Practice';
import { ViewState } from '../types';
import { useVocab } from '../context/VocabContext';

const PRACTICE_SELECTION_STORAGE_KEY = 'uyenuyen-practice-selection';

interface PracticeGateProps {
  currentView: ViewState;
}

export default function PracticeGate({ currentView }: PracticeGateProps) {
  const { items, updateVocabItems } = useVocab();

  useLayoutEffect(() => {
    if (currentView !== 'practice') return;
    const raw = sessionStorage.getItem(PRACTICE_SELECTION_STORAGE_KEY);
    if (!raw) return;

    try {
      const payload = JSON.parse(raw) as { ids?: string[]; source?: string };
      const ids = new Set(payload.ids || []);
      if (ids.size === 0) return;
      const needsPromotion = items.some(item => ids.has(item.id) && item.status === 'Storage');
      if (!needsPromotion) return;

      void updateVocabItems(items.map(item => ids.has(item.id) && item.status === 'Storage'
        ? { ...item, status: 'Studying' as const, updatedAt: Date.now() }
        : item));
    } catch (error) {
      console.error('Could not prepare handoff vocab for Practice', error);
    }
  }, [currentView, items, updateVocabItems]);

  return <Practice currentView={currentView} />;
}
