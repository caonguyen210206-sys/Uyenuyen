import { useState } from 'react';
import { BookMarked, Image as ImageIcon, Layers, Plus, Search, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { CollocationItem, ViewState, VocabItem } from '../types';
import { useVocab } from '../context/VocabContext';
import { extractCollocationsFromImage, extractCollocationsFromText, CollocationPayload } from '../lib/collocationAi';
import { formatBand, normalizeBand, normalizeWord } from '../lib/vocabUtils';

interface CollocationsProps {
  setCurrentView: (v: ViewState) => void;
}

type ImportMode = 'none' | 'raw' | 'paragraph' | 'image';

type ManualForm = {
  phrase: string;
  meaning: string;
  definition: string;
  structure: string;
  example: string;
  topic: string;
  band: string;
};

const emptyForm: ManualForm = {
  phrase: '',
  meaning: '',
  definition: '',
  structure: '',
  example: '',
  topic: '',
  band: '6.0',
};

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

export default function Collocations({ setCurrentView }: CollocationsProps) {
  const {
    items,
    updateVocabItems,
    collocations,
    updateCollocationItems,
    removeCollocationItems,
    settings,
  } = useVocab();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [topicFilter, setTopicFilter] = useState('All Topics');
  const [importMode, setImportMode] = useState<ImportMode>('none');
  const [importText, setImportText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState<ManualForm>(emptyForm);

  const topics = Array.from(new Set(collocations.map(item => item.topic?.trim() || 'General'))).sort();
  const selectedItems = collocations.filter(item => selectedIds.has(item.id));

  const filtered = collocations.filter(item => {
    const query = normalizeWord(search);
    const topic = item.topic?.trim() || 'General';
    const matchesTopic = topicFilter === 'All Topics' || topic === topicFilter;
    const matchesSearch = !query || normalizeWord(`${item.phrase} ${item.meaning} ${item.definition} ${item.structure} ${item.topic}`).includes(query);
    return matchesTopic && matchesSearch;
  });

  const existingVocabWords = new Set(items.map(item => normalizeWord(item.word)));

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

  const addCollocations = async (payloads: CollocationPayload[], source: string) => {
    const existing = new Set(collocations.map(item => normalizeWord(item.phrase)));
    const batch = new Set<string>();
    const skipped: string[] = [];

    const newItems = payloads.reduce<CollocationItem[]>((acc, payload) => {
      const phrase = payload.phrase?.trim() || '';
      const normalized = normalizeWord(phrase);
      if (!normalized) return acc;
      if (existing.has(normalized) || batch.has(normalized)) {
        skipped.push(phrase);
        return acc;
      }
      batch.add(normalized);
      acc.push(buildCollocation(payload, source));
      return acc;
    }, []);

    if (newItems.length > 0) {
      await updateCollocationItems([...collocations, ...newItems]);
      setSelectedIds(new Set(newItems.map(item => item.id)));
    }

    if (skipped.length > 0) {
      alert(`Đã bỏ qua ${skipped.length} collocation trùng: ${skipped.slice(0, 8).join(', ')}${skipped.length > 8 ? '...' : ''}`);
    }

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

      const added = await addCollocations(payloads, importMode === 'image' ? 'AI Image Import' : importMode === 'raw' ? 'AI Raw Import' : 'AI Paragraph Import');
      setImportMode('none');
      setImportText('');
      setImageFile(null);
      alert(`Đã thêm ${added} collocation vào tab Collocation và tick sẵn.`);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Import collocation chưa thành công. Hãy kiểm tra Gemini API Key trong Settings.');
    } finally {
      setIsImporting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    const filteredIds = filtered.map(item => item.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      filteredIds.forEach(id => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Xoá ${selectedIds.size} collocation đã chọn?`)) return;
    await removeCollocationItems(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

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

  const addSelectedToVocabList = async (goPractice = false) => {
    if (selectedItems.length === 0) return;
    const skipped: string[] = [];
    const newVocabItems = selectedItems.reduce<VocabItem[]>((acc, item) => {
      const normalized = normalizeWord(item.phrase);
      if (!normalized || existingVocabWords.has(normalized)) {
        skipped.push(item.phrase);
        return acc;
      }
      existingVocabWords.add(normalized);
      acc.push(collocationToVocab(item));
      return acc;
    }, []);

    if (newVocabItems.length > 0) {
      await updateVocabItems([...items, ...newVocabItems]);
    }

    if (skipped.length > 0) {
      alert(`Đã bỏ qua ${skipped.length} collocation đã có trong Vocab List: ${skipped.slice(0, 8).join(', ')}${skipped.length > 8 ? '...' : ''}`);
    }

    setSelectedIds(new Set());
    if (goPractice) setCurrentView('practice');
    else setCurrentView('vocab-list');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-[#2D5A27]">Collocation Bank</h2>
          <p className="text-gray-500 font-medium mt-1">Lưu cụm từ tự nhiên, import từ text, đoạn văn hoặc hình ảnh.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <button onClick={() => setImportMode('raw')} className="flex items-center gap-2 px-5 py-2.5 bg-white border-thin font-bold rounded-xl shadow-sm hover:bg-purple-50 text-purple-700 transition-colors">
            <Sparkles size={18} /> Import Text
          </button>
          <button onClick={() => setImportMode('paragraph')} className="flex items-center gap-2 px-5 py-2.5 bg-white border-thin font-bold rounded-xl shadow-sm hover:bg-blue-50 text-blue-700 transition-colors">
            <BookMarked size={18} /> From Paragraph
          </button>
          <button onClick={() => setImportMode('image')} className="flex items-center gap-2 px-5 py-2.5 bg-white border-thin font-bold rounded-xl shadow-sm hover:bg-amber-50 text-amber-700 transition-colors">
            <ImageIcon size={18} /> From Image
          </button>
          <button onClick={() => setShowManual(true)} className="flex items-center gap-2 px-5 py-2.5 bg-[#A5D6A7] hover:bg-[#81C784] text-[#2D5A27] font-bold rounded-xl border-thin shadow-sm transition-colors">
            <Plus size={18} /> Add Manual
          </button>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-3xl bg-white border-thin card-shadow p-5">
          <p className="text-sm font-bold text-gray-400">Total</p>
          <p className="text-3xl font-black text-[#2D5A27]">{collocations.length}</p>
        </div>
        <div className="rounded-3xl bg-white border-thin card-shadow p-5">
          <p className="text-sm font-bold text-gray-400">Selected</p>
          <p className="text-3xl font-black text-blue-600">{selectedItems.length}</p>
        </div>
        <div className="rounded-3xl bg-white border-thin card-shadow p-5 col-span-2">
          <p className="text-sm font-bold text-gray-400 mb-2">Workflow</p>
          <p className="text-sm font-bold text-gray-600">Import → tick collocations → Add to Vocab List → Practice theo collocation như từ vựng thường.</p>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] card-shadow border-thin p-5 space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[260px]">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search phrase, meaning, topic..." className="w-full bg-gray-50 border-thin pl-10 pr-4 py-3 rounded-xl font-semibold text-gray-700 focus:outline-none focus:border-[#A5D6A7]" />
          </div>
          <select value={topicFilter} onChange={e => setTopicFilter(e.target.value)} className="bg-gray-50 border-thin px-4 py-3 rounded-xl font-bold text-gray-600 focus:outline-none focus:border-[#A5D6A7]">
            <option>All Topics</option>
            {topics.map(topic => <option key={topic}>{topic}</option>)}
          </select>
          <button onClick={toggleSelectAllFiltered} className="px-4 py-3 bg-gray-50 border-thin rounded-xl font-bold text-gray-600 hover:bg-gray-100">Select filtered</button>
          <button onClick={() => addSelectedToVocabList(false)} disabled={selectedItems.length === 0} className="px-4 py-3 bg-[#E8F5E9] border-[#A5D6A7] border-thin rounded-xl font-bold text-[#2D5A27] hover:bg-[#D0E8D0] disabled:opacity-40">Add selected to Vocab List</button>
          <button onClick={() => addSelectedToVocabList(true)} disabled={selectedItems.length === 0} className="px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl font-bold text-blue-600 hover:bg-blue-100 disabled:opacity-40">Practice selected</button>
          <button onClick={deleteSelected} disabled={selectedItems.length === 0} className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl font-bold text-red-500 hover:bg-red-100 disabled:opacity-40">Delete</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {filtered.map(item => (
          <div key={item.id} className={`rounded-[2rem] border-thin bg-white p-5 card-shadow transition-shadow ${selectedIds.has(item.id) ? 'ring-2 ring-[#A5D6A7]' : ''}`}>
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="mt-2" />
              <div className="flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-black text-[#2D5A27]">{item.phrase}</h3>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-bold text-xs">{formatBand(item.band)}</span>
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-bold text-xs">{item.topic || 'General'}</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-bold text-xs">{item.source}</span>
                    </div>
                  </div>
                  <Layers className="text-[#A5D6A7]" size={24} />
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <p><span className="font-bold text-gray-600">Meaning:</span> <span className="font-semibold text-gray-800">{item.meaning}</span></p>
                  <p><span className="font-bold text-gray-600">Definition:</span> <span className="text-gray-700">{item.definition || '-'}</span></p>
                  <p><span className="font-bold text-gray-600">Structure:</span> <span className="text-gray-700 font-mono">{item.structure || '-'}</span></p>
                  <p><span className="font-bold text-gray-600">Example:</span> <span className="text-gray-700 italic">"{item.example || '-'}"</span></p>
                </div>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-2 rounded-[2rem] border-2 border-dashed border-gray-200 bg-gray-50 py-20 text-center">
            <p className="font-bold text-gray-400">Chưa có collocation phù hợp.</p>
          </div>
        )}
      </div>

      {showManual && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] p-7 w-full max-w-2xl card-shadow max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-2xl font-extrabold text-gray-800">Add Collocation</h3>
              <button onClick={() => setShowManual(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-bold text-gray-500 mb-1">Collocation</label>
                <input value={manualForm.phrase} onChange={e => setManualForm(prev => ({...prev, phrase: e.target.value}))} placeholder="make a decision" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-bold text-gray-500 mb-1">Meaning (VN)</label>
                <input value={manualForm.meaning} onChange={e => setManualForm(prev => ({...prev, meaning: e.target.value}))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-semibold" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Structure</label>
                <input value={manualForm.structure} onChange={e => setManualForm(prev => ({...prev, structure: e.target.value}))} placeholder="verb + noun" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Band</label>
                <input value={manualForm.band} onChange={e => setManualForm(prev => ({...prev, band: normalizeBand(e.target.value)}))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-bold text-gray-500 mb-1">Definition</label>
                <textarea value={manualForm.definition} onChange={e => setManualForm(prev => ({...prev, definition: e.target.value}))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" rows={2} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-bold text-gray-500 mb-1">Example</label>
                <textarea value={manualForm.example} onChange={e => setManualForm(prev => ({...prev, example: e.target.value}))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl italic" rows={2} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-bold text-gray-500 mb-1">Topic</label>
                <input value={manualForm.topic} onChange={e => setManualForm(prev => ({...prev, topic: e.target.value}))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
              </div>
            </div>
            <button onClick={handleManualSave} className="mt-5 w-full py-4 bg-[#A5D6A7] text-[#2D5A27] font-bold rounded-2xl border-thin hover:bg-[#81C784]">Save Collocation</button>
          </div>
        </div>
      )}

      {importMode !== 'none' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl overflow-hidden card-shadow">
            <div className="flex items-center justify-between p-6 border-b border-thin bg-gray-50/50">
              <h3 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                <Upload className="text-purple-500" />
                {importMode === 'image' ? 'Import Collocations from Image' : importMode === 'paragraph' ? 'Extract Collocations from Paragraph' : 'Import Collocations from Text'}
              </h3>
              <button onClick={() => setImportMode('none')} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
              {importMode === 'image' ? (
                <div>
                  <p className="text-gray-600 font-medium mb-4">Upload ảnh chụp sách, note, screenshot hoặc bài đọc. AI sẽ đọc ảnh và lọc collocation.</p>
                  <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="w-full rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50 p-6 font-bold text-amber-700" />
                  {imageFile && <p className="mt-3 text-sm font-bold text-amber-700">Selected: {imageFile.name}</p>}
                </div>
              ) : (
                <div>
                  <p className="text-gray-600 font-medium mb-4">{importMode === 'raw' ? 'Dán danh sách collocation/từ vựng chưa định dạng.' : 'Dán đoạn văn tiếng Anh, AI sẽ lọc cụm từ tự nhiên.'}</p>
                  <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="Paste here..." className="w-full h-56 p-4 border-2 border-gray-200 rounded-2xl focus:border-purple-400 focus:ring-4 focus:ring-purple-400/10 outline-none resize-none font-medium text-gray-700" />
                </div>
              )}
            </div>
            <div className="p-6 bg-gray-50/50 border-t border-thin flex justify-end gap-3">
              <button onClick={() => setImportMode('none')} disabled={isImporting} className="px-6 py-3 font-bold text-gray-600 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={handleImport} disabled={isImporting || (importMode === 'image' ? !imageFile : !importText.trim())} className="flex items-center gap-2 px-6 py-3 font-bold text-white bg-[#2D5A27] rounded-xl hover:bg-[#1B3617] disabled:opacity-50 shadow-sm">
                <Sparkles size={18} /> {isImporting ? 'Importing...' : 'Import Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
