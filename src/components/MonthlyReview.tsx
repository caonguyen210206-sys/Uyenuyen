import { useState, useMemo } from 'react';
import { Save, CheckCircle, Play, Calendar, RotateCcw, Clock } from 'lucide-react';
import { useVocab } from '../context/VocabContext';
import { VocabItem, QuizSession } from '../types';
import { v4 as uuidv4 } from 'uuid';

type MonthlyAnswer = {
  id: string;
  vocabItemId: string;
  answer1: string;
  answer2: string;
  notes: string;
  isCorrect1?: boolean;
  isCorrect2?: boolean;
};

export default function MonthlyReview() {
  const { items: allItems, sessions, updateVocabItems, addQuizSession } = useVocab();
  
  const [reviewState, setReviewState] = useState<'setup' | 'testing' | 'submitted'>('setup');
  const [selectedMonth, setSelectedMonth] = useState<string>('current');
  
  const [testItems, setTestItems] = useState<VocabItem[]>([]);
  const [answers, setAnswers] = useState<MonthlyAnswer[]>([]);
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Calculate months available based on items
  const monthOptions = useMemo(() => {
    const options = [{ value: 'current', label: 'Tháng này' }, { value: 'last', label: 'Tháng trước' }, { value: 'all', label: 'Tất cả' }];
    return options;
  }, []);

  const monthlySessions = sessions.filter(s => s.criteria.includes('Monthly Review')).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)).slice(0, 5);

  const startReview = () => {
    setErrorMsg(null);
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    let filteredItems = allItems.filter(i => i.status !== 'Storage');
    
    if (selectedMonth === 'current') {
      filteredItems = filteredItems.filter(i => {
        const d = new Date(i.createdAt);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
    } else if (selectedMonth === 'last') {
      const lastMonthDate = new Date(now.setMonth(now.getMonth() - 1));
      filteredItems = filteredItems.filter(i => {
        const d = new Date(i.createdAt);
        return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear();
      });
    }
    
    // Shuffle and pick up to 20 for review to keep it manageable
    const shuffled = [...filteredItems].sort(() => 0.5 - Math.random()).slice(0, 20);
    
    if (shuffled.length === 0) {
      setErrorMsg("Không có từ vựng nào đang học trong thời gian này. Hãy thêm từ vựng mới hoặc chuyển từ kho lưu trữ.");
      return;
    }

    setTestItems(shuffled);
    setAnswers(shuffled.map(item => ({
      id: item.id,
      vocabItemId: item.id,
      answer1: '',
      answer2: '',
      notes: ''
    })));
    setReviewState('testing');
  };

  const updateAnswer = (id: string, field: keyof MonthlyAnswer, value: string) => {
    setAnswers(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const submitReview = () => {
    setAnswers(prev => prev.map(a => {
      const item = testItems.find(i => i.id === a.vocabItemId);
      if (!item) return a;
      return {
        ...a,
        isCorrect1: a.answer1.trim().toLowerCase() === item.word.toLowerCase(),
        isCorrect2: a.answer2.trim().toLowerCase() === item.wordType.toLowerCase()
      };
    }));
    setReviewState('submitted');
  };

  const saveReview = async () => {
    let totalScore = 0;
    
    const updated = allItems.map(item => {
      const ans = answers.find(a => a.vocabItemId === item.id);
      if (ans && reviewState === 'submitted') {
        const score = (ans.isCorrect1 ? 50 : 0) + (ans.isCorrect2 ? 50 : 0);
        totalScore += score;
        return {
          ...item,
          lastScore: score,
          status: score === 100 ? 'Completed' : 'Studying' as any,
          timesChecked: (item.timesChecked || 0) + 1
        };
      }
      return item;
    });

    const averageScore = testItems.length > 0 ? Math.round(totalScore / testItems.length) : 0;

    const newSession: QuizSession = {
      id: uuidv4(),
      mode: 'Foreign',
      questionCount: testItems.length,
      criteria: ['Monthly Review'],
      score: averageScore,
      savedAt: Date.now()
    };

    await updateVocabItems(updated);
    await addQuizSession(newSession);
    
    setReviewState('setup');
  };

  if (reviewState === 'setup') {
    return (
      <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-500">
        <header className="mb-6 shrink-0">
          <h2 className="text-3xl font-extrabold text-[#2D5A27]">Ôn tập định kì</h2>
          <p className="text-gray-500 font-medium mt-1">Kiểm tra lại từ vựng hàng tháng</p>
        </header>

        <div className="flex gap-6 overflow-hidden h-full">
          {/* Setup Panel */}
          <div className="w-1/2 bg-white p-10 rounded-[2.5rem] card-shadow border-thin flex flex-col justify-center text-center">
            <div className="w-20 h-20 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar size={40} />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-800 mb-2">Bắt đầu bài kiểm tra</h2>
            <p className="text-gray-500 font-medium mb-8">
              Giúp bạn ghi nhớ từ vựng đã học lâu hơn.
            </p>
            
            <div className="space-y-4 text-left max-w-sm mx-auto w-full">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Chọn thời gian</label>
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-200 px-4 py-3 rounded-xl font-bold text-gray-700 focus:outline-none focus:border-blue-400"
                >
                  {monthOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              
              <button 
                onClick={startReview}
                className="w-full flex items-center justify-center gap-2 py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl shadow-sm transition-colors mt-6"
              >
                <Play size={20} />
                Bắt đầu ôn tập
              </button>
              
              {errorMsg && (
                <div className="mt-4 p-3 bg-red-50 text-red-600 font-medium text-sm rounded-xl border border-red-100 text-center">
                  {errorMsg}
                </div>
              )}
            </div>
          </div>

          {/* History Panel */}
          <div className="w-1/2 bg-white rounded-[2.5rem] card-shadow border-thin flex flex-col overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
              <Clock className="text-blue-500" />
              <h3 className="text-lg font-bold text-gray-800">Lịch sử ôn tập gần đây</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {monthlySessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center">
                  <div className="bg-gray-50 p-4 rounded-full mb-3">
                    <Clock size={32} className="opacity-50" />
                  </div>
                  <p className="font-medium">Chưa có lịch sử ôn tập.</p>
                  <p className="text-sm mt-1">Hoàn thành bài kiểm tra để lưu kết quả nhé!</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {monthlySessions.map(session => (
                    <div key={session.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between rounded-xl">
                      <div>
                        <div className="font-bold text-gray-700">
                          Bài kiểm tra tháng ({session.questionCount} từ)
                        </div>
                        <div className="text-sm font-medium text-gray-400 mt-1">
                          {new Date(session.savedAt || 0).toLocaleString('vi-VN')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-extrabold text-lg ${session.score >= 80 ? 'text-green-500' : session.score >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                          {session.score}%
                        </div>
                        <div className="text-xs font-bold text-gray-400">Điểm số</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-extrabold text-[#2D5A27]">Monthly Vocab Review</h2>
          <p className="text-gray-500 font-medium mt-1">Đang ôn tập: {monthOptions.find(o => o.value === selectedMonth)?.label}</p>
        </div>
        <div className="flex gap-3">
          {reviewState === 'submitted' ? (
            <button onClick={saveReview} className="flex items-center gap-2 px-5 py-2.5 bg-[#FFECB3] hover:bg-[#FFE082] text-[#795548] font-bold rounded-xl border-thin shadow-sm transition-colors">
              <Save size={18} />
              Lưu kết quả & Thoát
            </button>
          ) : (
            <button onClick={submitReview} className="flex items-center gap-2 px-5 py-2.5 bg-[#A5D6A7] hover:bg-[#81C784] text-[#2D5A27] font-bold rounded-xl border-thin shadow-sm transition-colors">
              <CheckCircle size={18} />
              Nộp bài
            </button>
          )}
          <button 
            onClick={() => setReviewState('setup')}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-gray-600 font-bold rounded-xl border-thin hover:bg-gray-50 transition-colors"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </header>

      <div className="flex-1 bg-white rounded-[2.5rem] card-shadow border-thin overflow-hidden flex flex-col mt-4">
        <div className="p-4 border-b border-thin bg-gray-50/50 flex justify-between items-center">
          <div className="flex gap-4">
            <span className="font-bold text-gray-600 px-3 py-1 bg-gray-200/50 rounded-lg text-sm">Cột 1: Ghi từ tiếng Anh</span>
            <span className="font-bold text-gray-600 px-3 py-1 bg-gray-200/50 rounded-lg text-sm">Cột 2: Ghi loại từ (n, v, adj...)</span>
          </div>
          <div className="font-bold text-gray-500">
            Tổng cộng: {testItems.length} từ
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-sm">
                <th className="p-4 w-12 text-center text-gray-400">#</th>
                <th className="p-4 font-bold text-gray-500 w-1/4">Nghĩa tiếng Việt</th>
                <th className="p-4 font-bold text-gray-500">Từ tiếng Anh</th>
                <th className="p-4 font-bold text-gray-500">Loại từ</th>
                <th className="p-4 font-bold text-gray-500">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {testItems.map((item, idx) => {
                const ans = answers.find(a => a.vocabItemId === item.id);
                if (!ans) return null;
                return (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="p-4 text-center font-bold text-gray-400">{idx + 1}</td>
                    <td className="p-4 font-bold text-gray-800">{item.meaning}</td>
                    <td className="p-4">
                      <input 
                        type="text" 
                        value={ans.answer1}
                        onChange={(e) => updateAnswer(item.id, 'answer1', e.target.value)}
                        disabled={reviewState === 'submitted'}
                        placeholder="Nhập từ..."
                        className={`w-full px-3 py-2 bg-gray-50 border rounded-xl font-medium focus:outline-none ${reviewState === 'submitted' ? (ans.isCorrect1 ? 'border-green-400 bg-green-50 text-green-700' : 'border-red-300 bg-red-50 text-red-700') : 'border-gray-200 focus:border-[#4ADE80]'}`} 
                      />
                      {reviewState === 'submitted' && !ans.isCorrect1 && <div className="text-sm font-bold text-green-600 mt-1">{item.word}</div>}
                    </td>
                    <td className="p-4">
                      <input 
                        type="text" 
                        value={ans.answer2}
                        onChange={(e) => updateAnswer(item.id, 'answer2', e.target.value)}
                        disabled={reviewState === 'submitted'}
                        placeholder="n, v, adj..."
                        className={`w-full px-3 py-2 bg-gray-50 border rounded-xl font-medium focus:outline-none ${reviewState === 'submitted' ? (ans.isCorrect2 ? 'border-green-400 bg-green-50 text-green-700' : 'border-red-300 bg-red-50 text-red-700') : 'border-gray-200 focus:border-[#4ADE80]'}`} 
                      />
                      {reviewState === 'submitted' && !ans.isCorrect2 && <div className="text-sm font-bold text-green-600 mt-1">{item.wordType}</div>}
                    </td>
                    <td className="p-4">
                      <input 
                        type="text" 
                        value={ans.notes}
                        onChange={(e) => updateAnswer(item.id, 'notes', e.target.value)}
                        placeholder="Ghi chú thêm..." 
                        className="w-full px-3 py-2 bg-transparent border-b border-transparent focus:border-gray-200 font-medium focus:outline-none text-gray-500 placeholder-gray-300" 
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
