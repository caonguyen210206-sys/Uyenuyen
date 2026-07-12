import { useState } from 'react';
import { Plus, Wand2, Filter, Volume2, Save, X } from 'lucide-react';
import { VocabItem } from '../types';
import { useVocab } from '../context/VocabContext';
import { v4 as uuidv4 } from 'uuid';
import { defineWord } from '../lib/gemini';

export default function VocabList() {
  const { items, addVocabItem, updateVocabItems, settings } = useVocab();
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [isDefining, setIsDefining] = useState(false);
  const [formData, setFormData] = useState<Partial<VocabItem>>({});
  const [filter, setFilter] = useState<'All' | 'Studying' | 'Completed'>('All');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const activeItems = items.filter(i => i.status !== 'Storage');

  const handleAutoDefine = async () => {
    if (!newWord.trim()) return;
    setIsDefining(true);
    try {
      const data = await defineWord(newWord, settings.apiKey);
      
      if (data.correctedWord && data.correctedWord.toLowerCase() !== newWord.toLowerCase()) {
        setNewWord(data.correctedWord);
      }
      
      setFormData({
        ...formData,
        ...data,
      });
    } catch (err: any) {
      console.error("Error auto defining:", err);
      alert(err?.message || 'Auto Define chưa thành công. Hãy kiểm tra Gemini API Key trong Settings.');
    } finally {
      setIsDefining(false);
    }
  };

  const handleSave = async () => {
    if (!newWord.trim() || !formData.meaning) return;
    const newItem: VocabItem = {
      id: uuidv4(),
      word: newWord,
      ipa: formData.ipa || '',
      wordType: formData.wordType || '',
      meaning: formData.meaning,
      definition: formData.definition || '',
      example: formData.example || '',
      synonyms: formData.synonyms || '',
      antonyms: formData.antonyms || '',
      band: formData.band || '',
      topic: formData.topic || '',
      status: 'Studying',
      masteryLevel: 'New',
      source: 'Manual',
      createdAt: Date.now(),
      timesChecked: 0,
      ownerId: ''
    };
    
    await addVocabItem(newItem);
    setShowAddModal(false);
    setNewWord('');
    setFormData({});
  };

  const markLearned = async (id: string) => {
    const updated = items.map(i => i.id === id ? { ...i, status: 'Completed' as const, masteryLevel: 'Mastery' as const } : i);
    await updateVocabItems(updated);
  }

  const filterOptions = [
    'All', 'Studying', 'Completed',
    'Mastery: New', 'Mastery: Mastery',
    'Band: N/A', 'Band: 6', 'Band: 6.5', 'Band: 7', 'Band: 7.5'
  ];

  const filteredItems = activeItems.filter(i => {
    if (filter === 'All') return true;
    if (filter === 'Studying' || filter === 'Completed') return i.status === filter;
    if (filter === 'Mastery: New') return i.masteryLevel === 'New' || !i.masteryLevel;
    if (filter === 'Mastery: Mastery') return i.masteryLevel === 'Mastery';
    if (filter.startsWith('Band: ')) {
      const targetBand = filter.replace('Band: ', '').trim();
      const itemBand = (i.band || 'N/A').replace('Band', '').trim();
      if (targetBand === 'N/A') return itemBand === 'N/A' || itemBand === '';
      return itemBand === targetBand;
    }
    return true;
  });

  const playAudio = (text: string) => {
    if ('speechSynthesis' in window) {
      const msg = new SpeechSynthesisUtterance(text);
      msg.lang = 'en-US';
      window.speechSynthesis.speak(msg);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-[#2D5A27]">My Vocab List</h2>
          <p className="text-gray-500 font-medium mt-1">Danh sách từ đang học</p>
        </div>
        <div className="flex gap-3">
          <div className="flex bg-white p-1 rounded-xl border-thin mr-2 shadow-sm">
            <button 
              onClick={() => setViewMode('table')}
              className={`px-4 py-1.5 rounded-lg font-bold text-sm transition-colors ${viewMode === 'table' ? 'bg-[#E8F5E9] text-[#2D5A27]' : 'text-gray-500 hover:text-gray-800'}`}
            >
              Table
            </button>
            <button 
              onClick={() => setViewMode('card')}
              className={`px-4 py-1.5 rounded-lg font-bold text-sm transition-colors ${viewMode === 'card' ? 'bg-[#E8F5E9] text-[#2D5A27]' : 'text-gray-500 hover:text-gray-800'}`}
            >
              Card
            </button>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className={`flex items-center gap-2 px-5 py-2.5 border-thin font-bold rounded-xl shadow-sm transition-colors ${filter !== 'All' ? 'bg-[#E8F5E9] text-[#2D5A27]' : 'bg-white hover:bg-gray-50 text-gray-700'}`}
            >
              <Filter size={18} />
              {filter === 'All' ? 'Filter' : filter}
            </button>
            {showFilterDropdown && (
              <div className="absolute top-full mt-2 right-0 bg-white rounded-xl card-shadow border-thin overflow-hidden z-20 w-48 max-h-64 overflow-y-auto">
                {filterOptions.map(opt => (
                  <button 
                    key={opt}
                    onClick={() => { setFilter(opt); setShowFilterDropdown(false); }}
                    className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors ${filter === opt ? 'bg-gray-100 text-[#2D5A27]' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    {opt === 'All' ? 'All Words' : opt}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-[#A5D6A7] hover:bg-[#81C784] text-[#2D5A27] font-bold rounded-xl border-thin shadow-sm transition-colors">
            <Plus size={18} />
            Add Word
          </button>
        </div>
      </header>

      {viewMode === 'table' ? (
        <div className="bg-white rounded-[2.5rem] card-shadow border-thin overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-thin">
                <th className="p-4 w-12 text-center text-gray-400">🔊</th>
                <th className="p-4 font-bold text-gray-500">Word</th>
                <th className="p-4 font-bold text-gray-500">Type</th>
                <th className="p-4 font-bold text-gray-500">Meaning</th>
                <th className="p-4 font-bold text-gray-500">Definition</th>
                <th className="p-4 font-bold text-gray-500">Band</th>
                <th className="p-4 font-bold text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-gray-50/50">
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => playAudio(item.word)}
                      className="text-gray-400 hover:text-[#4ADE80] transition-colors"
                    >
                      <Volume2 size={16} />
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-gray-800">{item.word}</div>
                    <div className="text-xs text-gray-400 font-mono mt-1">{item.ipa}</div>
                  </td>
                  <td className="p-4 text-sm font-bold text-gray-500 italic">{item.wordType}</td>
                  <td className="p-4 font-semibold text-gray-700">{item.meaning}</td>
                  <td className="p-4 text-sm text-gray-500 max-w-xs truncate">{item.definition}</td>
                  <td className="p-4"><span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 font-bold text-xs">{item.band || '-'}</span></td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      item.status === 'Completed' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {filteredItems.map(item => (
            <div key={item.id} className="bg-white p-6 rounded-[2.5rem] card-shadow border-thin hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-2xl font-black text-[#2D5A27]">{item.word}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-gray-400 font-mono text-sm">{item.ipa}</span>
                    <span className="text-gray-400 text-sm italic font-bold">{item.wordType}</span>
                  </div>
                </div>
                <button 
                  onClick={() => playAudio(item.word)}
                  className="p-2 bg-gray-50 text-gray-400 rounded-full hover:bg-[#E8F5E9] hover:text-[#2D5A27] transition-colors border-thin"
                >
                  <Volume2 size={18} />
                </button>
              </div>
              
              <div className="space-y-2 mb-6">
                <p><span className="font-bold text-gray-600 w-24 inline-block">Meaning:</span> <span className="font-semibold text-gray-800">{item.meaning}</span></p>
                <p><span className="font-bold text-gray-600 w-24 inline-block">Definition:</span> <span className="text-gray-700">{item.definition}</span></p>
                <p><span className="font-bold text-gray-600 w-24 inline-block">Example:</span> <span className="text-gray-700 italic">"{item.example}"</span></p>
                <div className="flex gap-4 pt-2">
                  <p className="text-sm"><span className="font-bold text-gray-500">Syn:</span> <span className="text-gray-600">{item.synonyms || '-'}</span></p>
                  <p className="text-sm"><span className="font-bold text-gray-500">Ant:</span> <span className="text-gray-600">{item.antonyms || '-'}</span></p>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-thin">
                {item.status !== 'Completed' && (
                  <button onClick={() => markLearned(item.id)} className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 border-thin text-gray-600 font-bold rounded-xl transition-colors">
                    Mark as Learned
                  </button>
                )}
                <button className="flex-1 py-2 bg-[#E8F5E9] border-thin text-[#2D5A27] font-bold rounded-xl transition-colors hover:bg-[#D0E8D0]">
                  Practice
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] p-8 w-[600px] shadow-2xl max-h-[90vh] overflow-y-auto border-thin">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-extrabold text-gray-800">Add New Word</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"><X size={20} /></button>
            </div>
            
            <div className="flex gap-3 mb-6">
              <input 
                type="text" 
                placeholder="Enter a word..." 
                value={newWord}
                onChange={e => setNewWord(e.target.value)}
                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:border-[#4ADE80] focus:ring-2 focus:ring-[#4ADE80]/20 font-bold text-lg"
              />
              <button 
                onClick={handleAutoDefine}
                disabled={isDefining || !newWord}
                className="px-6 py-3 bg-[#BFDBFE] text-[#1E3A8A] font-bold rounded-2xl flex items-center gap-2 hover:bg-[#93C5FD] transition-colors disabled:opacity-50"
              >
                <Wand2 size={18} />
                {isDefining ? 'Defining...' : 'Auto Define'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">IPA</label>
                <input value={formData.ipa || ''} onChange={e => setFormData({...formData, ipa: e.target.value})} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Type</label>
                <input value={formData.wordType || ''} onChange={e => setFormData({...formData, wordType: e.target.value})} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-bold text-gray-500 mb-1">Meaning (VN)</label>
                <input value={formData.meaning || ''} onChange={e => setFormData({...formData, meaning: e.target.value})} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl font-semibold" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-bold text-gray-500 mb-1">Definition (EN)</label>
                <textarea value={formData.definition || ''} onChange={e => setFormData({...formData, definition: e.target.value})} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm" rows={2} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-bold text-gray-500 mb-1">Example</label>
                <textarea value={formData.example || ''} onChange={e => setFormData({...formData, example: e.target.value})} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm italic" rows={2} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Synonyms</label>
                <input value={formData.synonyms || ''} onChange={e => setFormData({...formData, synonyms: e.target.value})} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Antonyms</label>
                <input value={formData.antonyms || ''} onChange={e => setFormData({...formData, antonyms: e.target.value})} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl" />
              </div>
            </div>

            <button 
              onClick={handleSave}
              className="w-full py-4 bg-[#A5D6A7] text-[#2D5A27] font-bold rounded-2xl border-thin flex items-center justify-center gap-2 hover:bg-[#81C784] transition-colors text-lg"
            >
              <Save size={20} />
              Save Word
            </button>
          </div>
        </div>
      )}
    </div>
  );
}