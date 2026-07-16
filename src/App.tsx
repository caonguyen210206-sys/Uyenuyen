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
import { Sparkles, LogIn, Menu, Copy, ExternalLink } from 'lucide-react';
import { auth, googleProvider, signInWithPopup, onAuthStateChanged, User } from './lib/firebase';
import { VocabProvider } from './context/VocabContext';

const APP_URL = 'https://caonguyen210206-sys.github.io/Uyenuyen/';

function isInAppBrowser() {
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|FB_IAB|Messenger|Instagram|Line|Zalo|MicroMessenger|TikTok/i.test(ua);
}

function isMissingInitialStateError(error: any) {
  const message = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
  return message.includes('missing initial state')
    || message.includes('sessionstorage')
    || message.includes('storage-partitioned');
}

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [showGreeting, setShowGreeting] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isEmbeddedBrowser, setIsEmbeddedBrowser] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    setIsEmbeddedBrowser(isInAppBrowser());
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

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(APP_URL);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      setLoginError(`Không copy được tự động. Hãy copy thủ công link này: ${APP_URL}`);
    }
  };

  const handleLogin = async () => {
    setLoginError('');
    if (isEmbeddedBrowser) {
      setLoginError('Bạn đang mở web trong Messenger/Facebook/Zalo. Google Login dễ lỗi ở trình duyệt nhúng. Hãy mở link bằng Safari hoặc Chrome rồi đăng nhập lại.');
      return;
    }

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Login failed', error);
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
      } else if (isMissingInitialStateError(error)) {
        setLoginError('Firebase không giữ được trạng thái đăng nhập vì trình duyệt đang chặn sessionStorage. Hãy mở web bằng Safari/Chrome thật, không mở trong Messenger/Facebook/Zalo.');
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
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F6] p-4">
        <div className="bg-white p-8 sm:p-10 rounded-[2rem] card-shadow border border-pink-100 flex flex-col items-center text-center max-w-sm w-full">
          <div className="w-20 h-20 bg-pink-100 rounded-full flex items-center justify-center mb-6">
            <Sparkles className="text-pink-500 w-10 h-10" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-800 mb-4 font-sans">Đăng nhập</h1>
          <p className="text-gray-500 mb-6 font-medium">Bắt đầu học từ vựng.</p>

          {isEmbeddedBrowser && (
            <div className="w-full text-left text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-5 font-semibold leading-relaxed">
              <p className="font-extrabold mb-1">Không đăng nhập trong Messenger/Facebook/Zalo.</p>
              <p>Hãy bấm nút copy link, mở Safari/Chrome rồi dán link để đăng nhập Google ổn định.</p>
            </div>
          )}

          {loginError && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 mb-5 font-medium w-full">
              {loginError}
            </p>
          )}

          {isEmbeddedBrowser ? (
            <div className="w-full space-y-3">
              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-3 w-full px-6 py-4 bg-[#A5D6A7] hover:bg-[#81C784] text-[#2D5A27] font-bold rounded-2xl shadow-sm transition-colors active:scale-95"
              >
                <Copy size={20} />
                {copiedLink ? 'Đã copy link!' : 'Copy link để mở bằng Safari/Chrome'}
              </button>
              <a
                href={APP_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-3 w-full px-6 py-4 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold rounded-2xl shadow-sm transition-colors active:scale-95"
              >
                <ExternalLink size={20} />
                Thử mở tab mới
              </a>
              <p className="text-xs text-gray-400 font-semibold break-all">{APP_URL}</p>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="flex items-center justify-center gap-3 w-full px-6 py-4 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-2xl shadow-sm transition-colors active:scale-95"
            >
              <LogIn size={20} />
              Đăng nhập bằng Google
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <VocabProvider>
      <div className="flex h-screen bg-[#FAF9F6] text-gray-800 font-sans overflow-hidden relative">
        {showGreeting && (
          <div className="absolute top-20 lg:top-10 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-10 fade-in duration-500 w-[calc(100%-2rem)] max-w-md lg:w-auto lg:max-w-none">
            <div className="bg-white px-5 lg:px-8 py-3 lg:py-4 rounded-full shadow-lg border-2 border-pink-200 flex items-center justify-center gap-3 text-center">
              <Sparkles className="text-pink-400 shrink-0" size={22} />
              <span className="text-pink-500 font-extrabold text-sm lg:text-lg">Chúc bạn học bài tốt!</span>
            </div>
          </div>
        )}

        <button
          aria-label="Mở menu"
          onClick={() => setIsMobileMenuOpen(true)}
          className="fixed top-4 left-4 z-40 lg:hidden w-12 h-12 rounded-2xl bg-white text-[#2D5A27] border border-[#D0E8D0] shadow-lg flex items-center justify-center active:scale-95"
        >
          <Menu size={24} />
        </button>

        <Sidebar
          currentView={currentView}
          setCurrentView={setCurrentView}
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex-1 overflow-y-auto p-4 pt-20 lg:p-8 min-w-0">
          <div className="max-w-6xl mx-auto min-h-full">
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
              <Practice currentView={currentView} />
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