import { useMemo, useState } from 'react';
import { BookMarked, Image as ImageIcon, Layers, Plus, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { CollocationItem, ViewState, VocabItem } from '../types';
import { useVocab } from '../context/VocabContext';
import { extractCollocationsFromImage, extractCollocationsFromText, CollocationPayload } from '../lib/collocationAi';
import { formatBand, normalizeBand, normalizeWord } from '../lib/vocabUtils';
import VocabFilterBar, { VocabSortMode } from './VocabFilterBar';

interface CollocationsProps {
  setCurrentView: (v: ViewState) => void;
}

type ImportMode = 'none' | 'raw' | 'paragraph' | 'image';
type ManualForm = Pick<CollocationItem, 'phrase' | 'meaning' | 'definition' | 'structure' | 'example' | 'topic' | 'band'>;

const PRACTICE_SELECTION_STORAGE_KEY = 'uyenuyen-practice-selection';
const emptyForm: ManualForm = { phrase: '', meaning: '', definition: '', structure: '', example: '', topic: '', band: '6.0' };

function fileToImageInput(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      if (!base64) reject(new Error('Không đọc được ảnh.'));
      else resolve({ base64, mimeType: file.type || 'image/png' });
    };
    reader.onerror = () => reject(new Error('Không đọc được file ảnh.'));
    reader.readAsDataURL(file);
  });
}

function bandNumber(value?: string) {
  if (!value || value === 'Basic') return 0;
  return Number.parseFloat(value) || 0;
}

