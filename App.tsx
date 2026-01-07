import React, { useState, useEffect, useMemo } from 'react';
import { ActivityItem, MonthlyStory } from './types';
import Importer from './components/Importer';
import ActivityList from './components/ActivityList';
import LoadingScreen from './components/LoadingScreen';
import GenerationModal from './components/GenerationModal';
import ApiKeyModal from './components/ApiKeyModal';
import { analyzeActivities, generateMonthStory } from './services/geminiService';
import { 
  Sparkles, Layers, Copy, AlertCircle, RefreshCw, Zap, Settings, Key
} from 'lucide-react';

// Unified loading state type
interface ProcessState {
    active: boolean;
    mode: 'fixing' | 'generating' | 'importing';
    currentStep: number;
    totalSteps: number;
    currentLabel: string;
}

export default function App() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [stories, setStories] = useState<Record<string, MonthlyStory>>({});
  
  // Unified Process State
  const [processState, setProcessState] = useState<ProcessState>({
      active: false, mode: 'fixing', currentStep: 0, totalSteps: 0, currentLabel: ''
  });
  
  const [storyGeneratingStatus, setStoryGeneratingStatus] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  
  // Modal State
  const [isGenModalOpen, setIsGenModalOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  // Load from local storage
  useEffect(() => {
    const savedActs = localStorage.getItem('nexus_activities');
    const savedStories = localStorage.getItem('nexus_stories');
    if (savedActs) {
      try { setActivities(JSON.parse(savedActs)); } catch (e) {}
    }
    if (savedStories) {
      try { setStories(JSON.parse(savedStories)); } catch (e) {}
    }

    // Check for API Key on mount (Check both Local and Session)
    const hasKey = localStorage.getItem('nexus_gemini_key') || sessionStorage.getItem('nexus_gemini_key');
    if (!hasKey) {
        setIsApiKeyModalOpen(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('nexus_activities', JSON.stringify(activities));
  }, [activities]);
  
  useEffect(() => {
    localStorage.setItem('nexus_stories', JSON.stringify(stories));
  }, [stories]);

  const handleSaveApiKey = (key: string, isSessionOnly: boolean) => {
      if (isSessionOnly) {
          sessionStorage.setItem('nexus_gemini_key', key);
          localStorage.removeItem('nexus_gemini_key'); // Clear existing local if switching to session
      } else {
          localStorage.setItem('nexus_gemini_key', key);
          sessionStorage.removeItem('nexus_gemini_key');
      }
  };

  const handleImport = (newItems: ActivityItem[]) => {
    setActivities(prev => [...prev, ...newItems]);
  };

  const handleSetGlobalLoading = (active: boolean, mode: 'importing' = 'importing', step = 0, total = 0, label = '') => {
      setProcessState({
          active,
          mode,
          currentStep: step,
          totalSteps: total,
          currentLabel: label
      });
  };

  const handleDelete = (id: string) => {
    setActivities(prev => prev.filter(a => a.id !== id));
  };

  const handleToggleIgnore = (id: string) => {
      setActivities(prev => prev.map(item => 
          item.id === id ? { ...item, ignored: !item.ignored } : item
      ));
  };

  // Helper to get grouped data for the modal
  const availableMonths = useMemo(() => {
      const months = new Set<string>();
      activities.forEach(item => {
          if(item.ignored) return;
          const date = item.date ? new Date(item.date) : new Date();
          if(!isNaN(date.getTime())) {
              const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              months.add(key);
          }
      });
      return Array.from(months).sort();
  }, [activities]);

  // Check API Key before AI operations
  const checkApiKey = (): boolean => {
      const hasKey = localStorage.getItem('nexus_gemini_key') || sessionStorage.getItem('nexus_gemini_key');
      if (!hasKey) {
          setIsApiKeyModalOpen(true);
          return false;
      }
      return true;
  }

  const handleFixDates = async () => {
    if (!checkApiKey()) return;

    const unanalyzed = activities.filter(a => !a.analyzed);
    if (unanalyzed.length === 0) {
        alert("所有項目的日期都已確認完畢。");
        return;
    }

    setProcessState({
        active: true,
        mode: 'fixing',
        currentStep: 0,
        totalSteps: unanalyzed.length,
        currentLabel: '準備中...'
    });
    setError(null);

    try {
      // Process in batches. 
      const batchSize = 50;
      let processedCount = 0;
      let newActivities = [...activities];

      for (let i = 0; i < unanalyzed.length; i += batchSize) {
          const chunk = unanalyzed.slice(i, i + batchSize);
          
          setProcessState(prev => ({
              ...prev,
              currentStep: processedCount,
              currentLabel: `批次分析中 (${processedCount + 1}-${Math.min(processedCount + batchSize, unanalyzed.length)})`
          }));

          // Force a tiny delay to ensure React renders the loading status
          await new Promise(r => setTimeout(r, 50));

          const results = await analyzeActivities(chunk);
          
          // Update local copy first
          results.forEach(res => {
              const idx = newActivities.findIndex(a => a.id === res.id);
              if (idx !== -1) newActivities[idx] = res;
          });

          processedCount += chunk.length;
          // Update global state incrementally to save progress if crash
          setActivities([...newActivities]);
      }
    } catch (err: any) {
      setError(err.message || "分析失敗");
    } finally {
      setProcessState(prev => ({ ...prev, active: false }));
    }
  };

  // Single month generation
  const handleGenerateStory = async (monthKey: string, monthItems: ActivityItem[]) => {
      if (!checkApiKey()) return;

      setStoryGeneratingStatus(prev => ({...prev, [monthKey]: true}));
      try {
          const story = await generateMonthStory(monthItems, monthKey);
          setStories(prev => ({ ...prev, [monthKey]: story }));
      } catch (e) {
          console.error(e);
          setError("生成失敗");
      } finally {
          setStoryGeneratingStatus(prev => ({...prev, [monthKey]: false}));
      }
  };

  // The logic to OPEN the modal
  const handleOpenGenerateModal = () => {
      if (!checkApiKey()) return;

      if (activities.length === 0) {
          alert("請先匯入資料。");
          return;
      }
      if (availableMonths.length === 0) {
          alert("沒有有效的日期資料。");
          return;
      }
      setIsGenModalOpen(true);
  };

  // Batch Generation for SELECTED months
  const handleBatchGenerate = async (targetMonths: string[]) => {
      if (!checkApiKey()) return;
      setError(null);
      
      // 1. Group by month locally to get the data for generation
      const groups: Record<string, ActivityItem[]> = {};
      activities.forEach(item => {
          if (item.ignored) return;
          let dateObj = new Date();
          if (item.date) {
            const d = new Date(item.date);
            if (!isNaN(d.getTime())) dateObj = d;
          }
          const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(item);
      });

      // 2. Set State Active with immediate render
      setProcessState({
          active: true,
          mode: 'generating',
          currentStep: 0,
          totalSteps: targetMonths.length,
          currentLabel: 'AI 引擎暖身中...'
      });

      let failureCount = 0;

      // 3. Loop with explicit delay and state updates
      try {
          for (let i = 0; i < targetMonths.length; i++) {
              const monthKey = targetMonths[i];
              
              setProcessState(prev => ({
                  ...prev,
                  currentStep: i + 1,
                  currentLabel: `正在分析：${monthKey}`
              }));
              
              // CRITICAL: Set local card status so ActivityList renders the loading UI
              setStoryGeneratingStatus(prev => ({ ...prev, [monthKey]: true }));

              // Force a 3-second delay to avoid Rate Limits (429) during batch processing
              // Only delay if it's NOT the first one
              if (i > 0) {
                  await new Promise(r => setTimeout(r, 3000));
              }
              
              try {
                  const items = groups[monthKey] || [];
                  if (items.length > 0) {
                      const story = await generateMonthStory(items, monthKey);
                      setStories(prev => ({ ...prev, [monthKey]: story }));
                  }
              } catch (e) {
                  console.error(`Error generating ${monthKey}`, e);
                  failureCount++;
              } finally {
                  // Turn off local card loading
                  setStoryGeneratingStatus(prev => ({ ...prev, [monthKey]: false }));
              }
          }
      } catch (err: any) {
          console.error("Critical Generation Error", err);
          setError("生成過程發生意外中斷，請重試。");
      } finally {
          setProcessState(prev => ({ ...prev, active: false }));
          if (failureCount > 0) {
              alert(`生成完畢，但有 ${failureCount} 個月份失敗，請手動點擊該月份的重新生成。`);
          }
      }
  };

  const copyToClipboard = () => {
    const text = (Object.values(stories) as MonthlyStory[])
        .sort((a,b) => a.monthKey.localeCompare(b.monthKey))
        .map(s => `${s.monthKey} | ${s.title}\n${s.content}`)
        .join('\n\n');

    if (!text) {
        alert('請先生成內容');
        return;
    }
    navigator.clipboard.writeText(text);
    alert('已複製到剪貼簿！');
  };

  const clearAll = () => {
      if(confirm("確定要清除所有資料嗎？(包含 API Key)")) {
          setActivities([]);
          setStories({});
          localStorage.removeItem('nexus_activities');
          localStorage.removeItem('nexus_stories');
          localStorage.removeItem('nexus_gemini_key');
          sessionStorage.removeItem('nexus_gemini_key');
          window.location.reload();
      }
  }

  const unanalyzedCount = activities.filter(a => !a.analyzed).length;

  return (
    <div className="min-h-screen bg-slate-900 pb-20">
      
      <ApiKeyModal 
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onSave={handleSaveApiKey}
      />

      {/* Modal */}
      <GenerationModal 
        isOpen={isGenModalOpen}
        onClose={() => setIsGenModalOpen(false)}
        onConfirm={handleBatchGenerate}
        availableMonths={availableMonths}
        stories={stories}
      />

      {/* GLOBAL Loading Screen */}
      {processState.active && processState.mode === 'fixing' && (
          <LoadingScreen 
            mode={processState.mode}
            currentLabel={processState.currentLabel}
            currentStep={processState.currentStep}
            totalSteps={processState.totalSteps}
            activities={activities}
          />
      )}

      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/20 p-2 rounded-lg">
              <Layers className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Nexus Review</h1>
              <p className="text-xs text-slate-400">2025 年度復盤助手</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
             <button
                onClick={() => setIsApiKeyModalOpen(true)}
                className="p-2 text-slate-400 hover:text-indigo-400 transition-colors bg-slate-800 rounded-lg border border-slate-700 hover:border-indigo-500/50"
                title="設定 API Key"
             >
                 <Settings className="w-4 h-4" />
             </button>

             {activities.length > 0 && (
                 <button 
                    onClick={clearAll}
                    className="px-3 py-2 text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                    清除全部
                </button>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Actions Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">時間軸復盤</h2>
            <p className="text-slate-400 text-sm">先校正日期，勾選要保留的紀錄，再一次生成全年回顧。</p>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto flex-wrap">
            <button
                onClick={handleFixDates}
                disabled={processState.active || unanalyzedCount === 0}
                className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg font-medium transition-colors border border-slate-700 disabled:opacity-50"
            >
                {processState.active && processState.mode === 'fixing' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {processState.active && processState.mode === 'fixing' ? '校正中...' : `校正 ${unanalyzedCount} 筆日期`}
            </button>

            <button
                onClick={handleOpenGenerateModal}
                disabled={processState.active || activities.length === 0}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-2 rounded-lg font-medium shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
            >
                <Zap className="w-4 h-4 fill-yellow-300 text-yellow-300" />
                批次生成復盤
            </button>
            
            <button
              onClick={copyToClipboard}
              disabled={Object.keys(stories).length === 0}
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Copy className="w-4 h-4" />
              複製全部
            </button>
          </div>
        </div>

        {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400">
                <AlertCircle className="w-5 h-5" />
                {error}
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Input */}
          <div className="lg:col-span-1 space-y-6">
            <Importer 
                onImport={handleImport} 
                onSetGlobalLoading={handleSetGlobalLoading} 
                isImporting={processState.active && processState.mode === 'importing'}
                loadingLabel={processState.currentLabel}
            />
            
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">💡 高效復盤流程</h3>
                <ul className="text-sm text-slate-400 space-y-4">
                    <li>
                        <strong className="text-indigo-400 block mb-1">匯入 & 篩選</strong>
                        <p className="text-xs text-slate-500">
                            匯入資料後，使用 <span className="inline-block border border-slate-600 rounded px-1 text-[10px]">☑</span> 勾選框排除不重要的對話。
                        </p>
                    </li>
                    <li>
                        <strong className="text-indigo-400 block mb-1">日期校正 (選用)</strong>
                        <p className="text-xs text-slate-500">
                            若您上傳的是 ZIP/JSON 原始檔，日期通常是正確的，可直接跳過此步。若是純文字貼上，才建議校正。
                        </p>
                    </li>
                    <li>
                        <strong className="text-indigo-400 block mb-1">批次生成</strong>
                        <p className="text-xs text-slate-500">
                            點擊「批次生成復盤」，勾選您想要回顧的月份（建議一次選 3-6 個月避免等待過久），AI 將為您撰寫摘要。
                        </p>
                    </li>
                </ul>
            </div>
          </div>

          {/* Right Column: Timeline */}
          <div className="lg:col-span-2">
            <ActivityList 
                items={activities} 
                stories={stories}
                onDelete={handleDelete} 
                onGenerateStory={handleGenerateStory}
                onToggleIgnore={handleToggleIgnore}
                isGenerating={storyGeneratingStatus}
            />
          </div>
        </div>
      </main>
    </div>
  );
}