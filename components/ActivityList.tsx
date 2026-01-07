import React, { useMemo, useState } from 'react';
import { ActivityItem, SourceType, MonthlyStory } from '../types';
import { 
  Github, Bot, Database, Edit3, Trash2, Sparkles, ChevronDown, ChevronRight, CheckSquare, Square, Copy, RefreshCw, Loader2, AlertTriangle 
} from 'lucide-react';
import { QuoteDisplay } from './QuoteDisplay';

interface ActivityListProps {
  items: ActivityItem[];
  stories: Record<string, MonthlyStory>;
  onDelete: (id: string) => void;
  onGenerateStory: (monthKey: string, items: ActivityItem[]) => void;
  onToggleIgnore: (id: string) => void;
  isGenerating: Record<string, boolean>;
}

const SourceIcon = ({ source }: { source: SourceType }) => {
  switch (source) {
    case SourceType.GITHUB: return <Github className="w-3 h-3" />;
    case SourceType.NOTION: return <Database className="w-3 h-3" />;
    case SourceType.CLAUDE:
    case SourceType.CHATGPT:
    case SourceType.GEMINI:
    case SourceType.PERPLEXITY:
      return <Bot className="w-3 h-3" />;
    default: return <Edit3 className="w-3 h-3" />;
  }
};

