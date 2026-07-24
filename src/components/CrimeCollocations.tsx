import { useMemo, useState } from 'react';
import { BookOpenCheck, CheckCircle2, ExternalLink, ListPlus, Search, ShieldAlert, Tags } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { CollocationItem, ViewState, VocabItem } from '../types';
import { useVocab } from '../context/VocabContext';
import { CRIME_PDF_COLLOCATIONS, CRIME_PDF_SOURCE } from '../data/crimePdfCollocations';
import { formatBand, normalizeWord } from '../lib/vocabUtils';

interface CrimeCollocationsProps {
  setCurrentView: (view: ViewState) => void;
}

type PackFilter = 'all' | 'pdf-default' | 'already-existed' | 'missing';
const PRACTICE_SELECTION_STORAGE_KEY = 'uyenuyen-practice-selection';

function toPracticeWordType(item: CollocationItem) {
  const wordCount = item.phrase.trim().split(/\s+/).length;
  if (wordCount > 1 || item.phrase.includes('/')) return 'collocation';
  if (item.structure.toLowerCase().includes('verb')) return 'verb';
  if (item.structure.toLowerCase().includes('adjective')) return 'adjective';
  return 'noun';
}

export default function CrimeCollocations({ setCurrentView }: CrimeCollocationsProps) {
  const { collocations, updateCollocationItems, items, updateVocabItems } = useVocab();
  const [packFilter, setPackFilter] = useState<PackFilter>('all');
  const [topicFilter, setTopicFilter] = useState('All Sections');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const matchByPhrase = useMemo(() => {
    const map = new Map<string, CollocationItem>();
    collocations.forEach(item => {
      const key = normalizeWord(item.phrase);
      if (key && !map.has(key)) map.set(key, item);
    });
    return map;
  }, [collocations]);

  const records = CRIME_PDF_COLLOCATIONS.map(entry => {
    const existing = matchByPhrase.get(normalizeWord(entry.phrase));
    const status: Exclude<PackFilter, 'all'> = !existing
      ? 'missing'
      : existing.source === CRIME_PDF_SOURCE
        ? 'pdf-default'
        : 'already-existed';
    return { entry, existing, status };
  });

  const topics = Array.from(new Set(CRIME_PDF_COLLOCATIONS.map(item => item.topic))).sort();
  const statusCounts = {
    all: records.length,
    'pdf-default': records.filter(record => record.status === 'pdf-default').length,
    'already-existed': records.filter(record => record.status === 'already-existed').length,
    missing: records.filter(record => record.status === 'missing').length,
  };

  const filteredRecords = records.filter(record => {
    const matchesStatus = packFilter === 'all' || record.status === packFilter;
    const matchesTopic = topicFilter === 'All Sections' || record.entry.topic === topicFilter;
    const query = normalizeWord(search);
    const matchesSearch = !query || normalizeWord(`${record.entry.phrase} ${record.entry.meaning} ${record.entry.topic} ${record.entry.structure}`).includes(query);
    return matchesStatus && matchesTopic && matchesSearch;
  });

  const selectedEntries = CRIME_PDF_COLLOCATIONS.filter(item => selectedIds.has(item.id));

  const toggleSelected = (id: string) => {
    setSelectedIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    const visibleIds = filteredRecords.map(record => record.entry.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
    setSelectedIds(previous => {
      const next = new Set(previous);
      visibleIds.forEach(id => allVisibleSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const ensureSelectedInCollocationBank = async () => {
    const existingKeys = new Set(collocations.map(item => normalizeWord(item.phrase)));
    const additions = selectedEntries
      .filter(entry => !existingKeys.has(normalizeWord(entry.phrase)))
      .map(entry => ({
        ...entry,
        id: uuidv4(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));

    if (additions.length > 0) {
      await updateCollocationItems([...collocations, ...additions]);
    }
    return additions.length;
  };

  const addSelectedToBank = async () => {
    if (selectedEntries.length === 0) return;
    const added = await ensureSelectedInCollocationBank();
    alert(added > 0
      ? `Đã thêm ${added} item còn thiếu vào Collocation Bank. Item có sẵn trước đó không bị tạo trùng.`
      : 'Tất cả item đã có trong Collocation Bank, không tạo thêm bản trùng.');
  };

  const practiceSelectedOnly = async () => {
    if (selectedEntries.length === 0) {
      alert('Hãy chọn ít nhất 1 từ/cụm trong Crime Pack.');
      return;
    }

    const nextCollocations = [...collocations];
    const collocationKeys = new Set(nextCollocations.map(item => normalizeWord(item.phrase)));
    let collocationChanged = false;

    selectedEntries.forEach(entry => {
      const key = normalizeWord(entry.phrase);
      if (!key || collocationKeys.has(key)) return;
      collocationKeys.add(key);
      nextCollocations.push({
        ...entry,
        id: uuidv4(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      collocationChanged = true;
    });

    const nextVocab = [...items];
    const handoffIds: string[] = [];
    let vocabChanged = false;

    selectedEntries.forEach(entry => {
      const key = normalizeWord(entry.phrase);
      const existingVocab = nextVocab.find(item => normalizeWord(item.word) === key);
      if (existingVocab) {
        handoffIds.push(existingVocab.id);
        return;
      }

      const vocabItem: VocabItem = {
        id: uuidv4(),
        word: entry.phrase,
        ipa: '',
        wordType: toPracticeWordType(entry),
        meaning: entry.meaning,
        definition: entry.definition,
        example: entry.example,
        synonyms: '',
        antonyms: '',
        band: entry.band,
        topic: entry.topic,
        status: 'Studying',
        masteryLevel: 'New',
        source: 'Crime PDF Pack',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        timesChecked: 0,
      };
      nextVocab.push(vocabItem);
      handoffIds.push(vocabItem.id);
      vocabChanged = true;
    });

    if (collocationChanged) await updateCollocationItems(nextCollocations);
    if (vocabChanged) await updateVocabItems(nextVocab);

    sessionStorage.setItem(PRACTICE_SELECTION_STORAGE_KEY, JSON.stringify({
      ids: handoffIds,
      label: `${handoffIds.length} selected Crime PDF items`,
      source: 'crime-pdf',
      createdAt: Date.now(),
    }));
    setCurrentView('practice');
  };

  const filterButtons: Array<{ id: PackFilter; label: string }> = [
    { id: 'all', label: 'All PDF' },
    { id: 'pdf-default', label: 'PDF Default' },
    { id: 'already-existed', label: 'Already existed' },
    { id: 'missing', label: 'Missing' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100">
              <ShieldAlert size={26} />
            </div>
            <div>
              <h2 className="text-3xl font-extrabold text-[#2D5A27]">Crime Vocabulary & Collocations</h2>
              <p className="text-gray-500 font-medium mt-1">Gói mặc định riêng từ PDF Crime IELTS Writing.</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setCurrentView('collocations')}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white border-thin font-bold text-[#2D5A27] hover:bg-[#E8F5E9]"
        >
          <ExternalLink size={18} /> Open main Collocation Bank
        </button>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-3xl bg-white border-thin card-shadow p-5"><p className="text-sm font-bold text-gray-400">PDF items</p><p className="text-3xl font-black text-[#2D5A27]">{statusCounts.all}</p></div>
        <div className="rounded-3xl bg-green-50 border border-green-100 p-5"><p className="text-sm font-bold text-green-600">Added from PDF</p><p className="text-3xl font-black text-green-700">{statusCounts['pdf-default']}</p></div>
        <div className="rounded-3xl bg-amber-50 border border-amber-100 p-5"><p className="text-sm font-bold text-amber-600">Already existed</p><p className="text-3xl font-black text-amber-700">{statusCounts['already-existed']}</p></div>
        <div className="rounded-3xl bg-gray-50 border border-gray-200 p-5"><p className="text-sm font-bold text-gray-500">Missing / deleted</p><p className="text-3xl font-black text-gray-700">{statusCounts.missing}</p></div>
      </div>

      <div className="rounded-2xl bg-blue-50 border border-blue-100 px-5 py-4 text-sm font-semibold text-blue-700">
        <span className="font-extrabold">Phân biệt nguồn:</span> nhãn xanh là item được thêm từ PDF; nhãn vàng là item đã có trước đó từ Manual, AI Import hoặc bộ IELTS Writing cũ nên app không tạo bản trùng.
      </div>

      <div className="bg-white rounded-[2rem] border-thin card-shadow p-5 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {filterButtons.map(button => (
            <button
              key={button.id}
              onClick={() => setPackFilter(button.id)}
              className={`px-4 py-3 rounded-2xl border font-extrabold transition-colors ${packFilter === button.id ? 'bg-[#E8F5E9] border-[#A5D6A7] text-[#2D5A27]' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}
            >
              {button.label} ({statusCounts[button.id]})
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search crime phrase or meaning..." className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border-thin font-semibold focus:outline-none" />
          </div>
          <select value={topicFilter} onChange={event => setTopicFilter(event.target.value)} className="px-4 py-3 rounded-xl bg-gray-50 border-thin font-bold text-gray-600">
            <option>All Sections</option>
            {topics.map(topic => <option key={topic}>{topic}</option>)}
          </select>
          <button onClick={toggleAllVisible} className="px-4 py-3 rounded-xl bg-gray-50 border-thin font-bold text-gray-600 hover:bg-gray-100">Select visible</button>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={addSelectedToBank} disabled={selectedEntries.length === 0} className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#E8F5E9] border border-[#A5D6A7] font-bold text-[#2D5A27] disabled:opacity-40">
            <ListPlus size={18} /> Add missing to Bank ({selectedEntries.length})
          </button>
          <button onClick={practiceSelectedOnly} disabled={selectedEntries.length === 0} className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-50 border border-blue-100 font-bold text-blue-700 disabled:opacity-40">
            <BookOpenCheck size={18} /> Practice selected only
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredRecords.map(({ entry, existing, status }) => (
          <label key={entry.id} className={`rounded-[2rem] bg-white border-thin card-shadow p-5 cursor-pointer transition-all ${selectedIds.has(entry.id) ? 'ring-2 ring-[#A5D6A7]' : ''}`}>
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={selectedIds.has(entry.id)} onChange={() => toggleSelected(entry.id)} className="mt-2" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black text-[#2D5A27] break-words">{entry.phrase}</h3>
                    <p className="font-semibold text-gray-700 mt-1">{entry.meaning}</p>
                  </div>
                  {status === 'pdf-default' ? <CheckCircle2 className="text-green-500 shrink-0" /> : status === 'already-existed' ? <Tags className="text-amber-500 shrink-0" /> : <ShieldAlert className="text-gray-400 shrink-0" />}
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold">{formatBand(entry.band)}</span>
                  <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">{entry.structure}</span>
                  <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-600 text-xs font-bold">{entry.topic}</span>
                  {status === 'pdf-default' && <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-bold">PDF Crime Default</span>}
                  {status === 'already-existed' && <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold">Already existed: {existing?.source || 'Unknown source'}</span>}
                  {status === 'missing' && <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">Missing from Bank</span>}
                </div>
              </div>
            </div>
          </label>
        ))}
      </div>

      {filteredRecords.length === 0 && (
        <div className="rounded-[2rem] border-2 border-dashed border-gray-200 bg-gray-50 py-16 text-center text-gray-400 font-bold">
          Không tìm thấy item phù hợp.
        </div>
      )}
    </div>
  );
}
