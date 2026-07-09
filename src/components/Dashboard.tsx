import { ViewState } from '../types';
import { Play, Calendar, BookOpen, CheckCircle, Target, Sparkles, Heart, Flame } from 'lucide-react';
import { useState } from 'react';
import { useVocab } from '../context/VocabContext';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface DashboardProps {
  setCurrentView: (view: ViewState) => void;
}

export default function Dashboard({ setCurrentView }: DashboardProps) {
  const { items, sessions, addQuizSession } = useVocab();
  const [showApology, setShowApology] = useState(false);
  const [showStreakModal, setShowStreakModal] = useState(false);

  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);

  const emotions = [
    { 
      label: 'Vui vẻ', 
      emoji: '🥰', 
      messages: [
        'Hôm nay Uyên vui quá ta! Cười tươi là thấy ngày đẹp rồi, cứ mãi vui thế này nhé!',
        'Công chúa hôm nay vui vẻ thế này làm anh cũng vui lây đó. Yêu em!',
        'Trời hôm nay đẹp, mà Uyên cười còn đẹp hơn trời nữa. Thương bé!',
        'Ngày vui vẻ nha em bé ơi! Mãi tươi tắn thế này nha.'
      ] 
    },
    { 
      label: 'Buồn bã', 
      emoji: '🥺', 
      messages: [
        'Đừng buồn nhé, có anh ở đây rồi. Thương thương ngoan ngoan nè.',
        'Mọi chuyện rồi sẽ ổn thôi mà, ôm em một cái thật chặt nè.',
        'Nếu buồn quá thì cứ khóc ra nhé, anh sẽ lau nước mắt cho bé.',
        'Có chuyện gì tâm sự với anh nhé, đừng giấu buồn một mình nha.'
      ]
    },
    { 
      label: 'Mệt mỏi', 
      emoji: '🧸', 
      messages: [
        'Nghỉ ngơi xíu đi em, đừng ráng quá. Ôm một cái nạp năng lượng nha!',
        'Nay bé ngoan mệt rồi đúng không? Lại đây anh ôm ngủ nào.',
        'Mệt thì nạp chút đồ ngọt, nghe chút nhạc thư giãn nhé em.',
        'Nhớ giữ gìn sức khỏe nha, em mệt anh lo lắm đó.'
      ]
    },
    { 
      label: 'Tức giận', 
      emoji: '😤', 
      messages: [
        'Ai chọc Uyên giận dạ? Khó chịu thì cứ nói với anh nè, hạ hỏa nha, thương lắm.',
        'Nóng giận không tốt cho sắc đẹp đâu nè, hít thở sâu vào công chúa ơi.',
        'Bé giận nhìn cũng đáng yêu lắm, nhưng đừng giận lâu nha, mau vui lại nhé.',
        'Hạ hỏa hạ hỏa, ăn miếng bánh uống miếng nước cho mát ruột nè.'
      ]
    },
  ];

  const [selectedEmotion, setSelectedEmotion] = useState<typeof emotions[0] | null>(null);

  const getMessage = (messages: string[]) => {
    return messages[dayOfYear % messages.length];
  };

  const wordsStored = items.length;
  const activeWords = items.filter(i => i.status === 'Studying').length;
  const completedWords = items.filter(i => i.status === 'Completed').length;
  const avgScore = items.length ? Math.round(items.reduce((acc, curr) => acc + (curr.lastScore || 0), 0) / items.length) : 0;

  const countNew = items.filter(i => i.masteryLevel === 'New' || !i.masteryLevel).length;
  const countMastery = items.filter(i => i.masteryLevel === 'Mastery' || i.status === 'Completed').length;

  // 4. CHUỖI LỬA (STREAK)
  const activityDates = new Set<string>();
  items.forEach(item => {
    if (item.createdAt) activityDates.add(new Date(item.createdAt).toDateString());
    if (item.updatedAt) activityDates.add(new Date(item.updatedAt).toDateString());
  });
  sessions.forEach(session => {
    if (session.savedAt) activityDates.add(new Date(session.savedAt).toDateString());
    if (session.submittedAt) activityDates.add(new Date(session.submittedAt).toDateString());
  });

  const sortedDates = Array.from(activityDates)
    .map(d => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime()); // newest first

  let currentStreak = 0;
  let isStreakBroken = false;
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  if (sortedDates.length > 0) {
    let firstDate = sortedDates[0];
    firstDate.setHours(0, 0, 0, 0);
    
    let diffDays = Math.floor((todayDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 1) { // Active today or yesterday
       currentStreak = 1;
       isStreakBroken = false;
       let prevDate = firstDate;
       for (let i = 1; i < sortedDates.length; i++) {
         let curr = sortedDates[i];
         curr.setHours(0,0,0,0);
         let diff = Math.floor((prevDate.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
         if (diff === 1) {
           currentStreak++;
           prevDate = curr;
         } else if (diff === 0) {
           continue; // Same day
         } else {
           break; // Streak broken
         }
       }
    } else {
       isStreakBroken = true;
    }
  }

  const [restorePassword, setRestorePassword] = useState('');
  const [restoreError, setRestoreError] = useState('');

  const handleRestoreStreak = async () => {
    if (restorePassword === '020206') {
      if (sortedDates.length > 0) {
        let firstDate = sortedDates[0];
        firstDate.setHours(0, 0, 0, 0);
        let diffDays = Math.floor((todayDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays > 1) {
          // Fill the gaps with dummy sessions
          for (let i = 1; i < diffDays; i++) {
            let fillDate = new Date(firstDate);
            fillDate.setDate(fillDate.getDate() + i);
            await addQuizSession({
              id: `restore-${Date.now()}-${i}`,
              mode: 'Vietnamese',
              questionCount: 0,
              type: 'Streak Restore',
              criteria: ['Restore'],
              score: 100,
              savedAt: fillDate.getTime(),
              submittedAt: fillDate.getTime(),
            });
          }
        }
      }
      setShowStreakModal(false);
      setRestorePassword('');
      setRestoreError('');
    } else {
      setRestoreError('Mật khẩu không chính xác!');
    }
  };

  // 1. TỪ VỰNG MỚI TRONG TUẦN (7 ngày qua)
  const last7Days = Array.from({length: 7}).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const newWordsData = last7Days.map(date => {
    const label = `${date.getDate()}/${date.getMonth()+1}`;
    const count = items.filter(item => {
      const itemDate = new Date(item.createdAt);
      return itemDate.getDate() === date.getDate() && itemDate.getMonth() === date.getMonth() && itemDate.getFullYear() === date.getFullYear();
    }).length;
    return { name: label, value: count };
  });

  // 2. LỊCH SỬ ÔN TẬP (7 bài gần nhất)
  const recentSessions = [...sessions].filter(s => s.type !== 'Streak Restore').sort((a, b) => (a.submittedAt || a.savedAt || 0) - (b.submittedAt || b.savedAt || 0)).slice(-7);
  const quizData = recentSessions.map((s, i) => {
    const d = new Date(s.submittedAt || s.savedAt || Date.now());
    return {
      name: `Lần ${i+1}`,
      score: s.score,
      date: `${d.getDate()}/${d.getMonth()+1}`
    };
  });

  // 3. PHÂN BỔ LOẠI TỪ
  const typeMap: Record<string, number> = {};
  items.forEach(item => {
    const type = item.wordType?.toLowerCase().trim() || 'khác';
    let group = 'Khác';
    if (type.includes('noun') || type.includes('n.') || type === 'n') group = 'Danh từ';
    else if (type.includes('verb') || type.includes('v.') || type === 'v') group = 'Động từ';
    else if (type.includes('adj')) group = 'Tính từ';
    else if (type.includes('adv')) group = 'Trạng từ';
    
    typeMap[group] = (typeMap[group] || 0) + 1;
  });
  const typeData = Object.keys(typeMap).map(k => ({ name: k, value: typeMap[k] }));
  const typeColors = ['#FCA5A5', '#FCD34D', '#6EE7B7', '#93C5FD', '#D8B4FE'];

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#2D5A27] flex items-center gap-2">
            Hello, hôm nay học từ nào? 👋
          </h2>
          <p className="text-gray-500 font-medium mt-1">Tiếp tục lộ trình của bạn.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setShowApology(true)}
            className="flex items-center gap-3 px-10 py-5 bg-pink-100 text-pink-600 hover:bg-pink-200 text-xl font-extrabold rounded-[1.5rem] border-2 border-pink-300 shadow-md transition-all active:scale-95 hover:shadow-lg hover:-translate-y-1"
          >
            <Heart fill="currentColor" size={28} className="animate-pulse" />
            Khi nào giận anh thì ấn vào đây
          </button>
        </div>
      </header>

      {showApology && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white p-12 rounded-[3rem] card-shadow border border-pink-100 flex flex-col items-center max-w-sm text-center relative animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-pink-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
              <Heart className="text-pink-500 w-12 h-12" fill="currentColor" />
            </div>
            <h3 className="text-3xl font-extrabold text-pink-500 mb-4 font-sans">Anh xin lỗi em rất nhiều!</h3>
            <p className="text-pink-400 font-medium text-lg mb-8">Năn nỉ đừng giận anh nữa nha nha nha 🥺👉👈</p>
            <button 
              onClick={() => setShowApology(false)}
              className="px-8 py-4 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-2xl shadow-sm transition-colors active:scale-95 w-full"
            >
              Hết giận rồi ❤️
            </button>
          </div>
        </div>
      )}

      {showStreakModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-[3rem] card-shadow border border-orange-100 flex flex-col items-center max-w-md text-center relative animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-6">
              <Flame className="text-orange-500 w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-3">Khôi phục chuỗi học tập</h3>
            <p className="text-gray-600 mb-6">
              Chuỗi của bạn đã bị đứt? Nhập mật khẩu là ngày sinh nhật của Cao Nguyen (gợi ý: dd/mm/yy) để khôi phục nhé!
            </p>
            <div className="w-full mb-6">
              <div className={`w-full p-4 mb-4 bg-gray-50 border-2 rounded-2xl text-center text-2xl font-bold h-16 flex items-center justify-center ${restoreError ? 'border-red-400 text-red-600' : 'border-orange-200 text-gray-800'}`}>
                {restorePassword.padEnd(6, '•').split('').map((char, i) => (
                  <span key={i} className="mx-2">{char}</span>
                ))}
              </div>
              {restoreError && <p className="text-red-500 text-sm mb-4 font-medium animate-in slide-in-from-top-1">{restoreError}</p>}
              
              <div className="grid grid-cols-3 gap-3 mb-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button 
                    key={num}
                    onClick={() => {
                      if (restorePassword.length < 6) setRestorePassword(p => p + num);
                      setRestoreError('');
                    }}
                    className="py-4 bg-gray-50 hover:bg-orange-50 rounded-2xl text-xl font-bold text-gray-700 transition-colors"
                  >
                    {num}
                  </button>
                ))}
                <button 
                  onClick={() => {
                    setRestorePassword('');
                    setRestoreError('');
                  }}
                  className="py-4 bg-gray-50 hover:bg-red-50 rounded-2xl text-xl font-bold text-red-400 transition-colors"
                >
                  C
                </button>
                <button 
                  onClick={() => {
                    if (restorePassword.length < 6) setRestorePassword(p => p + '0');
                    setRestoreError('');
                  }}
                  className="py-4 bg-gray-50 hover:bg-orange-50 rounded-2xl text-xl font-bold text-gray-700 transition-colors"
                >
                  0
                </button>
                <button 
                  onClick={() => {
                    setRestorePassword(p => p.slice(0, -1));
                    setRestoreError('');
                  }}
                  className="py-4 bg-gray-50 hover:bg-orange-50 rounded-2xl text-xl font-bold text-gray-700 transition-colors"
                >
                  ⌫
                </button>
              </div>
            </div>
            <div className="flex gap-4 w-full">
              <button 
                onClick={() => {
                  setShowStreakModal(false);
                  setRestorePassword('');
                  setRestoreError('');
                }}
                className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-colors"
              >
                Đóng
              </button>
              <button 
                onClick={handleRestoreStreak}
                className="flex-1 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl shadow-sm transition-colors"
              >
                Khôi phục
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emotion Tracker */}
      <div className="bg-white p-6 rounded-[2rem] card-shadow border-thin flex flex-col mb-2">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          Ngày hôm nay Uyên thấy thế nào?
        </h3>
        {!selectedEmotion ? (
          <div className="flex gap-4">
            {emotions.map((emo, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedEmotion(emo)}
                className="flex-1 py-4 px-2 rounded-2xl border-2 border-pink-100 bg-pink-50/50 hover:bg-pink-100 hover:border-pink-300 transition-all flex flex-col items-center gap-2"
              >
                <span className="text-4xl">{emo.emoji}</span>
                <span className="font-semibold text-gray-700 text-sm">{emo.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-6 bg-gradient-to-r from-pink-50 to-red-50 rounded-2xl border-2 border-pink-200 text-center animate-in zoom-in-95 duration-300 relative">
             <button 
               onClick={() => setSelectedEmotion(null)}
               className="absolute top-2 right-3 text-pink-400 hover:text-pink-600 font-bold text-xl"
             >
               ×
             </button>
             <div className="text-5xl mb-4 animate-bounce">{selectedEmotion.emoji}</div>
             <p className="text-pink-700 font-medium text-lg italic">"{getMessage(selectedEmotion.messages)}"</p>
          </div>
        )}
      </div>

      {/* Streak Highlight */}
      <div 
        onClick={() => isStreakBroken && setShowStreakModal(true)}
        className={`bg-gradient-to-r from-orange-50 to-red-50 p-8 rounded-[2rem] card-shadow border-2 border-orange-200 flex flex-col items-center justify-center text-center relative overflow-hidden transition-transform ${isStreakBroken ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-orange-500 opacity-5">
          <Flame size={150} strokeWidth={2} />
        </div>
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm z-10">
          <Flame size={32} className="text-orange-500" />
        </div>
        <span className="text-orange-800 text-sm font-bold uppercase tracking-wider mb-2 z-10">Chuỗi ngày học tập</span>
        <h3 className="text-6xl font-extrabold text-orange-600 z-10">{currentStreak} <span className="text-4xl">🔥</span></h3>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-6">
        {[
          { label: 'Từ đã lưu', value: wordsStored, icon: BookOpen, color: 'text-[#2D5A27]', bg: 'bg-[#E8F5E9]' },
          { label: 'Đang học', value: activeWords, icon: Target, color: 'text-[#2D5A27]', bg: 'bg-[#D0E8D0]' },
          { label: 'Hoàn thành', value: completedWords, icon: CheckCircle, color: 'text-[#2D5A27]', bg: 'bg-[#A5D6A7]' },
          { label: 'Điểm trung bình', value: `${avgScore}%`, icon: Sparkles, color: 'text-[#795548]', bg: 'bg-[#FFECB3]' },
        ].map((kpi, idx) => (
          <div key={idx} 
            className="bg-white p-6 rounded-[2rem] card-shadow border-thin flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className={`absolute top-4 right-4 ${kpi.color} opacity-20`}>
              <kpi.icon size={32} strokeWidth={2} />
            </div>
            <span className="text-gray-400 text-sm font-semibold uppercase mb-1 z-10">{kpi.label}</span>
            <h3 className={`text-4xl font-bold ${kpi.color} z-10`}>{kpi.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* New Words added last 7 days */}
        <div className="bg-white p-8 rounded-[1rem] card-shadow border-thin">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Từ vựng mới (7 ngày)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={newWordsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={true} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                <YAxis axisLine={true} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip 
                  cursor={{fill: 'rgba(0,0,0,0.02)'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#FCA5A5" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Word Types Distribution */}
        <div className="bg-white p-8 rounded-[1rem] card-shadow border-thin">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Phân bổ loại từ</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {typeData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={typeColors[index % typeColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="square" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quiz history */}
        <div className="col-span-2 bg-white p-8 rounded-[1rem] card-shadow border-thin">
          <h3 className="text-lg font-bold text-gray-800 mb-6">Kết quả ôn tập gần đây</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quizData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={true} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                <YAxis axisLine={true} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} domain={[0, 100]} />
                <Tooltip 
                  cursor={{fill: 'rgba(0,0,0,0.02)'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value) => [`${value}%`, 'Điểm số']}
                  labelFormatter={(label, payload) => payload.length > 0 ? `${label} (${payload[0].payload.date})` : label}
                />
                <Bar dataKey="score" fill="#6EE7B7" radius={[4, 4, 0, 0]} barSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
