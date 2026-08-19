import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpenCheck,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  PencilLine,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ReadingProject, ReadingSource, ReadingVocabPayload, ViewState, VocabItem } from '../types';
import { useVocab } from '../context/VocabContext';
import { extractReadingText, extractReadingVocabulary } from '../lib/readingProjectAi';
import { formatBand, normalizeBand, normalizeWord } from '../lib/vocabUtils';
import VocabFilterBar, { VocabSortMode } from './VocabFilterBar';

interface ReadingProjectsProps {
  setCurrentView: (view: ViewState) => void;
}

type ProjectSort = 'updated' | 'newest' | 'oldest' | 'az' | 'za' | 'most-vocab';
const PRACTICE_SELECTION_STORAGE_KEY = 'uyenuyen-practice-selection';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Không đọc được file ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Không xử lý được ảnh.'));
    image.src = dataUrl;
  });
}

async function compressImage(file: File) {
  const original = await readFileAsDataUrl(file);
  const image = await loadImage(original);
  const maxWidth = 1280;
  const scale = Math.min(1, maxWidth / image.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) return original;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let result = canvas.toDataURL('image/jpeg', 0.68);
  if (result.length > 720_000) result = canvas.toDataURL('image/jpeg', 0.5);
  if (result.length > 900_000) {
    throw new Error(`Ảnh ${file.name} vẫn quá lớn sau khi nén. Hãy chụp/crop phần bài đọc rồi upload lại.`);
  }
  return result;
}

async function sourceFromFile(file: File, projectId: string): Promise<ReadingSource> {
  if (file.type.startsWith('image/')) {
    const dataUrl = await compressImage(file);
    return {
      id: uuidv4(),
      projectId,
      type: 'image',
      name: file.name,
      mimeType: 'image/jpeg',
      dataUrl,
      createdAt: Date.now(),
    };
  }

  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    if (file.size > 650_000) {
      throw new Error(`PDF ${file.name} quá lớn để lưu an toàn trong Firestore. Hãy dùng ảnh từng trang hoặc PDF dưới khoảng 650 KB.`);
    }
    return {
      id: uuidv4(),
      projectId,
      type: 'pdf',
      name: file.name,
      mimeType: 'application/pdf',
      dataUrl: await readFileAsDataUrl(file),
      createdAt: Date.now(),
    };
  }

  throw new Error(`File ${file.name} chưa được hỗ trợ. Dùng ảnh hoặc PDF.`);
}

function bandNumber(value?: string) {
  if (!value || value === 'Basic') return 0;
  return Number.parseFloat(value) || 0;
}

