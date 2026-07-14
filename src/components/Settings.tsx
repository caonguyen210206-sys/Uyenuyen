import { useState, useEffect } from 'react';
import { Save, Download, Upload, CheckCircle2, AlertCircle, LogOut } from 'lucide-react';
import { useVocab } from '../context/VocabContext';
import { UserSettings } from '../types';
import { auth, signOut } from '../lib/firebase';
import { testGeminiConnection } from '../lib/gemini';

export default function Settings() {
  const { settings: globalSettings, updateSettings } = useVocab();
  const [settings, setLocalSettings] = useState<UserSettings>({
    apiKey: '',
    defaultQuestions: 10,
    defaultCriteria: ['Meaning', 'Word Type', 'Synonyms']
  });
  const [isSaved, setIsSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  useEffect(() => {
    setLocalSettings(globalSettings);
  }, [globalSettings]);

  const handleSave = async () => {
    await updateSettings(settings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestError('');
    try {
      await testGeminiConnection(settings.apiKey);
      setTestStatus('success');
    } catch (e: any) {
      console.error(e);
      setTestError(e?.message || 'Không kết nối được Gemini. Hãy kiểm tra lại API key.');
      setTestStatus('error');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out failed", error);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-3xl">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-extrabold text-[#2D5A27]">Settings</h2>
          <p className="text-gray-500 font-medium mt-1">Configure your app preferences and data.</p>
        </div>
        <button 
          onClick={handleSignOut}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl border border-red-200 transition-colors"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </header>

      <div className="bg-white rounded-[2.5rem] card-shadow border-thin p-8 space-y-8">
        
        {/* API Settings */}
        <div>
          <h3 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">API Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">Gemini API Key</label>
              <div className="flex gap-4">
                <input 
                  type="password" 
                  value={settings.apiKey}
                  onChange={e => {
                    setLocalSettings({...settings, apiKey: e.target.value});
                    setTestStatus('idle');
                    setTestError('');
                  }}
                  placeholder="Dán Gemini API key của bạn"
                  className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono focus:outline-none focus:border-[#4ADE80] focus:ring-2 focus:ring-[#4ADE80]/20"
                />
                <button 
                  onClick={handleTestConnection}
                  disabled={testStatus === 'testing' || !settings.apiKey.trim()}
                  className="px-6 py-3 bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                API key chỉ lưu trong trình duyệt hiện tại của bạn, không lưu lên Firestore. Nếu đổi máy, đổi trình duyệt hoặc xoá dữ liệu web, bạn cần nhập lại key.
              </p>
              <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mt-2 font-semibold leading-relaxed">
                Free tier mode đang bật mặc định: app chỉ dùng model nhẹ, hạn chế retry, Auto Define chỉ định nghĩa từ, Mini Quiz/Import ảnh là thao tác riêng để tránh hao quota. Khi hết quota, hãy nhập tay hoặc đợi reset thay vì bấm lại liên tục.
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mt-2 font-semibold">
                Không chia sẻ API key công khai. Nếu key đã lộ, hãy xoá key cũ trong AI Studio rồi tạo key mới.
              </p>
              {testStatus === 'success' && <p className="text-sm font-bold text-green-500 flex items-center gap-1 mt-2"><CheckCircle2 size={16}/> Connection successful!</p>}
              {testStatus === 'error' && <p className="text-sm font-bold text-red-500 flex items-start gap-1 mt-2"><AlertCircle size={16} className="mt-0.5 shrink-0"/> <span>{testError || 'Connection failed. Please check your key.'}</span></p>}
            </div>
          </div>
        </div>

        {/* Learning Settings */}
        <div>
          <h3 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Learning Settings</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">Default Number of Questions</label>
              <select 
                value={settings.defaultQuestions}
                onChange={e => setLocalSettings({...settings, defaultQuestions: Number(e.target.value)})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:outline-none focus:border-[#4ADE80]"
              >
                <option value={10}>10 Questions</option>
                <option value={20}>20 Questions</option>
                <option value={50}>50 Questions</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">Checking Mode</label>
              <select className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:outline-none focus:border-[#4ADE80]">
                <option value="flexible">Flexible (Case-insensitive)</option>
                <option value="strict">Strict (Exact match)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Settings */}
        <div>
          <h3 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Data Management</h3>
          <div className="flex gap-4">
            <button className="flex items-center gap-2 px-5 py-3 bg-gray-50 border border-gray-200 font-bold rounded-xl hover:bg-gray-100 transition-colors text-gray-700">
              <Download size={18} /> Export CSV
            </button>
            <button className="flex items-center gap-2 px-5 py-3 bg-gray-50 border border-gray-200 font-bold rounded-xl hover:bg-gray-100 transition-colors text-gray-700">
              <Upload size={18} /> Import CSV
            </button>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-100 flex justify-end">
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 px-8 py-3 bg-[#A5D6A7] text-[#2D5A27] font-bold rounded-xl border-thin shadow-sm hover:bg-[#81C784] transition-colors"
          >
            {isSaved ? <CheckCircle2 size={20} /> : <Save size={20} />}
            {isSaved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
