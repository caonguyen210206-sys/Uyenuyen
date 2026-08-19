import { useMemo, useState } from 'react';
import { Plus, Trash2, Sparkles, BookOpen, X, Loader2 } from 'lucide-react';
import { ViewState, VocabItem } from '../types';
import { useVocab } from '../context/VocabContext';
import { v4 as uuidv4 } from 'uuid';
import { extractVocabFromParagraph, processRawText } from '../lib/gemini';
import { formatBand, normalizeBand, normalizeWord } from '../lib/vocabUtils';
import VocabFilterBar, { VocabSortMode } from './VocabFilterBar';

interface LibraryProps {
  setCurrentView: (v: ViewState) => void;
}

function bandNumber(value?: string) {
  if (!value || value === 'Basic') return 0;
  return Number.parseFloat(value) || 0;
}

export default function Library({ setCurrentView }: LibraryProps) {
  const { items, updateVocabItems, removeVocabItems, settings, readingProjects } = useVocab();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [aiModalMode, setAiModalMode] = useState<'none' | 'raw' | 'paragraph'>('none');
  const [aiInputText, setAiInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<VocabSortMode>('newest');
  const [topicFilter, setTopicFilter] = useState('All Topics');
  const [projectFilter, setProjectFilter] = useState('All Projects');
  const [sourceFilter, setSourceFilter] = useState('All Sources');
  const [statusFilter, setStatusFilter] = useState('All Statuses');

  const selectedItems = items.filter(item => selectedIds.has(item.id));
  const selectedStorageItems = selectedItems.filter(item => item.status === 'Storage');
  const storageItems = items.filter(item => item.status === 'Storage');
  const topics = Array.from(new Set(items.map(item => item.topic).filter(Boolean))).sort();
  const sources = Array.from(new Set(items.map(item => item.source).filter(Boolean))).sort();

  const filteredItems = useMemo(() => {
    const query = normalizeWord(search);
    return items
      .filter(item => {
        const matchesSearch = !query || normalizeWord(`${item.word} ${item.meaning} ${item.definition} ${item.topic}`).includes(query);
        const matchesTopic = topicFilter === 'All Topics' || item.topic === topicFilter;
        const matchesSource = sourceFilter === 'All Sources' || item.source === sourceFilter;
        const matchesStatus = statusFilter === 'All Statuses' || item.status === statusFilter;
        const matchesProject = projectFilter === 'All Projects' || item.projectIds?.includes(projectFilter);
        return matchesSearch && matchesTopic && matchesSource && matchesStatus && matchesProject;
      })
      .sort((a, b) => {
        if (sort === 'oldest') return a.createdAt - b.createdAt;
        if (sort === 'az') return a.word.localeCompare(b.word);
        if (sort === 'za') return b.word.localeCompare(a.word);
        if (sort === 'band-high') return bandNumber(b.band) - bandNumber(a.band);
        if (sort === 'band-low') return bandNumber(a.band) - bandNumber(b.band);
        return b.createdAt - a.createdAt;
      });
  }, [items, search, sort, topicFilter, projectFilter, sourceFilter, statusFilter]);

  const addToList = async (id: string) => {
    await updateVocabItems(items.map(item => item.id === id ? { ...item, status: 'Studying' as const, updatedAt: Date.now() } : item));
  };

  const addStorageItemsToList = async (ids: Set<string>) => {
    await updateVocabItems(items.map(item => ids.has(item.id) ? { ...item, status: 'Studying' as const, updatedAt: Date.now() } : item));
  };

  const handleAddSelectedToList = async () => {
    if (selectedStorageItems.length === 0) {
      alert('Bạn cần tick ít nhất 1 từ đang ở Storage để Add to List.');
      return;
    }
    await addStorageItemsToList(new Set(selectedStorageItems.map(item => item.id)));
    setSelectedIds(new Set());
    alert(`Đã thêm ${selectedStorageItems.length} từ vào My Vocab List.`);
  };

  const handleAddAllStorageToList = async () => {
    if (storageItems.length === 0) return;
    await addStorageItemsToList(new Set(storageItems.map(item => item.id)));
    setSelectedIds(new Set());
    alert(`Đã thêm toàn bộ ${storageItems.length} từ trong Storage vào My Vocab List.`);
  };

  const toggleSelectAllFiltered = () => {
    const ids = filteredItems.map(item => item.id);
    const allSelected = ids.length > 0 && ids.every(id => selectedIds.has(id));
    setSelectedIds(previous => {
      const next = new Set(previous);
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Bạn có chắc muốn xoá ${selectedIds.size} từ vựng đã chọn?`)) return;
    await removeVocabItems(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const processAiText = async () => {
    if (!aiInputText.trim()) return;
    setIsProcessing(true);
    try {
      const data = aiModalMode === 'raw'
        ? await processRawText(aiInputText, settings.apiKey)
        : await extractVocabFromParagraph(aiInputText, settings.apiKey);

      if (!Array.isArray(data) || data.length === 0) {
        alert('Không tìm thấy từ vựng nào trong đoạn văn bản.');
        return;
      }

      const existingWords = new Set(items.map(item => normalizeWord(item.word)));
      const batchWords = new Set<string>();
      const skippedWords: string[] = [];
      const newVocabItems: VocabItem[] = [];

      data.forEach(item => {
        const word = item.word || item.correctedWord || '';
        const normalized = normalizeWord(word);
        if (!normalized) return;
        if (existingWords.has(normalized) || batchWords.has(normalized)) {
          skippedWords.push(word);
          return;
        }
        batchWords.add(normalized);
        newVocabItems.push({
          id: uuidv4(),
          word,
          status: 'Storage',
          masteryLevel: 'New',
          source: aiModalMode === 'raw' ? 'AI Processed' : 'AI Extracted',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          timesChecked: 0,
          ipa: item.ipa || '',
          meaning: item.meaning || '',
          definition: item.definition || '',
          example: item.example || '',
          synonyms: item.synonyms || '',
          antonyms: item.antonyms || '',
          topic: item.topic || '',
          wordType: item.wordType || '',
          band: normalizeBand(item.band),
        });
      });

      if (newVocabItems.length > 0) {
        await updateVocabItems([...items, ...newVocabItems]);
        setSelectedIds(new Set(newVocabItems.map(item => item.id)));
      }
      if (skippedWords.length > 0) alert(`Đã bỏ qua ${skippedWords.length} từ trùng.`);
      setAiModalMode('none');
      setAiInputText('');
    } catch (error: any) {
      console.error(error);
      alert(error?.message || 'Có lỗi xảy ra khi xử lý dữ liệu.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="text-3xl font-extrabold text-[#2D5A27]">Vocabulary Library</h2><p className="text-gray-500 font-medium mt-1">Kho lưu trữ từ vựng tổng</p></div>
        <div className="flex gap-3 flex-wrap justify-end">
          <button onClick={handleAddSelectedToList} disabled={selectedStorageItems.length === 0} className="flex items-center gap-2 px-4 py-2.5 bg-[#E8F5E9] border border-[#A5D6A7] font-bold rounded-xl text-[#2D5A27] disabled:opacity-40"><Plus size={18} /> Add selected ({selectedStorageItems.length})</button>
          <button onClick={handleAddAllStorageToList} disabled={storageItems.length === 0} className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 font-bold rounded-xl text-green-700 disabled:opacity-40"><Plus size={18} /> Add all Storage ({storageItems.length})</button>
          {selectedIds.size > 0 && <button onClick={handleDeleteSelected} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 font-bold rounded-xl text-red-600"><Trash2 size={18} /> Xoá ({selectedIds.size})</button>}
          <button onClick={() => setAiModalMode('raw')} className="flex items-center gap-2 px-4 py-2.5 bg-white border-thin font-bold rounded-xl text-purple-700"><Sparkles size={18} /> Xử lí dữ liệu thô</button>
          <button onClick={() => setAiModalMode('paragraph')} className="flex items-center gap-2 px-4 py-2.5 bg-white border-thin font-bold rounded-xl text-blue-700"><BookOpen size={18} /> Lọc từ đoạn văn</button>
          <button onClick={() => setCurrentView('vocab-list')} className="flex items-center gap-2 px-4 py-2.5 bg-[#A5D6A7] text-[#2D5A27] font-bold rounded-xl border-thin"><Plus size={18} /> Add Word</button>
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
        project={projectFilter}
        onProjectChange={setProjectFilter}
        projects={readingProjects.map(project => ({ id: project.id, name: project.name }))}
        source={sourceFilter}
        onSourceChange={setSourceFilter}
        sources={sources}
        status={statusFilter}
        onStatusChange={setStatusFilter}
      />

      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl px-5 py-4 text-sm font-bold text-[#2D5A27]">
        Hiển thị {filteredItems.length}/{items.length} từ · Storage {storageItems.length} · Selected {selectedIds.size}.
      </div>

      <div className="bg-white rounded-[2.5rem] card-shadow border-thin overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left border-collapse">
            <thead><tr className="bg-gray-50/50 border-b border-thin">
              <th className="p-5 w-12 text-center"><input type="checkbox" checked={filteredItems.length > 0 && filteredItems.every(item => selectedIds.has(item.id))} onChange={toggleSelectAllFiltered} /></th>
              <th className="p-5 font-bold text-gray-500">Status</th><th className="p-5 font-bold text-gray-500">Word</th><th className="p-5 font-bold text-gray-500">Meaning</th><th className="p-5 font-bold text-gray-500">Source</th><th className="p-5 font-bold text-gray-500">Project</th><th className="p-5 font-bold text-gray-500">Band</th><th className="p-5 text-right font-bold text-gray-500">Action</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-gray-50/50">
                  <td className="p-5 text-center"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} /></td>
                  <td className="p-5"><span className={`px-3 py-1 rounded-full text-xs font-bold ${item.status === 'Storage' ? 'bg-gray-100 text-gray-600' : item.status === 'Studying' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>{item.status}</span></td>
                  <td className="p-5 font-bold text-gray-800">{item.word}</td>
                  <td className="p-5 text-gray-600 font-medium">{item.meaning}</td>
                  <td className="p-5 text-gray-500 font-medium">{item.source || '-'}</td>
                  <td className="p-5 text-xs font-bold text-purple-600">{item.projectIds?.length ? item.projectIds.map(id => readingProjects.find(project => project.id === id)?.name).filter(Boolean).join(', ') : '-'}</td>
                  <td className="p-5"><span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 font-bold text-sm">{formatBand(item.band)}</span></td>
                  <td className="p-5 text-right">{item.status === 'Storage' ? <button onClick={() => addToList(item.id)} className="text-sm font-bold text-[#2D5A27] bg-[#E8F5E9] px-4 py-2 rounded-xl border-thin">Add to List</button> : <button onClick={() => setCurrentView(item.status === 'Completed' ? 'practice' : 'vocab-list')} className="text-sm font-bold text-gray-500 bg-gray-100 px-4 py-2 rounded-xl border-thin">{item.status === 'Completed' ? 'Review' : 'View'}</button>}</td>
                </tr>
              ))}
              {filteredItems.length === 0 && <tr><td colSpan={8} className="p-12 text-center text-gray-400 font-bold">Không có vocab phù hợp với bộ lọc.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {aiModalMode !== 'none' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden card-shadow">
            <div className="flex items-center justify-between p-6 border-b border-thin bg-gray-50/50"><h3 className="text-xl font-extrabold text-gray-800 flex items-center gap-2"><Sparkles className="text-pink-500" />{aiModalMode === 'raw' ? 'Xử lí dữ liệu thô bằng AI' : 'Lọc từ vựng từ đoạn văn bằng AI'}</h3><button onClick={() => setAiModalMode('none')} className="text-gray-400"><X size={24} /></button></div>
            <div className="p-6"><textarea value={aiInputText} onChange={event => setAiInputText(event.target.value)} placeholder="Nhập nội dung vào đây..." className="w-full h-56 p-4 border-2 border-gray-200 rounded-2xl focus:border-pink-500 outline-none resize-none font-medium" /></div>
            <div className="p-6 bg-gray-50/50 border-t border-thin flex justify-end gap-3"><button onClick={() => setAiModalMode('none')} className="px-5 py-3 font-bold text-gray-600 bg-white border-thin rounded-xl">Huỷ</button><button onClick={processAiText} disabled={!aiInputText.trim() || isProcessing} className="flex items-center gap-2 px-6 py-3 font-bold text-white bg-[#2D5A27] rounded-xl disabled:opacity-50">{isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}{isProcessing ? 'Đang xử lí...' : 'Xử lí ngay'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