export default function ReadingProjects({ setCurrentView }: ReadingProjectsProps) {
  const {
    items,
    updateVocabItems,
    readingProjects,
    readingSources,
    updateReadingProjects,
    updateReadingSources,
    removeReadingProject,
    settings,
  } = useVocab();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectTopic, setProjectTopic] = useState('');
  const [projectText, setProjectText] = useState('');
  const [projectFiles, setProjectFiles] = useState<File[]>([]);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isExtractingReading, setIsExtractingReading] = useState(false);
  const [isExtractingVocab, setIsExtractingVocab] = useState(false);
  const [editedReading, setEditedReading] = useState('');
  const [selectedVocabIds, setSelectedVocabIds] = useState<Set<string>>(new Set());

  const [projectSearch, setProjectSearch] = useState('');
  const [projectTopicFilter, setProjectTopicFilter] = useState('All Topics');
  const [projectSort, setProjectSort] = useState<ProjectSort>('updated');

  const [vocabSearch, setVocabSearch] = useState('');
  const [vocabSort, setVocabSort] = useState<VocabSortMode>('newest');
  const [vocabTopic, setVocabTopic] = useState('All Topics');
  const [vocabSource, setVocabSource] = useState('All Sources');
  const [vocabStatus, setVocabStatus] = useState('All Statuses');

  const addSourceInputRef = useRef<HTMLInputElement | null>(null);

  const selectedProject = readingProjects.find(project => project.id === selectedProjectId) || null;
  const projectSources = selectedProject ? readingSources.filter(source => source.projectId === selectedProject.id) : [];
  const projectVocab = selectedProject
    ? selectedProject.vocabIds.map(id => items.find(item => item.id === id)).filter(Boolean) as VocabItem[]
    : [];

  useEffect(() => {
    setEditedReading(selectedProject?.extractedText || '');
    setSelectedVocabIds(new Set());
    setVocabSearch('');
    setVocabTopic('All Topics');
    setVocabSource('All Sources');
    setVocabStatus('All Statuses');
  }, [selectedProjectId, selectedProject?.extractedText]);

  const projectTopics = useMemo(
    () => Array.from(new Set(readingProjects.map(project => project.topic).filter(Boolean))).sort(),
    [readingProjects],
  );

  const filteredProjects = useMemo(() => {
    const query = normalizeWord(projectSearch);
    return readingProjects
      .filter(project => {
        const matchesSearch = !query || normalizeWord(`${project.name} ${project.topic}`).includes(query);
        const matchesTopic = projectTopicFilter === 'All Topics' || project.topic === projectTopicFilter;
        return matchesSearch && matchesTopic;
      })
      .sort((a, b) => {
        if (projectSort === 'newest') return b.createdAt - a.createdAt;
        if (projectSort === 'oldest') return a.createdAt - b.createdAt;
        if (projectSort === 'az') return a.name.localeCompare(b.name);
        if (projectSort === 'za') return b.name.localeCompare(a.name);
        if (projectSort === 'most-vocab') return b.vocabIds.length - a.vocabIds.length;
        return b.updatedAt - a.updatedAt;
      });
  }, [readingProjects, projectSearch, projectTopicFilter, projectSort]);

  const vocabTopics = Array.from(new Set(projectVocab.map(item => item.topic).filter(Boolean))).sort();
  const vocabSources = Array.from(new Set(projectVocab.map(item => item.source).filter(Boolean))).sort();

  const filteredProjectVocab = useMemo(() => {
    const query = normalizeWord(vocabSearch);
    return projectVocab
      .filter(item => {
        const matchesSearch = !query || normalizeWord(`${item.word} ${item.meaning} ${item.definition} ${item.topic}`).includes(query);
        const matchesTopic = vocabTopic === 'All Topics' || item.topic === vocabTopic;
        const matchesSource = vocabSource === 'All Sources' || item.source === vocabSource;
        const matchesStatus = vocabStatus === 'All Statuses' || item.status === vocabStatus;
        return matchesSearch && matchesTopic && matchesSource && matchesStatus;
      })
      .sort((a, b) => {
        if (vocabSort === 'oldest') return a.createdAt - b.createdAt;
        if (vocabSort === 'az') return a.word.localeCompare(b.word);
        if (vocabSort === 'za') return b.word.localeCompare(a.word);
        if (vocabSort === 'band-high') return bandNumber(b.band) - bandNumber(a.band);
        if (vocabSort === 'band-low') return bandNumber(a.band) - bandNumber(b.band);
        return b.createdAt - a.createdAt;
      });
  }, [projectVocab, vocabSearch, vocabTopic, vocabSource, vocabStatus, vocabSort]);

  const resetCreateForm = () => {
    setProjectName('');
    setProjectTopic('');
    setProjectText('');
    setProjectFiles([]);
    setShowCreate(false);
  };

  const createProject = async () => {
    if (!projectName.trim()) {
      alert('Hãy đặt tên cho Reading Project.');
      return;
    }
    if (projectFiles.length === 0 && !projectText.trim()) {
      alert('Hãy thêm ít nhất một ảnh/PDF hoặc paste text.');
      return;
    }

    setIsSavingProject(true);
    try {
      const id = uuidv4();
      const newSources: ReadingSource[] = [];
      for (const file of projectFiles) newSources.push(await sourceFromFile(file, id));
      if (projectText.trim()) {
        newSources.push({
          id: uuidv4(),
          projectId: id,
          type: 'text',
          name: 'Pasted text',
          mimeType: 'text/plain',
          text: projectText.trim(),
          createdAt: Date.now(),
        });
      }

      const now = Date.now();
      const project: ReadingProject = {
        id,
        name: projectName.trim(),
        topic: projectTopic.trim() || 'General',
        sourceIds: newSources.map(source => source.id),
        extractedText: '',
        vocabIds: [],
        createdAt: now,
        updatedAt: now,
      };

      await updateReadingSources([...readingSources, ...newSources]);
      await updateReadingProjects([...readingProjects, project]);
      resetCreateForm();
      setSelectedProjectId(project.id);
    } catch (error: any) {
      console.error(error);
      alert(error?.message || 'Chưa tạo được Reading Project.');
    } finally {
      setIsSavingProject(false);
    }
  };

  const updateProject = async (nextProject: ReadingProject) => {
    await updateReadingProjects(readingProjects.map(project => project.id === nextProject.id ? nextProject : project));
  };

  const addSourcesToProject = async (files: File[]) => {
    if (!selectedProject || files.length === 0) return;
    try {
      const additions: ReadingSource[] = [];
      for (const file of files) additions.push(await sourceFromFile(file, selectedProject.id));
      await updateReadingSources([...readingSources, ...additions]);
      await updateProject({
        ...selectedProject,
        sourceIds: [...selectedProject.sourceIds, ...additions.map(source => source.id)],
        updatedAt: Date.now(),
      });
    } catch (error: any) {
      alert(error?.message || 'Chưa thêm được source.');
    }
  };

  const removeSource = async (sourceId: string) => {
    if (!selectedProject) return;
    const nextSources = readingSources.filter(source => source.id !== sourceId);
    await updateReadingSources(nextSources);
    await updateProject({
      ...selectedProject,
      sourceIds: selectedProject.sourceIds.filter(id => id !== sourceId),
      updatedAt: Date.now(),
    });
  };

  const runReadingExtraction = async () => {
    if (!selectedProject) return;
    if (projectSources.length === 0) {
      alert('Project chưa có source.');
      return;
    }

    setIsExtractingReading(true);
    try {
      const extractedText = await extractReadingText(projectSources, settings.apiKey);
      setEditedReading(extractedText);
      await updateProject({
        ...selectedProject,
        extractedText,
        lastExtractedAt: Date.now(),
        updatedAt: Date.now(),
      });
    } catch (error: any) {
      console.error(error);
      alert(error?.message || 'Chưa extract được bài đọc.');
    } finally {
      setIsExtractingReading(false);
    }
  };

  const saveEditedReading = async () => {
    if (!selectedProject) return;
    await updateProject({
      ...selectedProject,
      extractedText: editedReading.trim(),
      updatedAt: Date.now(),
    });
  };

  const mergeProjectVocab = async (payloads: ReadingVocabPayload[]) => {
    if (!selectedProject) return;
    const nextItems = [...items];
    const nextIds: string[] = [];
    const now = Date.now();

    payloads.forEach(payload => {
      const word = payload.word.trim();
      const key = normalizeWord(word);
      if (!key) return;
      const existingIndex = nextItems.findIndex(item => normalizeWord(item.word) === key);
      const projectSource = {
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        sourceSentence: payload.sourceSentence || '',
        sourceParagraph: payload.sourceParagraph || '',
        addedAt: now,
      };

      if (existingIndex >= 0) {
        const existing = nextItems[existingIndex];
        const projectIds = Array.from(new Set([...(existing.projectIds || []), selectedProject.id]));
        const projectSources = [
          ...(existing.projectSources || []).filter(source => source.projectId !== selectedProject.id),
          projectSource,
        ];
        nextItems[existingIndex] = {
          ...existing,
          projectIds,
          projectSources,
          ipa: existing.ipa || payload.ipa || '',
          wordType: existing.wordType || payload.wordType || '',
          meaning: existing.meaning || payload.meaning || '',
          definition: existing.definition || payload.definition || '',
          example: existing.example || payload.example || '',
          synonyms: existing.synonyms || payload.synonyms || '',
          antonyms: existing.antonyms || payload.antonyms || '',
          band: existing.band || normalizeBand(payload.band),
          topic: existing.topic || payload.topic || selectedProject.topic,
          updatedAt: now,
        };
        nextIds.push(existing.id);
        return;
      }

      const id = uuidv4();
      nextItems.push({
        id,
        word,
        ipa: payload.ipa || '',
        wordType: payload.wordType || '',
        meaning: payload.meaning || '',
        definition: payload.definition || '',
        example: payload.example || '',
        synonyms: payload.synonyms || '',
        antonyms: payload.antonyms || '',
        band: normalizeBand(payload.band),
        topic: payload.topic || selectedProject.topic || 'General',
        status: 'Storage',
        masteryLevel: 'New',
        source: 'Reading Project',
        createdAt: now,
        updatedAt: now,
        timesChecked: 0,
        projectIds: [selectedProject.id],
        projectSources: [projectSource],
      });
      nextIds.push(id);
    });

    const uniqueIds = Array.from(new Set(nextIds));
    const currentResultIds = new Set(uniqueIds);
    const cleanedItems = nextItems.map(item => {
      if (!item.projectIds?.includes(selectedProject.id) || currentResultIds.has(item.id)) return item;
      return {
        ...item,
        projectIds: item.projectIds.filter(id => id !== selectedProject.id),
        projectSources: (item.projectSources || []).filter(source => source.projectId !== selectedProject.id),
        updatedAt: now,
      };
    });

    await updateVocabItems(cleanedItems);
    await updateProject({
      ...selectedProject,
      vocabIds: uniqueIds,
      lastVocabExtractedAt: now,
      updatedAt: now,
    });
    setSelectedVocabIds(new Set(uniqueIds));
  };

  const runVocabExtraction = async () => {
    if (!selectedProject) return;
    const reading = editedReading.trim() || selectedProject.extractedText.trim();
    if (!reading) {
      alert('Hãy Extract Reading trước hoặc nhập nội dung vào phần Extracted Reading.');
      return;
    }

    setIsExtractingVocab(true);
    try {
      const payloads = await extractReadingVocabulary(reading, selectedProject.name, selectedProject.topic, settings.apiKey);
      if (payloads.length === 0) {
        alert('Không tìm thấy vocab phù hợp trong bài.');
        return;
      }
      await mergeProjectVocab(payloads);
    } catch (error: any) {
      console.error(error);
      alert(error?.message || 'Chưa extract được vocab.');
    } finally {
      setIsExtractingVocab(false);
    }
  };

  const toggleVocab = (id: string) => {
    setSelectedVocabIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisibleVocab = () => {
    const ids = filteredProjectVocab.map(item => item.id);
    const allSelected = ids.length > 0 && ids.every(id => selectedVocabIds.has(id));
    setSelectedVocabIds(previous => {
      const next = new Set(previous);
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const addSelectedToVocabList = async () => {
    const ids = selectedVocabIds.size ? selectedVocabIds : new Set(projectVocab.map(item => item.id));
    if (ids.size === 0) return;
    await updateVocabItems(items.map(item => ids.has(item.id)
      ? { ...item, status: 'Studying' as const, updatedAt: Date.now() }
      : item));
    alert(`Đã đưa ${ids.size} vocab vào Vocab List.`);
  };

  const practiceIds = async (ids: string[], label: string) => {
    if (!selectedProject || ids.length === 0) return;
    sessionStorage.setItem(PRACTICE_SELECTION_STORAGE_KEY, JSON.stringify({
      ids,
      label,
      source: 'reading-project',
      createdAt: Date.now(),
    }));
    await updateProject({ ...selectedProject, lastStudiedAt: Date.now(), updatedAt: Date.now() });
    setCurrentView('practice');
  };

  const deleteCurrentProject = async () => {
    if (!selectedProject) return;
    if (!confirm(`Xoá project "${selectedProject.name}"? Vocab global sẽ không bị xoá, chỉ gỡ liên kết project.`)) return;
    await removeReadingProject(selectedProject.id);
    setSelectedProjectId(null);
  };

  if (!selectedProject) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold text-[#2D5A27]">Reading Projects</h2>
            <p className="text-gray-500 font-medium mt-1">Mỗi bài đọc là một project: sources → extracted reading → vocab → practice.</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-5 py-3 bg-[#A5D6A7] text-[#2D5A27] font-extrabold rounded-xl border-thin hover:bg-[#81C784]">
            <Plus size={19} /> New Project
          </button>
        </header>

        <div className="rounded-2xl bg-blue-50 border border-blue-100 px-5 py-4 text-sm font-semibold text-blue-700">
          Mở project chỉ tải bản Extracted Reading đã lưu. Gemini chỉ được gọi khi bạn bấm <b>Extract</b> hoặc <b>Re-extract</b> để tiết kiệm quota.
        </div>

        <div className="bg-white rounded-2xl border-thin card-shadow p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-1">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input value={projectSearch} onChange={event => setProjectSearch(event.target.value)} placeholder="Search project..." className="w-full pl-9 pr-3 py-3 rounded-xl bg-gray-50 border-thin font-semibold focus:outline-none" />
          </div>
          <select value={projectTopicFilter} onChange={event => setProjectTopicFilter(event.target.value)} className="px-4 py-3 bg-gray-50 border-thin rounded-xl font-bold text-gray-600">
            <option>All Topics</option>
            {projectTopics.map(topic => <option key={topic}>{topic}</option>)}
          </select>
          <select value={projectSort} onChange={event => setProjectSort(event.target.value as ProjectSort)} className="px-4 py-3 bg-gray-50 border-thin rounded-xl font-bold text-gray-600">
            <option value="updated">Recently updated</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="az">A → Z</option>
            <option value="za">Z → A</option>
            <option value="most-vocab">Most vocabulary</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredProjects.map(project => {
            const sources = readingSources.filter(source => source.projectId === project.id);
            return (
              <button key={project.id} onClick={() => setSelectedProjectId(project.id)} className="text-left bg-white rounded-[2rem] border-thin card-shadow p-5 hover:ring-2 hover:ring-[#A5D6A7] transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><FolderOpen size={23} /></div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">{project.topic}</span>
                </div>
                <h3 className="text-xl font-black text-[#2D5A27] mt-4 break-words">{project.name}</h3>
                <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                  <div className="rounded-xl bg-gray-50 p-3"><div className="font-black text-gray-800">{sources.length}</div><div className="text-gray-400 font-semibold">Sources</div></div>
                  <div className="rounded-xl bg-green-50 p-3"><div className="font-black text-green-700">{project.vocabIds.length}</div><div className="text-green-500 font-semibold">Vocabulary</div></div>
                </div>
                <p className="mt-4 text-xs font-semibold text-gray-400">Updated {new Date(project.updatedAt).toLocaleDateString()}</p>
              </button>
            );
          })}
        </div>

        {filteredProjects.length === 0 && (
          <div className="py-16 text-center rounded-[2rem] border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400 font-bold">
            Chưa có Reading Project phù hợp.
          </div>
        )}

        {showCreate && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90dvh] overflow-y-auto card-shadow">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div><h3 className="text-2xl font-black text-gray-800">New Reading Project</h3><p className="text-sm text-gray-400 font-semibold">Ảnh, PDF nhỏ hoặc text.</p></div>
                <button onClick={resetCreateForm} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400"><X /></button>
              </div>
              <div className="p-6 space-y-4">
                <input value={projectName} onChange={event => setProjectName(event.target.value)} placeholder="Project name, e.g. Reading 01 - Cybercrime" className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 font-bold" />
                <input value={projectTopic} onChange={event => setProjectTopic(event.target.value)} placeholder="Topic, e.g. Technology" className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 font-semibold" />
                <label className="block rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50 p-5 cursor-pointer">
                  <div className="flex items-center gap-3 text-blue-700 font-extrabold"><Upload size={20} /> Upload multiple images / PDF</div>
                  <p className="text-xs text-blue-500 font-semibold mt-2">Ảnh sẽ được nén trước khi lưu. PDF nên dưới khoảng 650 KB.</p>
                  <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={event => setProjectFiles(Array.from(event.target.files || []))} />
                  {projectFiles.length > 0 && <div className="mt-3 text-sm font-bold text-blue-700">{projectFiles.map(file => file.name).join(', ')}</div>}
                </label>
                <textarea value={projectText} onChange={event => setProjectText(event.target.value)} placeholder="Hoặc paste reading text ở đây..." rows={7} className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 font-medium resize-y" />
              </div>
              <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                <button onClick={resetCreateForm} className="px-5 py-3 rounded-xl bg-gray-100 text-gray-500 font-bold">Cancel</button>
                <button onClick={createProject} disabled={isSavingProject} className="px-6 py-3 rounded-xl bg-[#A5D6A7] text-[#2D5A27] font-extrabold disabled:opacity-50 flex items-center gap-2">
                  {isSavingProject ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />} Create Project
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const selectedProjectSourceFor = (item: VocabItem) => item.projectSources?.find(source => source.projectId === selectedProject.id);
  const selectedIdsForPractice = selectedVocabIds.size > 0
    ? Array.from(selectedVocabIds)
    : projectVocab.map(item => item.id);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button onClick={() => setSelectedProjectId(null)} className="p-3 rounded-xl bg-white border-thin text-gray-500 hover:bg-gray-50"><ArrowLeft size={20} /></button>
          <div>
            <h2 className="text-3xl font-extrabold text-[#2D5A27] break-words">{selectedProject.name}</h2>
            <p className="text-gray-500 font-semibold mt-1">{selectedProject.topic} · {projectSources.length} sources · {projectVocab.length} vocab</p>
          </div>
        </div>
        <button onClick={deleteCurrentProject} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 font-bold"><Trash2 size={18} /> Delete Project</button>
      </header>

      <section className="bg-white rounded-[2rem] border-thin card-shadow p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="text-xl font-black text-gray-800">1. Original Sources</h3><p className="text-sm text-gray-400 font-semibold">Lưu source để sau này có thể Re-extract.</p></div>
          <button onClick={() => addSourceInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 text-blue-700 font-bold border border-blue-100"><Plus size={17} /> Add Images / PDF</button>
          <input ref={addSourceInputRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={event => { addSourcesToProject(Array.from(event.target.files || [])); event.currentTarget.value = ''; }} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projectSources.map(source => (
            <div key={source.id} className="relative rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden min-h-36">
              {source.type === 'image' && source.dataUrl ? (
                <img src={source.dataUrl} alt={source.name} className="w-full h-40 object-cover" />
              ) : source.type === 'text' ? (
                <div className="p-4 h-40 overflow-hidden text-sm text-gray-600 whitespace-pre-wrap"><FileText className="mb-2 text-blue-500" />{source.text}</div>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-red-500 font-bold"><FileText size={34} /><span className="mt-2">PDF</span></div>
              )}
              <div className="p-3 flex items-center justify-between gap-2 bg-white"><span className="text-xs font-bold text-gray-500 truncate">{source.name}</span><button onClick={() => removeSource(source.id)} className="text-red-400 hover:text-red-600"><X size={16} /></button></div>
            </div>
          ))}
          {projectSources.length === 0 && <div className="col-span-full rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center text-gray-400 font-bold">No sources</div>}
        </div>
      </section>

      <section className="bg-white rounded-[2rem] border-thin card-shadow p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="text-xl font-black text-gray-800">2. Extracted Reading</h3><p className="text-sm text-gray-400 font-semibold">Bản này được lưu. Mở project không gọi AI lại.</p></div>
          <div className="flex flex-wrap gap-2">
            <button onClick={saveEditedReading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 border-thin text-gray-600 font-bold"><Save size={17} /> Save Text</button>
            <button onClick={runReadingExtraction} disabled={isExtractingReading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-50 border border-purple-100 text-purple-700 font-bold disabled:opacity-50">
              {isExtractingReading ? <Loader2 size={17} className="animate-spin" /> : selectedProject.extractedText ? <RefreshCw size={17} /> : <Sparkles size={17} />}
              {selectedProject.extractedText ? 'Re-extract' : 'Extract Reading'}
            </button>
          </div>
        </div>
        <textarea value={editedReading} onChange={event => setEditedReading(event.target.value)} placeholder="Extracted reading will appear here. You can also edit it manually." rows={15} className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-200 font-medium leading-relaxed resize-y focus:outline-none focus:border-[#A5D6A7]" />
        {selectedProject.lastExtractedAt && <p className="text-xs text-gray-400 font-semibold">Last extracted: {new Date(selectedProject.lastExtractedAt).toLocaleString()}</p>}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="text-xl font-black text-gray-800">3. Vocabulary from this Reading</h3><p className="text-sm text-gray-400 font-semibold">Từ trùng được link project/source, không tạo record mới.</p></div>
          <button onClick={runVocabExtraction} disabled={isExtractingVocab || !editedReading.trim()} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-purple-500 text-white font-extrabold disabled:opacity-50">
            {isExtractingVocab ? <Loader2 size={18} className="animate-spin" /> : selectedProject.lastVocabExtractedAt ? <RefreshCw size={18} /> : <Sparkles size={18} />}
            {selectedProject.lastVocabExtractedAt ? 'Re-extract Vocab' : 'Extract Vocab'}
          </button>
        </div>

        <VocabFilterBar
          search={vocabSearch}
          onSearchChange={setVocabSearch}
          sort={vocabSort}
          onSortChange={setVocabSort}
          topic={vocabTopic}
          onTopicChange={setVocabTopic}
          topics={vocabTopics}
          source={vocabSource}
          onSourceChange={setVocabSource}
          sources={vocabSources}
          status={vocabStatus}
          onStatusChange={setVocabStatus}
        />

        <div className="bg-white rounded-2xl border-thin card-shadow p-4 flex flex-wrap items-center gap-3">
          <button onClick={toggleAllVisibleVocab} className="px-4 py-2.5 rounded-xl bg-gray-50 border-thin text-gray-600 font-bold">Select visible ({filteredProjectVocab.length})</button>
          <button onClick={addSelectedToVocabList} disabled={projectVocab.length === 0} className="px-4 py-2.5 rounded-xl bg-[#E8F5E9] border border-[#A5D6A7] text-[#2D5A27] font-bold disabled:opacity-40">Add {selectedVocabIds.size ? 'selected' : 'all'} to Vocab List</button>
          <button onClick={() => practiceIds(selectedIdsForPractice, `${selectedIdsForPractice.length} vocab from ${selectedProject.name}`)} disabled={selectedIdsForPractice.length === 0} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 font-bold disabled:opacity-40"><BookOpenCheck size={17} /> Practice {selectedVocabIds.size ? 'Selected' : 'This Project'}</button>
          <span className="ml-auto text-sm font-bold text-purple-700 bg-purple-50 px-3 py-2 rounded-xl">Selected {selectedVocabIds.size}/{projectVocab.length}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjectVocab.map(item => {
            const projectSource = selectedProjectSourceFor(item);
            return (
              <label key={item.id} className={`bg-white rounded-[1.75rem] border-thin card-shadow p-5 cursor-pointer ${selectedVocabIds.has(item.id) ? 'ring-2 ring-[#A5D6A7]' : ''}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={selectedVocabIds.has(item.id)} onChange={() => toggleVocab(item.id)} className="mt-1" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><h4 className="text-xl font-black text-[#2D5A27]">{item.word}</h4><span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-600">{formatBand(item.band)}</span><span className="text-xs font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-600">{item.status}</span></div>
                    <p className="mt-2 font-bold text-gray-700">{item.meaning}</p>
                    {item.definition && <p className="mt-1 text-sm text-gray-500">{item.definition}</p>}
                    {projectSource?.sourceSentence && (
                      <div className="mt-3 rounded-xl bg-amber-50 border border-amber-100 p-3 text-sm text-amber-800"><span className="font-extrabold">Found in:</span> “{projectSource.sourceSentence}”</div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-gray-400"><span>{item.topic}</span><span>•</span><span>{item.source}</span>{(item.projectIds?.length || 0) > 1 && <><span>•</span><span>{item.projectIds?.length} projects</span></>}</div>
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        {projectVocab.length === 0 && (
          <div className="rounded-[2rem] border-2 border-dashed border-gray-200 bg-gray-50 py-14 text-center text-gray-400 font-bold">Chưa có vocab. Extract Reading → kiểm tra text → Extract Vocab.</div>
        )}
      </section>
    </div>
  );
}
