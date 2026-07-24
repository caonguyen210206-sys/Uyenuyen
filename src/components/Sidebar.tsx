import { ViewState } from '../types';
import { cn } from '../lib/utils';
import { Home, LibraryBig, ListTodo, PenTool, CalendarDays, Settings as SettingsIcon, Sprout, Link2, X, ShieldAlert } from 'lucide-react';

interface SidebarProps {
  currentView: ViewState;
  setCurrentView: (view: ViewState) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ currentView, setCurrentView, isOpen = false, onClose }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'library', label: 'Library', icon: LibraryBig },
    { id: 'vocab-list', label: 'Vocab List', icon: ListTodo },
    { id: 'collocations', label: 'Collocation', icon: Link2 },
    { id: 'crime-collocations', label: 'Crime Pack', icon: ShieldAlert },
    { id: 'practice', label: 'Practice', icon: PenTool },
    { id: 'monthly-review', label: 'Monthly Review', icon: CalendarDays },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ] as const;

  const handleNavigate = (view: ViewState) => {
    setCurrentView(view);
    onClose?.();
  };

  return (
    <>
      {isOpen && (
        <button
          aria-label="Đóng menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 max-w-[82vw] bg-[#E8F5E9] border-r border-thin flex flex-col p-5 shrink-0 transition-transform duration-300 ease-out lg:static lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0 lg:p-6',
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:shadow-none',
        )}
      >
        <div className="flex items-start justify-between gap-3 mb-8 px-1 mt-2 lg:mt-4 lg:block lg:mb-10 lg:px-2">
          <div className="flex items-center gap-3 lg:flex-col lg:items-start">
            <div className="w-14 h-14 lg:w-16 lg:h-16 bg-[#A5D6A7] rounded-xl flex items-center justify-center text-[#2D5A27] shadow-sm shrink-0">
              <Sprout size={34} className="lg:w-10 lg:h-10" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-black text-[#2D5A27] tracking-tighter leading-none">Vocab của</h1>
              <h1 className="text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#4ADE80] to-[#2D5A27] tracking-tighter mt-1 lg:mt-2 drop-shadow-md">UyenUyen</h1>
            </div>
          </div>

          <button
            aria-label="Đóng menu"
            onClick={onClose}
            className="lg:hidden p-2 rounded-xl bg-white/70 text-[#2D5A27] border border-[#D0E8D0] shadow-sm"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto pr-1">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id as ViewState)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all duration-200 text-left',
                  isActive
                    ? 'bg-[#D0E8D0] text-[#2D5A27]'
                    : 'text-gray-500 hover:bg-[#E3F0E3] hover:text-[#2D5A27]',
                )}
              >
                <Icon size={20} className={cn('shrink-0', isActive ? 'text-[#2D5A27]' : 'text-gray-400')} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