const ActivityList: React.FC<ActivityListProps> = ({ items, stories, onDelete, onGenerateStory, onToggleIgnore, isGenerating }) => {
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => {
      setExpandedMonths(prev => ({...prev, [key]: !prev[key]}));
  };

  const copyMonthContent = (monthKey: string, story: MonthlyStory) => {
      const text = `${monthKey} | ${story.title}\n\n${story.content}`;
      navigator.clipboard.writeText(text);
      alert(`已複製 ${monthKey} 復盤內容！\n請直接在 Notion 貼上即可。`);
  };

  const groupedItems = useMemo(() => {
    // Sort items by date desc
    const sorted = [...items].sort((a, b) => 
        new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
    );

    const groups: Record<string, ActivityItem[]> = {};
    sorted.forEach(item => {
        const date = item.date ? new Date(item.date) : new Date();
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });
    
    // Sort keys (months) strictly by date
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="text-center py-20 bg-slate-800/50 rounded-xl border border-slate-700 border-dashed">
        <p className="text-slate-500">尚未加入足跡。</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      {groupedItems.map(([monthKey, monthItems]) => {
          const [year, month] = monthKey.split('-');
          const story = stories[monthKey];
          const isGen = isGenerating[monthKey];
          const activeCount = monthItems.filter(i => !i.ignored).length;
          
          // Check for failed state
          const isFailed = story && (story.title === '生成失敗' || story.title === '生成不完整');

          return (
            <div key={monthKey} className="relative pl-0 md:pl-8 border-l-0 md:border-l-2 border-slate-700/50">
                {/* Timeline Dot */}
                <div className={`hidden md:block absolute -left-[9px] top-0 w-4 h-4 rounded-full border-4 border-slate-900 transition-colors ${isGen ? 'bg-yellow-400 animate-pulse' : isFailed ? 'bg-red-500' : 'bg-indigo-500'}`}></div>
                
                {/* Header */}
                <div className="flex items-baseline gap-4 mb-6">
                     <h3 className="text-4xl font-bold text-white font-mono tracking-tight opacity-90">{year}/{month}</h3>
                     {story && !isGen && !isFailed && (
                         <span className="text-xl text-slate-400 font-medium border-l border-slate-600 pl-4 py-1">
                             {story.title}
                         </span>
                     )}
                     {isFailed && !isGen && (
                         <span className="text-xl text-red-400 font-medium border-l border-slate-600 pl-4 py-1 flex items-center gap-2">
                             <AlertTriangle className="w-5 h-5" />
                             生成失敗
                         </span>
                     )}
                </div>

                {/* Main Story Card */}
                <div className={`rounded-2xl border overflow-hidden shadow-xl mb-6 transition-all duration-300 ${
                    isGen ? 'bg-slate-800/80 border-indigo-500/50 shadow-indigo-500/10' : 
                    isFailed ? 'bg-red-950/20 border-red-500/30' : 
                    'bg-slate-800 border-slate-700'
                }`}>
                    
                    {isGen ? (
                        // GENERATING STATE
                        <div className="p-12 flex flex-col items-center justify-center text-center space-y-6 min-h-[300px]">
                            <div className="relative">
                                <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
                                <Sparkles className="w-12 h-12 text-yellow-400 animate-spin-slow relative z-10" />
                            </div>
                            <div>
                                <h4 className="text-xl font-bold text-white mb-2">正在撰寫年度故事...</h4>
                                <p className="text-slate-400 text-sm">AI 正在閱讀您的 {activeCount} 筆活動紀錄</p>
                            </div>
                            <div className="w-full max-w-lg border-t border-slate-700/50 pt-6">
                                <QuoteDisplay />
                            </div>
                        </div>
                    ) : isFailed ? (
                        // FAILED STATE (NEW DESIGN)
                        <div className="p-8 flex flex-col items-center justify-center text-center space-y-6">
                             <div className="bg-red-500/10 p-4 rounded-full">
                                <AlertTriangle className="w-12 h-12 text-red-500" />
                            </div>
                            <div className="max-w-lg">
                                <h4 className="text-xl font-bold text-red-100 mb-2">生成失敗</h4>
                                <p className="text-slate-400 text-sm">
                                    這可能是因為 API 流量限制或內容過於龐大。請稍後再試。
                                </p>
                            </div>
                            <button
                                onClick={() => onGenerateStory(monthKey, monthItems)}
                                className="w-full max-w-xs bg-red-600 hover:bg-red-500 text-white px-6 py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-red-900/20 flex items-center justify-center gap-3"
                            >
                                <RefreshCw className="w-6 h-6" />
                                重新生成 {month} 月內容
                            </button>
                        </div>
                    ) : story ? (
                        // COMPLETED STATE
                        <div className="p-6 md:p-8">
                            <div className="flex justify-between items-center mb-6 border-b border-slate-700/50 pb-4">
                                <div className="flex items-center gap-2">
                                     <Sparkles className="w-4 h-4 text-indigo-400" />
                                     <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">AI 復盤報告</span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => copyMonthContent(monthKey, story)}
                                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-200 hover:text-white hover:bg-slate-700 bg-slate-700/50 rounded-lg transition-all border border-slate-600 hover:border-slate-500"
                                    >
                                        <Copy className="w-4 h-4" />
                                        一鍵複製 (Notion)
                                    </button>
                                    <button 
                                        onClick={() => onGenerateStory(monthKey, monthItems)}
                                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-700 rounded-lg transition-colors"
                                        title="重新生成"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="prose prose-invert prose-p:text-slate-300 prose-li:text-slate-300 prose-headings:text-indigo-200 prose-strong:text-indigo-100 max-w-none">
                                <div className="whitespace-pre-line text-[15px] md:text-base leading-relaxed">
                                    {story.content}
                                </div>
                            </div>
                        </div>
                    ) : (
                        // EMPTY STATE
                        <div className="p-8 flex flex-col items-center justify-center text-center space-y-4">
                            <div className="bg-slate-900/50 p-4 rounded-full">
                                <Sparkles className="w-8 h-8 text-slate-500" />
                            </div>
                            <div>
                                <h4 className="text-slate-200 font-medium">尚未生成月度復盤</h4>
                                <p className="text-sm text-slate-500 mt-1">
                                    有 {activeCount} 筆有效紀錄（{monthItems.length - activeCount} 筆被隱藏）。
                                </p>
                            </div>
                            <button
                                onClick={() => onGenerateStory(monthKey, monthItems)}
                                disabled={activeCount === 0}
                                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-6 py-2 rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                            >
                                <Sparkles className="w-4 h-4" />
                                生成 {month} 月復盤
                            </button>
                        </div>
                    )}
                </div>

                {/* Raw Logs Accordion */}
                <div>
                    <button 
                        onClick={() => toggleExpand(monthKey)}
                        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors mb-3 select-none"
                    >
                        {expandedMonths[monthKey] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        選擇資料來源 ({activeCount}/{monthItems.length})
                    </button>

                    {expandedMonths[monthKey] && (
                        <div className="space-y-1 border-l border-slate-700 ml-2 pl-4 py-2">
                             <p className="text-xs text-slate-500 mb-3 ml-1">點擊整行即可切換是否納入分析。</p>
                            {monthItems.map(item => (
                                <div 
                                    key={item.id} 
                                    onClick={() => onToggleIgnore(item.id)}
                                    className={`group flex items-start gap-3 p-2 -mx-2 rounded-lg cursor-pointer transition-all ${
                                        item.ignored 
                                            ? 'opacity-50 hover:bg-slate-800/30' 
                                            : 'hover:bg-slate-800/50 text-slate-300 hover:text-white'
                                    }`}
                                >
                                    <div className="mt-0.5 shrink-0 transition-colors">
                                        {item.ignored ? (
                                            <Square className="w-4 h-4 text-slate-600" />
                                        ) : (
                                            <CheckSquare className="w-4 h-4 text-indigo-500" />
                                        )}
                                    </div>
                                    <div className="mt-1 opacity-50 shrink-0" title={item.source}>
                                        <SourceIcon source={item.source} />
                                    </div>
                                    <span className="font-mono text-xs opacity-50 shrink-0 mt-0.5">
                                        {new Date(item.date!).getDate().toString().padStart(2, '0')}日
                                    </span>
                                    <p className="line-clamp-1 flex-1 break-all select-none">
                                        {item.summary || item.rawContent}
                                    </p>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(item.id);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded transition-all"
                                        title="刪除此紀錄"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
          );
      })}
    </div>
  );
};

export default ActivityList;