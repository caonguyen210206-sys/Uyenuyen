/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { ViewState } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Library from './components/Library';
import VocabList from './components/VocabList';
import Collocations from './components/Collocations';
import Practice from './components/Practice';
import MonthlyReview from './components/MonthlyReview';
import Settings from './components/Settings';
import { Sparkles, LogIn } from 'lucide-react';
import { auth, googleProvider, signInWithPopup, onAuthStateChanged, User } from './lib/firebase';
import { VocabProvider } from './context/VocabContext';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [showGreeting, setShowGreeting] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setShowGreeting(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setLoginError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error?.code === 'auth/unauthorized-domain') {
        setLoginError('Domain GitHub Pages chưa được cho phép trong Firebase Authentication. Hãy thêm caonguyen210206-sys.github.io vào Authorized domains.');
      } else if (error?.code === 'auth/popup-blocked') {
        setLoginError('Trình duyệt đã chặn cửa sổ đăng nhập. Hãy cho phép popup rồi thử lại.');
      } else if (error?.code === 'auth/popup-closed-by-user') {
        setLoginError('Cửa sổ đăng nhập đã bị đóng. Hãy thử đăng nhập lại nhé.');
      } else if (error?.code === 'auth/operation-not-allowed') {
        setLoginError('Google Sign-in chưa được bật trong Firebase Authentication. Hãy bật Google ở Sign-in method.');
      } else if (error?.code === 'auth/api-key-not-valid' || error?.code === 'auth/invalid-api-key') {
        setLoginError('Firebase API key chưa đúng. Hãy kiểm tra lại config Firebase trong repo.');
      } else {
        setLoginError(`Đăng nhập Google chưa thành công${error?.code ? ` (${error.code})` : ''}. ${error?.message || 'Hãy kiểm tra cấu hình Firebase Authentication.'}`);
      }
    }
  };

  if (loadingAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FAF9F6]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FAF9F6]">
        <div className="bg-white p-10 rounded-[2rem] card-shadow border border-pink-100 flex flex-col items-center text-center max-w-sm">
          <div className="w-20 h-20 bg-pink-100 rounded-full flex items-center justify-center mb-6">
            <Sparkles className="text-pink-500 w-10 h-10" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-800 mb-4 font-sans">Đăng nhập nhé 🥰</h1>
          <p className="text-gray-500 mb-8 font-medium">Bắt đầu học từ vựng thôi nào!</p>
          {loginError && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 mb-5 font-medium">
              {loginError}
            </p>
          )}
          <button 
            onClick={handleLogin}
            className="flex items-center justify-center gap-3 w-full px-6 py-4 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-2xl shadow-sm transition-colors active:scale-95"
          >
            <LogIn size={20} />
            Đăng nhập bằng Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <VocabProvider>
      <div className="flex h-screen bg-[#FAF9F6] text-gray-800 font-sans overflow-hidden relative">
        {/* Greeting Toast */}
        {showGreeting && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-10 fade-in duration-500">
            <div className="bg-white px-8 py-4 rounded-full shadow-lg border-2 border-pink-200 flex items-center gap-3">
              <Sparkles className="text-pink-400" size={24} />
              <span className="text-pink-500 font-extrabold text-lg">Chúc em học bài tốt nhée! 🥰</span>
            </div>
          </div>
        )}

        {/* Sidebar Navigation */}
        <Sidebar currentView={currentView} setCurrentView={setCurrentView} />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto h-full">
            <div className={currentView === 'dashboard' ? 'block' : 'hidden'}>
              <Dashboard setCurrentView={setCurrentView} />
            </div>
            <div className={currentView === 'library' ? 'block' : 'hidden'}>
              <Library setCurrentView={setCurrentView} />
            </div>
            <div className={currentView === 'vocab-list' ? 'block' : 'hidden'}>
              <VocabList />
            </div>
            <div className={currentView === 'collocations' ? 'block' : 'hidden'}>
              <Collocations setCurrentView={setCurrentView} />
            </div>
            <div className={currentView === 'practice' ? 'block' : 'hidden'}>
              <Practice />
            </div>
            <div className={currentView === 'monthly-review' ? 'block' : 'hidden'}>
              <MonthlyReview />
            </div>
            <div className={currentView === 'settings' ? 'block' : 'hidden'}>
              <Settings />
            </div>
          </div>
        </main>
      </div>
    </VocabProvider>
  );
}
