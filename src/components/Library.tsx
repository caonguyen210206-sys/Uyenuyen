import React, { useState } from 'react';
import { Plus, Trash2, Sparkles, BookOpen, X, Loader2 } from 'lucide-react';
import { ViewState, VocabItem } from '../types';
import { useVocab } from '../context/VocabContext';
import { v4 as uuidv4 } from 'uuid';
import { extractVocabFromParagraph, processRawText } from '../lib/gemini';

interface LibraryProps {
  setCurrentView: (v: ViewState) => void;
}

export default function Library({ setCurrentView }: LibraryProps) {
  const { items, updateVocabItems, removeVocabItems, settings } = useVocab();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [aiModalMode, setAiModalMode] = useState<'none' | 'raw' | 'paragraph'>('none');
  const [aiInputText, setAiInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const addToList = async (id: string) => {
    const newItems = items.map(item => 
      item.id === id ? { ...item, status: 'Studying' as const } : item
    );
    await updateVocabItems(newItems);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length && items.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Bạn có chắc muốn xoá ${selectedIds.size} từ vựng đã chọn?`)) return;

    const idsToDelete = Array.from(selectedIds);
    await removeVocabItems(idsToDelete);
    setSelectedIds(new Set());
  };

  const processAiText = async () => {
    if (!aiInputText.trim()) return;
    setIsProcessing(true);
    
    try {
      const data = aiModalMode === 'raw'
        ? await processRawText(aiInputText, settings.apiKey)
        : await extractVocabFromParagraph(aiInputText, settings.apiKey);
      
      if (Array.isArray(data) && data.length > 0) {
        const newVocabItems: VocabItem[] = data.map(item => ({
          ...item,
          word: item.word || item.correctedWord || '',
          id: uuidv4(),
          status: 'Storage',
          masteryLevel: 'New',
          source: aiModalMode === 'raw' ? 'AI Processed' : 'AI Extracted',
          createdAt: Date.now(),
          timesChecked: 0,
          ipa: item.ipa || '',
          meaning: item.meaning || '',
          definition: item.definition || '',
          example: item.example || '',
          synonyms: item.synonyms || '',
          antonyms: item.antonyms || '',
          topic: item.topic || '',
          wordType: item.wordType || '',
          band: item.band || '',
          ownerId: '',
        }));
        
        const updatedItems = [...items, ...newVocabItems];
        await updateVocabItems(updatedItems);
        
        setAiModalMode('none');
        setAiInputText('');
        setCurrentView('vocab-list');
      } else {
        alert('Không tìm thấy từ vựng nào trong đoạn văn bản.');
        setAiModalMode('none');
        setAiInputText('');
      }
    } catch (error: any) {
      console.error(error);
      alert(error?.message || 'Có lỗi xảy ra khi xử lý dữ liệu.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-[#2D5A27]">Vocabulary Library</h2>
          <p className="text-gray-500 font-medium mt-1">Kho lưu trữ từ vựng tổng</p>
        </div>
        <div className="flex gap-3">
          {selectedIds.size > 0 && (
            <button 
              onClick={handleDeleteSelected}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-50 border-red-200 border-thin font-bold rounded-xl shadow-sm hover:bg-red-100 text-red-600 transition-colors"
            >
              <Trash2 size={18} />
              Xoá ({selectedIds.size})
            </button>
          )}
          <button 
            onClick={() => setAiModalMode('raw')}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border-thin font-bold rounded-xl shadow-sm hover:bg-purple-50 text-purple-700 transition-colors"
          >
            <Sparkles size={18} />
            Xử lí dữ liệu thô
          </button>
          <button 
            onClick={() => setAiModalMode('paragraph')}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border-thin font-bold rounded-xl shadow-sm hover:bg-blue-50 text-blue-700 transition-colors"
          >
            <BookOpen size={18} />
            Lọc từ đoạn văn
          </button>
          <button 
            onClick={() => setCurrentView('vocab-list')}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#A5D6A7] hover:bg-[#81C784] text-[#2D5A27] font-bold rounded-xl border-thin shadow-sm transition-colors"
          >
            <Plus size={18} />
            Add Word
          </button>
        </div>
      </header>

      <div className="bg-white rounded-[2.5rem] card-shadow border-thin overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-thin">
                <th className="p-5 font-bold text-gray-500 w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.size === items.length && items.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-[#2D5A27] focus:ring-[#2D5A27]"
                  />
                </th>
                <th className="p-5 font-bold text-gray-500 w-32">Status</th>
                <th className="p-5 font-bold text-gray-500">Word</th>
                <th className="p-5 font-bold text-gray-500">Meaning</th>
                <th className="p-5 font-bold text-gray-500">Source</th>
                <th className="p-5 font-bold text-gray-500">Band</th>
                <th className="p-5 font-bold text-gray-500 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-5 text-center">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="w-4 h-4 rounded border-gray-300 text-[#2D5A27] focus:ring-[#2D5A27]"
                    />
                  </td>
                  <td className="p-5">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      item.status === 'Storage' ? 'bg-gray-100 text-gray-600' :
                      item.status === 'Studying' ? 'bg-orange-100 text-orange-600' :
                      'bg-green-100 text-green-600'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="p-5 font-bold text-gray-800">{item.word}</td>
                  <td className="p-5 text-gray-600 font-medium">{item.meaning}</td>
                  <td className="p-5 text-gray-500 font-medium">{item.source || '-'}</td>
                  <td className="p-5">
                    <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 font-bold text-sm">
                      {item.band || '-'}
                    </span>
                  </td>
                  <td className="p-5 text-right">
                    {item.status === 'Storage' ? (
                      <button 
                        onClick={() => addToList(item.id)}
                        className="text-sm font-bold text-[#2D5A27] hover:text-[#1B3617] bg-[#E8F5E9] px-4 py-2 rounded-xl transition-colors border-thin"
                      >
                        Add to List
                      </button>
                    ) : item.status === 'Studying' ? (
                      <button 
                        onClick={() => setCurrentView('vocab-list')}
                        className="text-sm font-bold text-gray-500 hover:text-gray-800 bg-gray-100 px-4 py-2 rounded-xl transition-colors border-thin"
                      >
                        View
                      </button>
                    ) : (
                      <button 
                        onClick={() => setCurrentView('practice')}
                        className="text-sm font-bold text-[#795548] hover:text-[#5D4037] bg-[#FFECB3] px-4 py-2 rounded-xl transition-colors border-thin"
                      >
                        Review
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-400 font-medium">
                    Library is empty. Add some words to get started!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Processing Modal */}
      {aiModalMode !== 'none' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden card-shadow animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between p-6 border-b border-thin bg-gray-50/50">
              <h3 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                <Sparkles className="text-pink-500" />
                {aiModalMode === 'raw' ? 'Xử lí dữ liệu thô bằng AI' : 'Lọc từ vựng từ đoạn văn bằng AI'}
              </h3>
              <button 
                onClick={() => setAiModalMode('none')}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-gray-600 font-medium mb-4">
                {aiModalMode === 'raw' 
                  ? 'Dán các từ vựng chưa định dạng (ví dụ: word - meaning) vào đây. AI sẽ tự động trích xuất và phân tích.'
                  : 'Dán một đoạn văn tiếng Anh vào đây. AI sẽ lọc ra các từ vựng hay và quan trọng nhất cho bạn.'}
              </p>
              <textarea
                value={aiInputText}
                onChange={(e) => setAiInputText(e.target.value)}
                placeholder="Nhập nội dung vào đây..."
                className="w-full h-48 p-4 border-2 border-gray-200 rounded-2xl focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 outline-none transition-all resize-none font-medium text-gray-700"
              />
            </div>
            
            <div className="p-6 bg-gray-50/50 border-t border-thin flex justify-end gap-3">
              <button
                onClick={() => setAiModalMode('none')}
                className="px-6 py-3 font-bold text-gray-600 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                disabled={isProcessing}
              >
                Huỷ
              </button>
              <button
                onClick={processAiText}
                disabled={!aiInputText.trim() || isProcessing}
                className="flex items-center gap-2 px-6 py-3 font-bold text-white bg-[#2D5A27] rounded-xl hover:bg-[#1B3617] disabled:opacity-50 transition-colors shadow-sm"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Đang xử lí...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Xử lí ngay
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}