export default function Collocations({ setCurrentView }: CollocationsProps) {
  const { items, updateVocabItems, collocations, updateCollocationItems, removeCollocationItems, settings } = useVocab();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<VocabSortMode>('newest');
  const [topicFilter, setTopicFilter] = useState('All Topics');
  const [sourceFilter, setSourceFilter] = useState('All Sources');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [importMode, setImportMode] = useState<ImportMode>('none');
  const [importText, setImportText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState<ManualForm>(emptyForm);

  const topics = Array.from(new Set(collocations.map(item => item.topic?.trim() || 'General'))).sort();
  const sources = Array.from(new Set(collocations.map(item => item.source).filter(Boolean))).sort();
  const selectedItems = collocations.filter(item => selectedIds.has(item.id));

  const filtered = useMemo(() => {
    const query = normalizeWord(search);
    return collocations
      .filter(item => {
        const topic = item.topic?.trim() || 'General';
        const matchesSearch = !query || normalizeWord(`${item.phrase} ${item.meaning} ${item.definition} ${item.structure} ${topic}`).includes(query);
        const matchesTopic = topicFilter === 'All Topics' || topic === topicFilter;
        const matchesSource = sourceFilter === 'All Sources' || item.source === sourceFilter;
        const matchesStatus = statusFilter === 'All Statuses' || item.status === statusFilter;
        return matchesSearch && matchesTopic && matchesSource && matchesStatus;
      })
      .sort((a, b) => {
        if (sort === 'oldest') return a.createdAt - b.createdAt;
        if (sort === 'az') return a.phrase.localeCompare(b.phrase);
        if (sort === 'za') return b.phrase.localeCompare(a.phrase);
        if (sort === 'band-high') return bandNumber(b.band) - bandNumber(a.band);
        if (sort === 'band-low') return bandNumber(a.band) - bandNumber(b.band);
        return b.createdAt - a.createdAt;
      });
  }, [collocations, search, sort, topicFilter, sourceFilter, statusFilter]);

  const buildCollocation = (payload: CollocationPayload, source: string): CollocationItem => ({
    id: uuidv4(),
    phrase: payload.phrase?.trim() || '',
    meaning: payload.meaning?.trim() || '',
    definition: payload.definition?.trim() || '',
    structure: payload.structure?.trim() || '',
    example: payload.example?.trim() || '',
    topic: payload.topic?.trim() || 'General',
    band: normalizeBand(payload.band) || 'Basic',
    status: 'Storage',
    source,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    timesChecked: 0,
  });

  const collocationToVocab = (item: CollocationItem): VocabItem => ({
    id: uuidv4(),
    word: item.phrase,
    ipa: '',
    wordType: 'collocation',
    meaning: item.meaning,
    definition: item.definition || item.structure,
    example: item.example,
    synonyms: '',
    antonyms: '',
    band: normalizeBand(item.band),
    topic: item.topic,
    status: 'Studying',
    masteryLevel: 'New',
    source: 'Collocation',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    timesChecked: 0,
  });

  const addCollocations = async (payloads: CollocationPayload[], source: string) => {
    const existing = new Set(collocations.map(item => normalizeWord(item.phrase)));
    const batch = new Set<string>();
    const newItems: CollocationItem[] = [];
    let skipped = 0;

    payloads.forEach(payload => {
      const phrase = payload.phrase?.trim() || '';
      const normalized = normalizeWord(phrase);
      if (!normalized) return;
      if (existing.has(normalized) || batch.has(normalized)) {
        skipped++;
        return;
      }
      batch.add(normalized);
      newItems.push(buildCollocation(payload, source));
    });

    if (newItems.length > 0) {
      await updateCollocationItems([...collocations, ...newItems]);
      setSelectedIds(new Set(newItems.map(item => item.id)));
    }
    if (skipped > 0) alert(`Đã bỏ qua ${skipped} collocation trùng.`);
    return newItems.length;
  };

  const handleManualSave = async () => {
    if (!manualForm.phrase.trim() || !manualForm.meaning.trim()) return;
    const added = await addCollocations([manualForm], 'Manual');
    if (added > 0) {
      setManualForm(emptyForm);
      setShowManual(false);
    }
  };

  const handleImport = async () => {
    if (importMode === 'none') return;
    if ((importMode === 'raw' || importMode === 'paragraph') && !importText.trim()) return;
    if (importMode === 'image' && !imageFile) return;

    setIsImporting(true);
    try {
      const payloads = importMode === 'image'
        ? await extractCollocationsFromImage(await fileToImageInput(imageFile!), settings.apiKey)
        : await extractCollocationsFromText(importText, settings.apiKey, importMode);
      if (payloads.length === 0) {
        alert('Không tìm thấy collocation phù hợp.');
        return;
      }
      const source = importMode === 'image' ? 'AI Image Import' : importMode === 'raw' ? 'AI Raw Import' : 'AI Paragraph Import';
      const added = await addCollocations(payloads, source);
      setImportMode('none');
      setImportText('');
      setImageFile(null);
      alert(`Đã thêm ${added} collocation và tick sẵn.`);
    } catch (error: any) {
      console.error(error);
      alert(error?.message || 'Import collocation chưa thành công.');
    } finally {
      setIsImporting(false);
    }
  };

  const toggleSelect = (id: string) => setSelectedIds(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const toggleSelectAllFiltered = () => {
    const ids = filtered.map(item => item.id);
    const allSelected = ids.length > 0 && ids.every(id => selectedIds.has(id));
    setSelectedIds(previous => {
      const next = new Set(previous);
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Xoá ${selectedIds.size} collocation đã chọn?`)) return;
    await removeCollocationItems(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const addSelectedToVocabList = async (goPractice = false) => {
    if (selectedItems.length === 0) return;
    const updatedItems = [...items];
    const handoffIds: string[] = [];
    let addedCount = 0;
    let existingCount = 0;

    selectedItems.forEach(collocation => {
      const normalized = normalizeWord(collocation.phrase);
      if (!normalized) return;
      const existing = updatedItems.find(item => normalizeWord(item.word) === normalized);
      if (existing) {
        handoffIds.push(existing.id);
        existingCount++;
        return;
      }
      const newItem = collocationToVocab(collocation);
      updatedItems.push(newItem);
      handoffIds.push(newItem.id);
      addedCount++;
    });

    if (addedCount > 0) await updateVocabItems(updatedItems);
    setSelectedIds(new Set());

    if (goPractice) {
      if (handoffIds.length === 0) return;
      sessionStorage.setItem(PRACTICE_SELECTION_STORAGE_KEY, JSON.stringify({
        ids: handoffIds,
        label: `${handoffIds.length} selected collocations`,
        source: 'collocation',
        createdAt: Date.now(),
      }));
      setCurrentView('practice');
      return;
    }

    if (existingCount > 0) alert(`${existingCount} collocation đã có trong Vocab List nên không thêm trùng.`);
    setCurrentView('vocab-list');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="text-3xl font-extrabold text-[#2D5A27]">Collocation Bank</h2><p className="text-gray-500 font-medium mt-1">Practice selected chỉ test đúng nhóm bạn chọn.</p></div>
        <div className="flex flex-wrap justify-end gap-3">
          <button onClick={() => setImportMode('raw')} className="flex items-center gap-2 px-4 py-2.5 bg-white border-thin font-bold rounded-xl text-purple-700"><Sparkles size={18} /> Import Text</button>
          <button onClick={() => setImportMode('paragraph')} className="flex items-center gap-2 px-4 py-2.5 bg-white border-thin font-bold rounded-xl text-blue-700"><BookMarked size={18} /> From Paragraph</button>
          <button onClick={() => setImportMode('image')} className="flex items-center gap-2 px-4 py-2.5 bg-white border-thin font-bold rounded-xl text-amber-700"><ImageIcon size={18} /> From Image</button>
          <button onClick={() => setShowManual(true)} className="flex items-center gap-2 px-4 py-2.5 bg-[#A5D6A7] text-[#2D5A27] font-bold rounded-xl border-thin"><Plus size={18} /> Add Manual</button>
        </div>
      </header>

      <VocabFilterBar
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        topic={topicFilter}
        onTopicChange={setTopicFilter}
        topics={topics}
        source={sourceFilter}
        onSourceChange={setSourceFilter}
        sources={sources}
        status={statusFilter}
        onStatusChange={setStatusFilter}
      />

      <div className="bg-white rounded-2xl border-thin card-shadow p-4 flex flex-wrap items-center gap-3">
        <span className="font-bold text-gray-500">Hiển thị {filtered.length}/{collocations.length} · Selected {selectedItems.length}</span>
        <button onClick={toggleSelectAllFiltered} className="px-4 py-2.5 bg-gray-50 border-thin rounded-xl font-bold text-gray-600">Select visible</button>
        <button onClick={() => addSelectedToVocabList(false)} disabled={selectedItems.length === 0} className="px-4 py-2.5 bg-[#E8F5E9] border border-[#A5D6A7] rounded-xl font-bold text-[#2D5A27] disabled:opacity-40">Add selected to Vocab List</button>
        <button onClick={() => addSelectedToVocabList(true)} disabled={selectedItems.length === 0} className="px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-xl font-bold text-blue-600 disabled:opacity-40">Practice selected only</button>
        <button onClick={deleteSelected} disabled={selectedItems.length === 0} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl font-bold text-red-500 disabled:opacity-40"><Trash2 size={16} /> Delete</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filtered.map(item => (
          <div key={item.id} className={`rounded-[2rem] border-thin bg-white p-5 card-shadow ${selectedIds.has(item.id) ? 'ring-2 ring-[#A5D6A7]' : ''}`}>
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="mt-2" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3"><div><h3 className="text-2xl font-black text-[#2D5A27] break-words">{item.phrase}</h3><div className="flex gap-2 mt-1 flex-wrap"><span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-bold text-xs">{formatBand(item.band)}</span><span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-bold text-xs">{item.topic || 'General'}</span><span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-bold text-xs">{item.source}</span></div></div><Layers className="text-[#A5D6A7] shrink-0" size={24} /></div>
                <div className="mt-4 space-y-2 text-sm"><p><b>Meaning:</b> {item.meaning}</p><p><b>Definition:</b> {item.definition || '-'}</p><p><b>Structure:</b> <span className="font-mono">{item.structure || '-'}</span></p><p><b>Example:</b> <span className="italic">{item.example || '-'}</span></p></div>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="md:col-span-2 rounded-[2rem] border-2 border-dashed border-gray-200 bg-gray-50 py-16 text-center text-gray-400 font-bold">Không có collocation phù hợp.</div>}
      </div>

      {showManual && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"><div className="bg-white rounded-[2rem] p-6 w-full max-w-2xl card-shadow max-h-[90dvh] overflow-y-auto"><div className="flex items-center justify-between mb-5"><h3 className="text-2xl font-extrabold">Add Collocation</h3><button onClick={() => setShowManual(false)}><X /></button></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><input value={manualForm.phrase} onChange={e => setManualForm(previous => ({ ...previous, phrase: e.target.value }))} placeholder="Collocation" className="sm:col-span-2 px-4 py-3 bg-gray-50 border rounded-xl font-bold" /><input value={manualForm.meaning} onChange={e => setManualForm(previous => ({ ...previous, meaning: e.target.value }))} placeholder="Meaning (VN)" className="sm:col-span-2 px-4 py-3 bg-gray-50 border rounded-xl" /><input value={manualForm.structure} onChange={e => setManualForm(previous => ({ ...previous, structure: e.target.value }))} placeholder="Structure" className="px-4 py-3 bg-gray-50 border rounded-xl" /><input value={manualForm.band} onChange={e => setManualForm(previous => ({ ...previous, band: e.target.value }))} placeholder="Band" className="px-4 py-3 bg-gray-50 border rounded-xl" /><textarea value={manualForm.definition} onChange={e => setManualForm(previous => ({ ...previous, definition: e.target.value }))} placeholder="Definition" rows={2} className="sm:col-span-2 px-4 py-3 bg-gray-50 border rounded-xl" /><textarea value={manualForm.example} onChange={e => setManualForm(previous => ({ ...previous, example: e.target.value }))} placeholder="Example" rows={2} className="sm:col-span-2 px-4 py-3 bg-gray-50 border rounded-xl" /><input value={manualForm.topic} onChange={e => setManualForm(previous => ({ ...previous, topic: e.target.value }))} placeholder="Topic" className="sm:col-span-2 px-4 py-3 bg-gray-50 border rounded-xl" /></div><button onClick={handleManualSave} className="mt-5 w-full py-4 bg-[#A5D6A7] text-[#2D5A27] font-bold rounded-2xl">Save Collocation</button></div></div>
      )}

      {importMode !== 'none' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"><div className="bg-white rounded-[2rem] w-full max-w-2xl overflow-hidden card-shadow"><div className="flex items-center justify-between p-6 border-b bg-gray-50"><h3 className="text-xl font-extrabold flex items-center gap-2"><Upload className="text-purple-500" />{importMode === 'image' ? 'Import Collocations from Image' : importMode === 'paragraph' ? 'Extract Collocations from Paragraph' : 'Import Collocations from Text'}</h3><button onClick={() => setImportMode('none')}><X /></button></div><div className="p-6">{importMode === 'image' ? <input type="file" accept="image/*" onChange={event => setImageFile(event.target.files?.[0] || null)} className="w-full rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50 p-6 font-bold text-amber-700" /> : <textarea value={importText} onChange={event => setImportText(event.target.value)} placeholder="Paste here..." className="w-full h-56 p-4 border-2 border-gray-200 rounded-2xl resize-none" />}</div><div className="p-6 bg-gray-50 flex justify-end gap-3 border-t"><button onClick={() => setImportMode('none')} className="px-5 py-3 bg-white border rounded-xl font-bold text-gray-500">Cancel</button><button onClick={handleImport} disabled={isImporting} className="px-6 py-3 bg-purple-500 text-white rounded-xl font-bold disabled:opacity-50">{isImporting ? 'Importing...' : 'Import'}</button></div></div></div>
      )}
    </div>
  );
}
