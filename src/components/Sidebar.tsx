import { ViewState } from '../types';
import { cn } from '../lib/utils';
import { Home, LibraryBig, ListTodo, PenTool, CalendarDays, Settings as SettingsIcon, Sprout, Link2 } from 'lucide-react';

interface SidebarProps {
  currentView: ViewState;
  setCurrentView: (view: ViewState) => void;
}

export default function Sidebar({ currentView, setCurrentView }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'library', label: 'Library', icon: LibraryBig },
    { id: 'vocab-list', label: 'Vocab List', icon: ListTodo },
    { id: 'collocations', label: 'Collocation', icon: Link2 },
    { id: 'practice', label: 'Practice', icon: PenTool },
    { id: 'monthly-review', label: 'Monthly Review', icon: CalendarDays },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ] as const;

  return (
    <aside className="w-64 bg-[#E8F5E9] border-r border-thin flex flex-col p-6 shrink-0">
      <div className="flex flex-col gap-3 mb-10 px-2 mt-4">
        <div className="w-16 h-16 bg-[#A5D6A7] rounded-xl flex items-center justify-center text-[#2D5A27] shadow-sm">
          <Sprout size={40} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-[#2D5A27] tracking-tighter leading-none">Vocab của</h1>
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#4ADE80] to-[#2D5A27] tracking-tighter mt-2 drop-shadow-md">UyenUyen</h1>
        </div>
      </div>

      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id as ViewState)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all duration-200 text-left",
                isActive 
                  ? "bg-[#D0E8D0] text-[#2D5A27]" 
                  : "text-gray-500 hover:bg-[#E3F0E3] hover:text-[#2D5A27]"
              )}
            >
              <Icon size={20} className={cn("shrink-0", isActive ? "text-[#2D5A27]" : "text-gray-400")} />
              {item.label}
            </button>
          )
        })}
      </nav>
    </aside>
  );
}
