import React, { useState, useEffect } from 'react';
import { Shuffle, CheckCircle, RefreshCcw, EyeOff, Eye, Tags, ListChecks, Search } from 'lucide-react';
import { QuizSession, QuizAnswer, VocabItem, ViewState } from '../types';
import { useVocab } from '../context/VocabContext';
import { v4 as uuidv4 } from 'uuid';

type SelectionMode = 'random' | 'topic' | 'manual';

const PRACTICE_SELECTION_STORAGE_KEY = 'uyenuyen-practice-selection';

interface PracticeProps {
  currentView: ViewState;
}

export default function Practice({ currentView }: PracticeProps) {
  const { items, sessions, updateVocabItems, addQuizSession } = useVocab();
  const [mode, setMode] = useState<'Vietnamese' | 'Foreign'>('Foreign');
  const [count, setCount] = useState(10);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('random');
  const [selectedTopic, setSelectedTopic] = useState('All Topics');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [wordSearch, setWordSearch] = useState('');
  const [handoffLabel, setHandoffLabel] = useState('');
  const [quizState, setQuizState] = useState<'idle' | 'active' | 'submitted' | 'flashcards'>('idle');
  const [currentAnswers, setCurrentAnswers] = useState<QuizAnswer[]>([]);
  const [showAnswers, setShowAnswers] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);
  const [flashcardIdx, setFlashcardIdx] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);

  const activeItems = items.filter(i => i.status !== 'Storage');

  const normalizeText = (value?: string) => (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const splitAnswerOptions = (value?: string) => (value || '')
    .split(/[,;\/|\n]|\bor\b/gi)
    .map(normalizeText)
    .filter(Boolean);

  const normalizeWordType = (value?: string) => {
    const normalized = normalizeText(value);
    if (!normalized) return '';
    if (normalized.includes('pronoun') || normalized === 'pron') return 'pronoun';
    if (normalized.includes('noun') || normalized === 'n') return 'noun';
    if (normalized.includes('verb') || normalized === 'v') return 'verb';
    if (normalized.includes('adjective') || normalized === 'adj') return 'adjective';
    if (normalized.includes('adverb') || normalized === 'adv') return 'adverb';
    if (normalized.includes('preposition') || normalized === 'prep') return 'preposition';
    if (normalized.includes('conjunction') || normalized === 'conj') return 'conjunction';
    if (normalized.includes('phrase') || normalized.includes('idiom') || normalized.includes('collocation')) return 'collocation';
    return normalized;
  };

  const isWordTypeCorrect = (userAnswer?: string, correctAnswer?: string) => {
    const userType = normalizeWordType(userAnswer);
    const correctType = normalizeWordType(correctAnswer);
    return Boolean(userType && correctType && userType === correctType);
  };

  const isExactOptionCorrect = (userAnswer?: string, correctAnswer?: string) => {
    const user = normalizeText(userAnswer);
    if (!user) return false;
    return splitAnswerOptions(correctAnswer).some(option => user === option);
  };

  const isMeaningCorrect = (userAnswer?: string, correctAnswer?: string) => {
    const user = normalizeText(userAnswer);
    if (!user) return false;
    return splitAnswerOptions(correctAnswer).some(option => {
      if (user === option) return true;
      if (user.length >= 5 && option.includes(user)) return true;
      if (option.length >= 5 && user.includes(option)) return true;
      return false;
    });
  };

  const isSynonymCorrect = (userAnswer?: string, correctAnswer?: string) => {
    if (!userAnswer?.trim()) return true;
    const userOptions = splitAnswerOptions(userAnswer);
    const correctOptions = splitAnswerOptions(correctAnswer);
    if (correctOptions.length === 0) return true;
    return userOptions.some(user => correctOptions.some(correct => user === correct));
  };

  const getTopicLabel = (topic?: string) => topic?.trim() || 'No Topic';

  const topicOptions = Array.from(new Set(activeItems.map(item => getTopicLabel(item.topic))))
    .sort((a, b) => a.localeCompare(b));

  const manualVisibleItems = activeItems.filter(item => {
    const query = normalizeText(wordSearch);
    if (!query) return true;
    return normalizeText(`${item.word} ${item.meaning} ${item.topic} ${item.wordType} ${item.source}`).includes(query);
  });

  const manualSelectedItems = activeItems.filter(item => selectedIds.has(item.id));

  const readPracticeHandoff = () => {
    const raw = sessionStorage.getItem(PRACTICE_SELECTION_STORAGE_KEY);
    if (!raw) return false;
    if (activeItems.length === 0) return false;

    try {
      const payload = JSON.parse(raw) as { ids?: string[]; label?: string; source?: string };
      const validIds = (payload.ids || []).filter(id => activeItems.some(item => item.id === id));
      if (validIds.length > 0) {
        setSelectionMode('manual');
        setSelectedIds(new Set(validIds));
        setHandoffLabel(payload.label || `${validIds.length} selected collocations`);
        setWordSearch('');
        setQuizState('idle');
        setCurrentAnswers([]);
        setShowAnswers(false);
        setCurrentScore(0);
        sessionStorage.removeItem(PRACTICE_SELECTION_STORAGE_KEY);
        return true;
      }
    } catch (error) {
      console.error('Could not read practice handoff', error);
      sessionStorage.removeItem(PRACTICE_SELECTION_STORAGE_KEY);
    }
    return false;
  };

  useEffect(() => {
    if (currentView !== 'practice') return;
    readPracticeHandoff();
  }, [currentView, items]);

  const getPracticePool = (): VocabItem[] => {
    if (selectionMode === 'topic') {
      return activeItems.filter(item => selectedTopic === 'All Topics' || getTopicLabel(item.topic) === selectedTopic);
    }
    if (selectionMode === 'manual') {
      return manualSelectedItems;
    }
    return activeItems;
  };

  const practicePool = getPracticePool();

  const buildAnswers = (selected: VocabItem[]) => selected.map(item => ({
    id: uuidv4(),
    vocabItemId: item.id,
    question: mode === 'Foreign' ? item.meaning : item.word,
    c1_type: 'Word Type',
    c1_answer: '',
    c1_correct: item.wordType,
    c2_type: mode === 'Foreign' ? 'Word' : 'Meaning',
    c2_answer: '',
    c2_correct: mode === 'Foreign' ? item.word : item.meaning,
    c3_type: 'Synonyms',
    c3_answer: '',
    c3_correct: item.synonyms
  }));

  const prepareQuizSet = () => {
    const pool = getPracticePool();
    if (pool.length === 0) return null;
    const selected = selectionMode === 'manual'
      ? pool
      : [...pool].sort(() => 0.5 - Math.random()).slice(0, Math.min(count, pool.length));
    return buildAnswers(selected);
  };

  const generateQuiz = () => {
    const answers = prepareQuizSet();
    if (!answers) {
      alert(selectionMode === 'manual' ? 'Bạn chưa chọn từ/collocation nào để test.' : 'Chưa có từ nào phù hợp để tạo bài test.');
      return;
    }
    setCurrentAnswers(answers);
    setQuizState('active');
    setShowAnswers(false);
  };

  const startFlashcards = () => {
    const answers = prepareQuizSet();
    if (!answers) {
      alert(selectionMode === 'manual' ? 'Bạn chưa chọn từ/collocation nào để học flashcard.' : 'Chưa có từ nào phù hợp để học flashcard.');
      return;
    }
    setCurrentAnswers(answers);
    setQuizState('flashcards');
    setFlashcardIdx(0);
    setFlashcardFlipped(false);
  };

  const startQuizFromFlashcards = () => {
    setQuizState('active');
    setShowAnswers(false);
  };

  const updateAnswer = (id: string, field: 'c1_answer' | 'c2_answer' | 'c3_answer', value: string) => {
    setCurrentAnswers(prev => prev.map(ans => ans.id === id ? { ...ans, [field]: value } : ans));
  };

  const toggleManualWord = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setHandoffLabel('');
      return next;
    });
  };

  const selectAllVisibleWords = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      manualVisibleItems.forEach(item => next.add(item.id));
      return next;
    });
    setHandoffLabel('');
  };

  const clearManualSelection = () => {
    setSelectedIds(new Set());
    setHandoffLabel('');
  };

  const switchSelectionMode = (nextMode: SelectionMode) => {
    setSelectionMode(nextMode);
    if (nextMode !== 'manual') {
      setHandoffLabel('');
    }
  };

  const submitQuiz = () => {
    let totalCorrect = 0;
    const evaluated = currentAnswers.map(ans => {
      const isC1 = isWordTypeCorrect(ans.c1_answer, ans.c1_correct);
      const isC2 = ans.c2_type === 'Word'
        ? isExactOptionCorrect(ans.c2_answer, ans.c2_correct)
        : isMeaningCorrect(ans.c2_answer, ans.c2_correct);
      const isC3 = isSynonymCorrect(ans.c3_answer, ans.c3_correct);
      const isFull = isC1 && isC2 && isC3;
      if (isFull) totalCorrect++;
      return {
        ...ans,
        c1_isCorrect: isC1,
        c2_isCorrect: isC2,
        c3_isCorrect: isC3,
      };
    });
    setCurrentAnswers(evaluated);
    setCurrentScore(Math.round((totalCorrect / evaluated.length) * 100));
    setShowAnswers(true);
    setQuizState('submitted');
  };

  const clearAndSave = async () => {
    const session: QuizSession = {
      id: uuidv4(),
      mode,
      questionCount: currentAnswers.length,
      criteria: ['Word Type', mode === 'Foreign' ? 'Word' : 'Meaning', 'Synonyms'],
      score: currentScore,
      savedAt: Date.now(),
      type: selectionMode === 'manual' && handoffLabel ? 'Collocation Selected' : 'Practice',
    };
    await addQuizSession(session);

    const allItems = [...items];
    currentAnswers.forEach(ans => {
      const idx = allItems.findIndex(i => i.id === ans.vocabItemId);
      if (idx !== -1) {
        allItems[idx] = {
          ...allItems[idx],
          timesChecked: (allItems[idx].timesChecked || 0) + 1,
          lastScore: (ans.c1_isCorrect && ans.c2_isCorrect && ans.c3_isCorrect !== false) ? 100 : 0
        };
      }
    });
    await updateVocabItems(allItems);
    setQuizState('idle');
    setCurrentAnswers([]);
    setHandoffLabel('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentIdx: number, type: 'c1' | 'c2' | 'c3') => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const nextInputId = type === 'c1'
      ? `input-c2-${currentIdx}`
      : type === 'c2'
        ? `input-c3-${currentIdx}`
        : `input-c1-${currentIdx + 1}`;
    const nextInput = document.getElementById(nextInputId);
    if (nextInput) {
      (nextInput as HTMLInputElement).focus();
    } else if (type === 'c3' && currentIdx === currentAnswers.length - 1) {
      submitQuiz();
    }
  };

  useEffect(() => {
    if (quizState === 'active') {
      setTimeout(() => {
        const firstInput = document.getElementById('input-c1-0');
        if (firstInput) (firstInput as HTMLInputElement).focus();
      }, 100);
    }
  }, [quizState]);

  const playAudio = (text: string) => {
    if ('speechSynthesis' in window) {
      const msg = new SpeechSynthesisUtterance(text);
      msg.lang = 'en-US';
      window.speechSynthesis.speak(msg);
    }
  };

  const sourceSummary = selectionMode === 'manual'
    ? handoffLabel || `${manualSelectedItems.length} selected items`
    : selectionMode === 'topic'
      ? `${practicePool.length} words in ${selectedTopic}`
      : `${activeItems.length} active words`;

  return (
    <div className="animate-in fade-in duration-500 flex gap-8 h-full">
      <div className="flex-1 space-y-6">
        <header className="flex justify-between items-end gap-6">
          <div>
            <h2 className="text-3xl font-extrabold text-[#2D5A27]">Vocab Test</h2>
            <p className="text-gray-500 font-medium mt-1">Chọn random, theo chủ đề, hoặc tự tick từ/collocation muốn test.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={startFlashcards} className="flex items-center gap-2 px-5 py-2.5 bg-[#E8F5E9] hover:bg-[#D0E8D0] text-[#2D5A27] font-bold rounded-xl border-thin shadow-sm transition-colors">
              <Eye size={18} /> Study First
            </button>
            <button onClick={generateQuiz} className="flex items-center gap-2 px-5 py-2.5 bg-[#A5D6A7] hover:bg-[#81C784] text-[#2D5A27] font-bold rounded-xl border-thin shadow-sm transition-colors">
              <Shuffle size={18} /> Start Test
            </button>
            <button onClick={submitQuiz} disabled={quizState !== 'active'} className="flex items-center gap-2 px-5 py-2.5 bg-[#FFECB3] hover:bg-[#FFE082] text-[#795548] font-bold rounded-xl border-thin shadow-sm transition-colors disabled:opacity-50">
              <CheckCircle size={18} /> Quiz Submit
            </button>
            <button onClick={clearAndSave} disabled={quizState !== 'submitted'} className="flex items-center gap-2 px-5 py-2.5 bg-[#FFCDD2] hover:bg-[#EF9A9A] text-[#B71C1C] font-bold rounded-xl border-thin shadow-sm transition-colors disabled:opacity-50">
              <RefreshCcw size={18} /> Clear & Save
            </button>
          </div>
        </header>

        {quizState === 'idle' && (
          <div className="bg-white rounded-[2rem] card-shadow border-thin p-5 space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <select value={mode} onChange={(e) => setMode(e.target.value as any)} className="bg-gray-50 border-thin px-4 py-2 rounded-xl font-bold text-gray-600 focus:outline-none focus:border-[#A5D6A7]">
                <option value="Foreign">Question: Vietnamese → Answer English</option>
                <option value="Vietnamese">Question: English → Answer Vietnamese</option>
              </select>
              <select value={count} onChange={(e) => setCount(Number(e.target.value))} disabled={selectionMode === 'manual'} className="bg-gray-50 border-thin px-4 py-2 rounded-xl font-bold text-gray-600 focus:outline-none focus:border-[#A5D6A7] disabled:opacity-50">
                <option value={10}>10 Questions</option>
                <option value={20}>20 Questions</option>
                <option value={50}>50 Questions</option>
              </select>
              <span className="text-sm font-bold text-gray-400">Source: {sourceSummary}</span>
            </div>

            {handoffLabel && selectionMode === 'manual' && (
              <div className="rounded-2xl bg-green-50 border border-green-100 px-4 py-3 text-sm font-bold text-green-700">
                Đang Practice đúng nhóm Collocation vừa chọn. Không trộn vocab cũ.
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => switchSelectionMode('random')} className={`px-4 py-3 rounded-2xl border-thin font-extrabold transition-colors flex items-center justify-center gap-2 ${selectionMode === 'random' ? 'bg-[#E8F5E9] text-[#2D5A27]' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                <Shuffle size={18} /> Random
              </button>
              <button onClick={() => switchSelectionMode('topic')} className={`px-4 py-3 rounded-2xl border-thin font-extrabold transition-colors flex items-center justify-center gap-2 ${selectionMode === 'topic' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                <Tags size={18} /> By Topic
              </button>
              <button onClick={() => switchSelectionMode('manual')} className={`px-4 py-3 rounded-2xl border-thin font-extrabold transition-colors flex items-center justify-center gap-2 ${selectionMode === 'manual' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                <ListChecks size={18} /> Manual Pick
              </button>
            </div>

            {selectionMode === 'topic' && (
              <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
                <label className="block text-sm font-bold text-blue-700 mb-2">Chọn chủ đề để test</label>
                <select value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)} className="w-full bg-white border border-blue-100 px-4 py-3 rounded-xl font-bold text-gray-700 focus:outline-none">
                  <option value="All Topics">All Topics</option>
                  {topicOptions.map(topic => <option key={topic} value={topic}>{topic}</option>)}
                </select>
                <p className="text-sm text-blue-700 mt-2 font-semibold">App sẽ random trong {practicePool.length} từ thuộc chủ đề đã chọn.</p>
              </div>
            )}

            {selectionMode === 'manual' && (
              <div className="rounded-2xl bg-purple-50 border border-purple-100 p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-300" />
                    <input value={wordSearch} onChange={e => setWordSearch(e.target.value)} placeholder="Search word, collocation, meaning, topic..." className="w-full bg-white border border-purple-100 pl-10 pr-4 py-3 rounded-xl font-semibold text-gray-700 focus:outline-none" />
                  </div>
                  <button onClick={selectAllVisibleWords} className="px-4 py-3 bg-white border border-purple-100 text-purple-600 rounded-xl font-bold hover:bg-purple-100">Select visible</button>
                  <button onClick={clearManualSelection} className="px-4 py-3 bg-white border border-purple-100 text-gray-500 rounded-xl font-bold hover:bg-purple-100">Clear</button>
                </div>

                <div className="max-h-64 overflow-y-auto grid grid-cols-2 gap-2 pr-1">
                  {manualVisibleItems.map(item => (
                    <label key={item.id} className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${selectedIds.has(item.id) ? 'bg-white border-purple-300 text-purple-700' : 'bg-white/70 border-purple-100 text-gray-600 hover:bg-white'}`}>
                      <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleManualWord(item.id)} className="mt-1" />
                      <span>
                        <span className="block font-extrabold">{item.word}</span>
                        <span className="block text-xs font-semibold text-gray-400">{item.meaning || '-'} • {getTopicLabel(item.topic)}</span>
                      </span>
                    </label>
                  ))}
                  {manualVisibleItems.length === 0 && <div className="col-span-2 text-center text-purple-400 font-bold py-8">Không tìm thấy từ phù hợp.</div>}
                </div>

                <p className="text-sm text-purple-700 font-bold">Đã chọn {manualSelectedItems.length} item. Manual mode chỉ test đúng item bạn tick.</p>
              </div>
            )}
          </div>
        )}

        {quizState === 'flashcards' ? (
          <div className="flex flex-col items-center mt-10">
            <div className="w-full max-w-2xl min-h-80 bg-white rounded-[2.5rem] card-shadow border-thin flex flex-col items-center justify-center text-center p-8 cursor-pointer" onClick={() => {
              setFlashcardFlipped(!flashcardFlipped);
              if (!flashcardFlipped) playAudio(currentAnswers[flashcardIdx]?.c2_correct || '');
            }}>
              <span className="text-gray-400 font-bold uppercase tracking-widest text-sm mb-4">{flashcardFlipped ? 'Answer' : 'Question'}</span>
              <h3 className="text-4xl font-black text-[#2D5A27]">{flashcardFlipped ? currentAnswers[flashcardIdx]?.c2_correct : currentAnswers[flashcardIdx]?.question}</h3>
              {flashcardFlipped && <p className="text-xl font-bold text-[#2D5A27]/80 mt-3">{currentAnswers[flashcardIdx]?.c1_correct}</p>}
              <p className="mt-8 text-gray-400 font-medium text-sm">Click to flip</p>
            </div>
            <div className="flex items-center gap-8 mt-8">
              <button onClick={() => { setFlashcardFlipped(false); setFlashcardIdx(Math.max(0, flashcardIdx - 1)); }} disabled={flashcardIdx === 0} className="px-6 py-3 font-bold text-gray-500 hover:text-gray-900 disabled:opacity-30">Previous</button>
              <span className="font-bold text-gray-400">{flashcardIdx + 1} / {currentAnswers.length}</span>
              <button onClick={() => {
                if (flashcardIdx < currentAnswers.length - 1) {
                  setFlashcardFlipped(false);
                  setFlashcardIdx(flashcardIdx + 1);
                } else {
                  startQuizFromFlashcards();
                }
              }} className="px-8 py-3 bg-[#2D5A27] text-white font-bold rounded-2xl shadow-sm hover:bg-[#1f3d1b]">
                {flashcardIdx === currentAnswers.length - 1 ? 'Start Quiz' : 'Next'}
              </button>
            </div>
          </div>
        ) : quizState !== 'idle' ? (
          <div className="bg-white rounded-[2.5rem] card-shadow border-thin overflow-hidden">
            <div className="p-4 border-b border-thin flex justify-between items-center bg-gray-50/50">
              <div className="font-bold text-gray-600">Testing {currentAnswers.length} items</div>
              {quizState === 'submitted' && (
                <button onClick={() => setShowAnswers(!showAnswers)} className="flex items-center gap-2 text-gray-500 font-bold hover:text-gray-800 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                  {showAnswers ? <EyeOff size={16} /> : <Eye size={16} />}
                  {showAnswers ? 'Hide Answers' : 'Show Answers'}
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100 text-sm">
                    <th className="p-4 font-bold text-gray-500 w-12 text-center">No.</th>
                    <th className="p-4 font-bold text-gray-500 w-1/4">Question</th>
                    <th className="p-4 font-bold text-gray-500">Type</th>
                    <th className="p-4 font-bold text-gray-500">{mode === 'Foreign' ? 'Word / Collocation' : 'Meaning'}</th>
                    <th className="p-4 font-bold text-gray-500">Synonym <span className="text-xs font-medium text-gray-400">optional</span></th>
                    {showAnswers && <th className="p-4 font-bold text-gray-500 bg-[#F0FDF4]">Correct Answer</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {currentAnswers.map((ans, idx) => (
                    <tr key={ans.id} className="hover:bg-gray-50/50">
                      <td className="p-4 text-center font-bold text-gray-400">{idx + 1}</td>
                      <td className="p-4 font-bold text-gray-800">{ans.question}</td>
                      <td className="p-4">
                        <input id={`input-c1-${idx}`} type="text" value={ans.c1_answer || ''} onChange={(e) => updateAnswer(ans.id, 'c1_answer', e.target.value)} onKeyDown={(e) => handleKeyDown(e, idx, 'c1')} disabled={quizState === 'submitted'} className={`w-full px-3 py-2 bg-gray-50 border rounded-xl font-medium focus:outline-none ${quizState === 'submitted' ? (ans.c1_isCorrect ? 'border-green-400 bg-green-50 text-green-700' : 'border-red-300 bg-red-50 text-red-700') : 'border-gray-200 focus:border-[#4ADE80]'}`} />
                      </td>
                      <td className="p-4">
                        <input id={`input-c2-${idx}`} type="text" value={ans.c2_answer || ''} onChange={(e) => updateAnswer(ans.id, 'c2_answer', e.target.value)} onKeyDown={(e) => handleKeyDown(e, idx, 'c2')} disabled={quizState === 'submitted'} className={`w-full px-3 py-2 bg-gray-50 border rounded-xl font-medium focus:outline-none ${quizState === 'submitted' ? (ans.c2_isCorrect ? 'border-green-400 bg-green-50 text-green-700' : 'border-red-300 bg-red-50 text-red-700') : 'border-gray-200 focus:border-[#4ADE80]'}`} />
                      </td>
                      <td className="p-4">
                        <input id={`input-c3-${idx}`} type="text" value={ans.c3_answer || ''} onChange={(e) => updateAnswer(ans.id, 'c3_answer', e.target.value)} onKeyDown={(e) => handleKeyDown(e, idx, 'c3')} disabled={quizState === 'submitted'} placeholder="optional" className={`w-full px-3 py-2 bg-gray-50 border rounded-xl font-medium focus:outline-none ${quizState === 'submitted' ? (ans.c3_isCorrect ? 'border-green-400 bg-green-50 text-green-700' : 'border-red-300 bg-red-50 text-red-700') : 'border-gray-200 focus:border-[#4ADE80]'}`} />
                      </td>
                      {showAnswers && (
                        <td className="p-4 bg-[#F0FDF4]">
                          <div className="font-bold text-green-700">{ans.c2_correct}</div>
                          <div className="text-sm font-semibold text-green-600/70">{ans.c1_correct}</div>
                          <div className="text-xs font-semibold text-green-600/60 mt-1">Syn: {ans.c3_correct || '-'}</div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50 py-16 text-center px-4">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-[#4ADE80] shadow-sm mb-4"><Shuffle size={32} /></div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Ready to test your memory?</h3>
            <p className="text-gray-500 font-medium">Chọn nguồn từ ở trên rồi bấm “Start Test” hoặc “Study First”.</p>
          </div>
        )}
      </div>

      <div className="w-80 space-y-6">
        <h2 className="text-2xl font-extrabold text-[#2D5A27]">Review & Score</h2>
        {quizState === 'submitted' && (
          <div className="bg-white p-6 rounded-[2.5rem] card-shadow border-thin bg-gradient-to-br from-white to-[#E8F5E9] mb-6">
            <div className="text-sm font-bold text-gray-500 mb-2">Latest Score</div>
            <div className="text-5xl font-black text-[#2D5A27]">{currentScore}%</div>
            <p className="font-medium text-[#2D5A27]/70 mt-2">Save your results to track progress.</p>
          </div>
        )}
        <div className="bg-white rounded-[2.5rem] card-shadow border-thin p-4">
          <h3 className="font-bold text-gray-800 mb-4 px-2">Recent History</h3>
          <div className="space-y-2">
            {sessions.slice(0, 5).map(session => (
              <div key={session.id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-2xl transition-colors">
                <div>
                  <div className="font-bold text-gray-800">{new Date(session.savedAt || 0).toLocaleDateString()}</div>
                  <div className="text-xs font-semibold text-gray-400">{session.questionCount} items</div>
                </div>
                <div className={`px-3 py-1 rounded-xl font-bold ${session.score >= 80 ? 'bg-[#E8F5E9] text-[#2D5A27]' : session.score >= 50 ? 'bg-[#FFECB3] text-[#795548]' : 'bg-[#FFCDD2] text-[#B71C1C]'}`}>{session.score}%</div>
              </div>
            ))}
            {sessions.length === 0 && <div className="text-center p-4 text-gray-400 font-medium text-sm">No recent quiz history.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
