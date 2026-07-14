import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { VocabItem, QuizSession, UserSettings, CollocationItem } from '../types';
import {
  getVocabItems,
  saveVocabItems,
  deleteVocabItems,
  getQuizSessions,
  saveQuizSession,
  getSettings,
  saveSettings,
  getCollocationItems,
  saveCollocationItems,
  deleteCollocationItems,
} from '../lib/storage';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface VocabContextType {
  items: VocabItem[];
  collocations: CollocationItem[];
  sessions: QuizSession[];
  settings: UserSettings;
  loading: boolean;
  addVocabItem: (item: VocabItem) => Promise<void>;
  updateVocabItems: (items: VocabItem[]) => Promise<void>;
  removeVocabItems: (ids: string[]) => Promise<void>;
  addCollocationItem: (item: CollocationItem) => Promise<void>;
  updateCollocationItems: (items: CollocationItem[]) => Promise<void>;
  removeCollocationItems: (ids: string[]) => Promise<void>;
  addQuizSession: (session: QuizSession) => Promise<void>;
  updateSettings: (settings: UserSettings) => Promise<void>;
  refreshData: () => Promise<void>;
}

const defaultSettings: UserSettings = { apiKey: '', defaultQuestions: 10, defaultCriteria: ['Meaning', 'Word Type', 'Synonyms'] };

const VocabContext = createContext<VocabContextType | undefined>(undefined);

export const VocabProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<VocabItem[]>([]);
  const [collocations, setCollocations] = useState<CollocationItem[]>([]);
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const fetchAllData = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const [fetchedItems, fetchedCollocations, fetchedSessions, fetchedSettings] = await Promise.all([
        getVocabItems(),
        getCollocationItems(),
        getQuizSessions(),
        getSettings()
      ]);
      setItems(fetchedItems);
      setCollocations(fetchedCollocations);
      setSessions(fetchedSessions);
      setSettings(fetchedSettings);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchAllData();
      } else {
        setItems([]);
        setCollocations([]);
        setSessions([]);
        setSettings(defaultSettings);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const addVocabItem = async (item: VocabItem) => {
    const newItems = [...items, item];
    setItems(newItems);
    await saveVocabItems(newItems);
  };

  const updateVocabItems = async (newItems: VocabItem[]) => {
    setItems(newItems);
    await saveVocabItems(newItems);
  };

  const removeVocabItems = async (ids: string[]) => {
    const newItems = items.filter(item => !ids.includes(item.id));
    setItems(newItems);
    await deleteVocabItems(ids);
  };

  const addCollocationItem = async (item: CollocationItem) => {
    const newItems = [...collocations, item];
    setCollocations(newItems);
    await saveCollocationItems(newItems);
  };

  const updateCollocationItems = async (newItems: CollocationItem[]) => {
    setCollocations(newItems);
    await saveCollocationItems(newItems);
  };

  const removeCollocationItems = async (ids: string[]) => {
    const newItems = collocations.filter(item => !ids.includes(item.id));
    setCollocations(newItems);
    await deleteCollocationItems(ids);
  };

  const addQuizSession = async (session: QuizSession) => {
    setSessions(prev => [session, ...prev]);
    await saveQuizSession(session);
  };

  const updateSettingsLocal = async (newSettings: UserSettings) => {
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  return (
    <VocabContext.Provider value={{
      items,
      collocations,
      sessions,
      settings,
      loading,
      addVocabItem,
      updateVocabItems,
      removeVocabItems,
      addCollocationItem,
      updateCollocationItems,
      removeCollocationItems,
      addQuizSession,
      updateSettings: updateSettingsLocal,
      refreshData: fetchAllData
    }}>
      {children}
    </VocabContext.Provider>
  );
};

export const useVocab = () => {
  const context = useContext(VocabContext);
  if (context === undefined) {
    throw new Error('useVocab must be used within a VocabProvider');
  }
  return context;
};
