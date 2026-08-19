import { ArrowDownAZ, Search, SlidersHorizontal } from 'lucide-react';

export type VocabSortMode = 'newest' | 'oldest' | 'az' | 'za' | 'band-high' | 'band-low';

interface VocabFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sort: VocabSortMode;
  onSortChange: (value: VocabSortMode) => void;
  topic?: string;
  onTopicChange?: (value: string) => void;
  topics?: string[];
  project?: string;
  onProjectChange?: (value: string) => void;
  projects?: Array<{ id: string; name: string }>;
  source?: string;
  onSourceChange?: (value: string) => void;
  sources?: string[];
  status?: string;
  onStatusChange?: (value: string) => void;
  statuses?: string[];
  compact?: boolean;
}

export default function VocabFilterBar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  topic = 'All Topics',
  onTopicChange,
  topics = [],
  project = 'All Projects',
  onProjectChange,
  projects = [],
  source = 'All Sources',
  onSourceChange,
  sources = [],
  status = 'All Statuses',
  onStatusChange,
  statuses = ['Storage', 'Studying', 'Completed'],
  compact = false,
}: VocabFilterBarProps) {
  const controlClass = 'w-full sm:w-auto min-w-0 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 font-bold text-sm text-gray-600 focus:outline-none focus:border-[#A5D6A7]';

  return (
    <div className={`bg-white border-thin card-shadow rounded-2xl ${compact ? 'p-3' : 'p-4'} space-y-3`}>
      <div className="flex items-center gap-2 text-sm font-extrabold text-gray-500">
        <SlidersHorizontal size={16} /> Filter & Sort
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
        <div className="relative sm:col-span-2 xl:col-span-2">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={search}
            onChange={event => onSearchChange(event.target.value)}
            placeholder="Search word, meaning, topic..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 font-semibold text-sm focus:outline-none focus:border-[#A5D6A7]"
          />
        </div>

        <select value={sort} onChange={event => onSortChange(event.target.value as VocabSortMode)} className={controlClass}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="az">A → Z</option>
          <option value="za">Z → A</option>
          <option value="band-high">Band high → low</option>
          <option value="band-low">Band low → high</option>
        </select>

        {onProjectChange && (
          <select value={project} onChange={event => onProjectChange(event.target.value)} className={controlClass}>
            <option value="All Projects">All Projects</option>
            {projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        )}

        {onTopicChange && (
          <select value={topic} onChange={event => onTopicChange(event.target.value)} className={controlClass}>
            <option>All Topics</option>
            {topics.map(value => <option key={value}>{value}</option>)}
          </select>
        )}

        {onSourceChange && (
          <select value={source} onChange={event => onSourceChange(event.target.value)} className={controlClass}>
            <option>All Sources</option>
            {sources.map(value => <option key={value}>{value}</option>)}
          </select>
        )}

        {onStatusChange && (
          <select value={status} onChange={event => onStatusChange(event.target.value)} className={controlClass}>
            <option>All Statuses</option>
            {statuses.map(value => <option key={value}>{value}</option>)}
          </select>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
        <ArrowDownAZ size={14} /> Bộ lọc dùng chung cho các danh sách vocab.
      </div>
    </div>
  );
}
