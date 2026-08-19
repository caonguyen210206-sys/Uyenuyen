import { useMemo, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, Pencil, Plus, Save, Sparkles, Trash2, Volume2, Wand2, X } from 'lucide-react';
import { VocabItem } from '../types';
import { useVocab } from '../context/VocabContext';
import { v4 as uuidv4 } from 'uuid';
import { defineWord, generateMiniQuiz } from '../lib/gemini';
import { formatBand, normalizeBand, normalizeWord } from '../lib/vocabUtils';
import VocabFilterBar, { VocabSortMode } from './VocabFilterBar';

type MiniQuizResponse = { fillBlank?: string; multipleChoice?: string; rewrite?: string };
type MiniQuizResult = { fillBlank: boolean; multipleChoice: boolean; score: number };

function bandNumber(value?: string) {
  if (!value || value === 'Basic') return 0;
  return Number.parseFloat(value) || 0;
}

export default function VocabList() {
  const { items, addVocabItem, updateVocabItems, removeVocabItems, settings, readingProjects } = useVocab();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [isDefining, setIsDefining] = useState(false);
  const [wasAutoDefined, setWasAutoDefined] = useState(false);
  const [formData, setFormData] = useState<Partial<VocabItem>>({});
  const [duplicateMessage, setDuplicateMessage] = useState('');
  const [editingItem, setEditingItem] = useState<VocabItem | null>(null);
  const [editData, setEditData] = useState<Partial<VocabItem>>({});
  const [editMessage, setEditMessage] = useState('');
  const [generatingQuizId, setGeneratingQuizId] = useState<string | null>(null);
  const [revealedQuizIds, setRevealedQuizIds] = useState<Set<string>>(new Set());
  const [miniQuizResponses, setMiniQuizResponses] = useState<Record<string, MiniQuizResponse>>({});
  const [miniQuizResults, setMiniQuizResults] = useState<Record<string, MiniQuizResult>>({});

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<VocabSortMode>('newest');
  const [topicFilter, setTopicFilter] = useState('All Topics');
  const [projectFilter, setProjectFilter] = useState('All Projects');
  const [sourceFilter, setSourceFilter] = useState('All Sources');
  const [statusFilter, setStatusFilter] = useState('All Statuses');

  const activeItems = items.filter(item => item.status !== 'Storage');
  const topics = Array.from(new Set(activeItems.map(item => item.topic).filter(Boolean))).sort();
  const sources = Array.from(new Set(activeItems.map(item => item.source).filter(Boolean))).sort();

  const filteredItems = useMemo(() => {
    const query = normalizeWord(search);
    return activeItems
      .filter(item => {
        const matchesSearch = !query || normalizeWord(`${item.word} ${item.meaning} ${item.definition} ${item.topic}`).includes(query);
        const matchesTopic = topicFilter === 'All Topics' || item.topic === topicFilter;
        const matchesProject = projectFilter === 'All Projects' || item.projectIds?.includes(projectFilter);
        const matchesSource = sourceFilter === 'All Sources' || item.source === sourceFilter;
        const matchesStatus = statusFilter === 'All Statuses' || item.status === statusFilter;
        return matchesSearch && matchesTopic && matchesProject && matchesSource && matchesStatus;
      })
      .sort((a, b) => {
        if (sort === 'oldest') return a.createdAt - b.createdAt;
        if (sort === 'az') return a.word.localeCompare(b.word);
        if (sort === 'za') return b.word.localeCompare(a.word);
        if (sort === 'band-high') return bandNumber(b.band) - bandNumber(a.band);
        if (sort === 'band-low') return bandNumber(a.band) - bandNumber(b.band);
        return b.createdAt - a.createdAt;
      });
  }, [activeItems, search, sort, topicFilter, projectFilter, sourceFilter, statusFilter]);

  const findDuplicate = (word: string, excludeId?: string) => {
    const normalized = normalizeWord(word);
    if (!normalized) return undefined;
    return items.find(item => item.id !== excludeId && normalizeWord(item.word) === normalized);
  };

  const resetAddModal = () => {
    setShowAddModal(false);
    setNewWord('');
    setFormData({});
    setDuplicateMessage('');
    setWasAutoDefined(false);
  };

  const handleAutoDefine = async () => {
    const word = newWord.trim();
    if (!word) return;
    const duplicate = findDuplicate(word);
    if (duplicate) {
      setDuplicateMessage(`Từ/cụm "${duplicate.word}" đã có trong danh sách rồi.`);
      return;
    }
    setDuplicateMessage('');
    setIsDefining(true);
    try {
      const data = await defineWord(word, settings.apiKey);
      const finalWord = data.correctedWord?.trim() || word;
      const correctedDuplicate = findDuplicate(finalWord);
      if (correctedDuplicate) {
        setNewWord(finalWord);
        setDuplicateMessage(`Từ/cụm "${correctedDuplicate.word}" đã tồn tại, không lưu thêm bản trùng.`);
      }
      setNewWord(finalWord);
      setFormData({ ...data, band: normalizeBand(data.band) });
      setWasAutoDefined(true);
    } catch (error: any) {
      alert(error?.message || 'Auto Define chưa thành công.');
    } finally {
      setIsDefining(false);
    }
  };

  const handleSave = async () => {
    const word = newWord.trim();
    if (!word || !formData.meaning) return;
    const duplicate = findDuplicate(word);
    if (duplicate) {
      setDuplicateMessage(`Không lưu được vì "${duplicate.word}" đã tồn tại.`);
      return;
    }
    const now = Date.now();
    await addVocabItem({
      id: uuidv4(),
      word,
      ipa: formData.ipa || '',
      wordType: formData.wordType || '',
      meaning: formData.meaning,
      definition: formData.definition || '',
      example: formData.example || '',
      synonyms: formData.synonyms || '',
      antonyms: formData.antonyms || '',
      band: normalizeBand(formData.band),
      topic: formData.topic || '',
      status: 'Studying',
      masteryLevel: 'New',
      source: wasAutoDefined ? 'AI Defined' : 'Manual',
      createdAt: now,
      updatedAt: now,
      timesChecked: 0,
      miniQuiz: formData.miniQuiz,
    });
    resetAddModal();
  };

  const startEdit = (item: VocabItem) => {
    setEditingItem(item);
    setEditData({ ...item });
    setEditMessage('');
  };

  const closeEdit = () => {
    setEditingItem(null);
    setEditData({});
    setEditMessage('');
  };

  const handleUpdate = async () => {
    if (!editingItem) return;
    const word = String(editData.word || '').trim();
    if (!word || !editData.meaning) {
      setEditMessage('Word và Meaning không được để trống.');
      return;
    }
    const duplicate = findDuplicate(word, editingItem.id);
    if (duplicate) {
      setEditMessage(`"${duplicate.word}" đã tồn tại.`);
      return;
    }
    const updated = items.map(item => item.id === editingItem.id ? {
      ...editingItem,
      ...editData,
      word,
      meaning: editData.meaning || '',
      band: normalizeBand(editData.band),
      updatedAt: Date.now(),
    } as VocabItem : item);
    await updateVocabItems(updated);
    closeEdit();
  };

  const handleDelete = async (item: VocabItem) => {
    if (!confirm(`Xoá "${item.word}"?`)) return;
    await removeVocabItems([item.id]);
  };

  const markLearned = async (id: string) => {
    await updateVocabItems(items.map(item => item.id === id ? { ...item, status: 'Completed' as const, masteryLevel: 'Mastery' as const, updatedAt: Date.now() } : item));
  };

  const playAudio = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    const message = new SpeechSynthesisUtterance(text);
    message.lang = 'en-US';
    window.speechSynthesis.speak(message);
  };

  const handleGenerateMiniQuiz = async (item: VocabItem) => {
    setGeneratingQuizId(item.id);
    try {
      const miniQuiz = await generateMiniQuiz(item, settings.apiKey);
      await updateVocabItems(items.map(current => current.id === item.id ? { ...current, miniQuiz, updatedAt: Date.now() } : current));
    } catch (error: any) {
      alert(error?.message || 'Chưa tạo được mini quiz.');
    } finally {
      setGeneratingQuizId(null);
    }
  };

  const updateQuizResponse = (id: string, field: keyof MiniQuizResponse, value: string) => {
    setMiniQuizResponses(previous => ({ ...previous, [id]: { ...(previous[id] || {}), [field]: value } }));
    setMiniQuizResults(previous => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
  };

  const normalizeAnswer = (value?: string) => normalizeWord(value || '').replace(/\s+/g, ' ').trim();

  const checkMiniQuiz = (item: VocabItem) => {
    if (!item.miniQuiz) return;
    const response = miniQuizResponses[item.id] || {};
    const fillBlank = normalizeAnswer(response.fillBlank) === normalizeAnswer(item.miniQuiz.fillBlankAnswer);
    const multipleChoice = normalizeAnswer(response.multipleChoice) === normalizeAnswer(item.miniQuiz.multipleChoiceAnswer);
    setMiniQuizResults(previous => ({ ...previous, [item.id]: { fillBlank, multipleChoice, score: (fillBlank ? 50 : 0) + (multipleChoice ? 50 : 0) } }));
    setRevealedQuizIds(previous => new Set(previous).add(item.id));
  };

  const toggleAnswers = (id: string) => {
    setRevealedQuizIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderFields = (data: Partial<VocabItem>, setData: (next: Partial<VocabItem>) => void) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <input value={data.ipa || ''} onChange={event => setData({ ...data, ipa: event.target.value })} placeholder="IPA" className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
      <input value={data.wordType || ''} onChange={event => setData({ ...data, wordType: event.target.value })} placeholder="Type" className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
      <input value={data.meaning || ''} onChange={event => setData({ ...data, meaning: event.target.value })} placeholder="Meaning (VN)" className="sm:col-span-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-semibold" />
      <textarea value={data.definition || ''} onChange={event => setData({ ...data, definition: event.target.value })} placeholder="Definition (EN)" rows={2} className="sm:col-span-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
      <textarea value={data.example || ''} onChange={event => setData({ ...data, example: event.target.value })} placeholder="Example" rows={2} className="sm:col-span-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
      <input value={data.synonyms || ''} onChange={event => setData({ ...data, synonyms: event.target.value })} placeholder="Synonyms" className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
      <input value={data.antonyms || ''} onChange={event => setData({ ...data, antonyms: event.target.value })} placeholder="Antonyms" className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
      <input value={data.band || ''} onChange={event => setData({ ...data, band: event.target.value })} placeholder="Band" className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
      <input value={data.topic || ''} onChange={event => setData({ ...data, topic: event.target.value })} placeholder="Topic" className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="text-3xl font-extrabold text-[#2D5A27]">My Vocab List</h2><p className="text-gray-500 font-medium mt-1">Studying + Completed vocabulary</p></div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#A5D6A7] text-[#2D5A27] font-extrabold border-thin"><Plus size={18} /> Add Word</button>
      </header>

      <VocabFilterBar
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        topic={topicFilter}
        onTopicChange={setTopicFilter}
        topics={topics}
        project={projectFilter}
        onProjectChange={setProjectFilter}
        projects={readingProjects.map(project => ({ id: project.id, name: project.name }))}
        source={sourceFilter}
        onSourceChange={setSourceFilter}
        sources={sources}
        status={statusFilter}
        onStatusChange={setStatusFilter}
        statuses={['Studying', 'Completed']}
      />

      <div className="rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] px-5 py-4 text-sm font-bold text-[#2D5A27]">Hiển thị {filteredItems.length}/{activeItems.length} vocab.</div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {filteredItems.map(item => {
          const revealed = revealedQuizIds.has(item.id);
          const result = miniQuizResults[item.id];
          const response = miniQuizResponses[item.id] || {};
          return (
            <div key={item.id} className="bg-white rounded-[2rem] border-thin card-shadow p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="text-2xl font-black text-[#2D5A27] break-words">{item.word}</h3><button onClick={() => playAudio(item.word)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Volume2 size={18} /></button></div>
                  <div className="flex flex-wrap gap-2 mt-2"><span className="px-2 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold">{formatBand(item.band)}</span><span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">{item.status}</span><span className="px-2 py-1 rounded-full bg-purple-50 text-purple-600 text-xs font-bold">{item.topic || 'General'}</span></div>
                </div>
                <div className="flex gap-1"><button onClick={() => startEdit(item)} className="p-2 rounded-xl text-amber-600 hover:bg-amber-50"><Pencil size={18} /></button><button onClick={() => handleDelete(item)} className="p-2 rounded-xl text-red-500 hover:bg-red-50"><Trash2 size={18} /></button></div>
              </div>

              <div className="space-y-2 text-sm"><p><b>IPA:</b> {item.ipa || '-'}</p><p><b>Meaning:</b> {item.meaning}</p><p><b>Definition:</b> {item.definition || '-'}</p><p><b>Example:</b> <span className="italic">{item.example || '-'}</span></p><p><b>Synonyms:</b> {item.synonyms || '-'}</p><p><b>Antonyms:</b> {item.antonyms || '-'}</p></div>

              {item.projectIds?.length ? <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-xs font-bold text-blue-700">Projects: {item.projectIds.map(id => readingProjects.find(project => project.id === id)?.name).filter(Boolean).join(', ')}</div> : null}

              <div className="flex flex-wrap gap-2">
                <button onClick={() => handleGenerateMiniQuiz(item)} disabled={generatingQuizId === item.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-50 border border-purple-100 text-purple-700 text-sm font-bold disabled:opacity-50"><Sparkles size={15} /> {item.miniQuiz ? 'Regenerate Mini Quiz' : 'Mini Quiz'}</button>
                {item.status !== 'Completed' && <button onClick={() => markLearned(item.id)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 border border-green-100 text-green-700 text-sm font-bold"><CheckCircle2 size={15} /> Learned</button>}
              </div>

              {item.miniQuiz && (
                <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3"><h4 className="font-black text-gray-800">Mini Quiz</h4>{result && <span className="font-black text-blue-600">{result.score}%</span>}</div>
                  <div><p className="text-sm font-bold mb-2">1. {item.miniQuiz.fillBlankQuestion}</p><input value={response.fillBlank || ''} onChange={event => updateQuizResponse(item.id, 'fillBlank', event.target.value)} className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200" />{result && <p className={`text-xs font-bold mt-1 ${result.fillBlank ? 'text-green-600' : 'text-red-500'}`}>{result.fillBlank ? 'Correct' : 'Incorrect'}</p>}</div>
                  <div><p className="text-sm font-bold mb-2">2. {item.miniQuiz.multipleChoiceQuestion}</p><div className="grid gap-2">{item.miniQuiz.multipleChoiceOptions.map(option => <button key={option} onClick={() => updateQuizResponse(item.id, 'multipleChoice', option)} className={`text-left px-3 py-2 rounded-xl border text-sm font-semibold ${response.multipleChoice === option ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200'}`}>{option}</button>)}</div>{result && <p className={`text-xs font-bold mt-1 ${result.multipleChoice ? 'text-green-600' : 'text-red-500'}`}>{result.multipleChoice ? 'Correct' : 'Incorrect'}</p>}</div>
                  <div><p className="text-sm font-bold mb-2">3. {item.miniQuiz.rewritePrompt}</p><textarea value={response.rewrite || ''} onChange={event => updateQuizResponse(item.id, 'rewrite', event.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200" /></div>
                  {revealed && <div className="rounded-xl bg-white border border-gray-200 p-3 text-sm space-y-1"><p><b>Fill answer:</b> {item.miniQuiz.fillBlankAnswer}</p><p><b>MC answer:</b> {item.miniQuiz.multipleChoiceAnswer}</p><p><b>Rewrite model:</b> {item.miniQuiz.rewriteAnswer}</p></div>}
                  <div className="flex flex-wrap gap-2"><button onClick={() => checkMiniQuiz(item)} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm">Check Answers</button><button onClick={() => toggleAnswers(item.id)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-600 font-bold text-sm">{revealed ? <EyeOff size={15} /> : <Eye size={15} />}{revealed ? 'Hide Answers' : 'Show Answers'}</button></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredItems.length === 0 && <div className="rounded-[2rem] border-2 border-dashed border-gray-200 bg-gray-50 py-14 text-center text-gray-400 font-bold">Không có vocab phù hợp.</div>}

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90dvh] overflow-y-auto card-shadow"><div className="p-6 border-b border-gray-100 flex items-center justify-between"><h3 className="text-2xl font-black">Add Word</h3><button onClick={resetAddModal}><X /></button></div><div className="p-6 space-y-4"><div className="flex gap-3"><input value={newWord} onChange={event => { setNewWord(event.target.value); setDuplicateMessage(''); }} placeholder="Word or collocation" className="flex-1 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 font-bold" /><button onClick={handleAutoDefine} disabled={isDefining || !newWord.trim()} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-50"><Wand2 size={18} /> {isDefining ? 'Defining...' : 'Auto Define'}</button></div>{duplicateMessage && <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm font-bold text-amber-700">{duplicateMessage}</div>}{renderFields(formData, setFormData)}</div><div className="p-6 border-t border-gray-100 flex justify-end gap-3"><button onClick={resetAddModal} className="px-5 py-3 rounded-xl bg-gray-100 font-bold text-gray-500">Cancel</button><button onClick={handleSave} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#A5D6A7] text-[#2D5A27] font-bold"><Save size={17} /> Save</button></div></div></div>
      )}

      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90dvh] overflow-y-auto card-shadow"><div className="p-6 border-b border-gray-100 flex items-center justify-between"><h3 className="text-2xl font-black">Edit Word</h3><button onClick={closeEdit}><X /></button></div><div className="p-6 space-y-4"><input value={editData.word || ''} onChange={event => setEditData({ ...editData, word: event.target.value })} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 font-bold" />{editMessage && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm font-bold text-red-600">{editMessage}</div>}{renderFields(editData, setEditData)}</div><div className="p-6 border-t border-gray-100 flex justify-end gap-3"><button onClick={closeEdit} className="px-5 py-3 rounded-xl bg-gray-100 font-bold text-gray-500">Cancel</button><button onClick={handleUpdate} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#A5D6A7] text-[#2D5A27] font-bold"><Save size={17} /> Save Changes</button></div></div></div>
      )}
    </div>
  );
}
