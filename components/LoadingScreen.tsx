import React, { useEffect, useState } from 'react';
import { ActivityItem } from '../types';
import { Sparkles, Loader2, Quote, FolderOpen } from 'lucide-react';

interface LoadingScreenProps {
  mode: 'fixing' | 'generating' | 'importing';
  currentStep: number;
  totalSteps: number;
  currentLabel: string;
  activities?: ActivityItem[];
}

const QUOTES = [
    "未經審視的生活是不值得過的。 — 蘇格拉底",
    "溫故而知新，可以為師矣。 — 孔子",
    "經驗不是發生在你身上的事，而是你如何看待發生在你身上的事。 — Aldous Huxley",
    "進步不可能沒有改變，那些無法改變心意的人什麼都改變不了。 — Bernard Shaw",
    "寫作是為了讓思緒清晰，復盤是為了讓行動精準。",
    "不要回頭看，除非是為了吸取教訓。",
    "記憶是靈魂的日記。 — 王爾德",
    "每一筆紀錄，都是你成長的軌跡。",
    "過去的數據，是未來的導航。",
    "讓 AI 幫你整理思緒，讓大腦專注於創造。"
];

const LoadingScreen: React.FC<LoadingScreenProps> = ({ mode, currentStep, totalSteps, currentLabel }) => {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [quoteFade, setQuoteFade] = useState(true);

  // Rotate Quotes
  useEffect(() => {
    const interval = setInterval(() => {
        setQuoteFade(false);
        setTimeout(() => {
            setQuoteIndex(prev => (prev + 1) % QUOTES.length);
            setQuoteFade(true);
        }, 500);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const progress = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0;
  
  const getIcon = () => {
      switch(mode) {
          case 'importing': return <FolderOpen className="w-5 h-5 text-blue-400 animate-pulse" />;
          case 'generating': return <Sparkles className="w-5 h-5 text-yellow-400 animate-spin-slow" />;
          default: return <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />;
      }
  };

  const getTitle = () => {
      switch(mode) {
          case 'importing': return '匯入資料庫';
          case 'generating': return '撰寫年度故事';
          default: return '校正時間軸';
      }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-up">
      <div className="max-w-4xl mx-auto bg-slate-800/95 backdrop-blur-md border border-slate-700 shadow-2xl rounded-2xl overflow-hidden flex flex-col md:flex-row items-center">
        
        {/* Left: Progress & Status */}
        <div className="flex-1 p-4 w-full md:w-auto flex items-center gap-4">
            <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
                    {getIcon()}
                </div>
                <div className="absolute -top-1 -right-1 bg-slate-700 text-[10px] text-white px-1.5 rounded-full border border-slate-600">
                    {progress}%
                </div>
            </div>
            
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                    <h3 className="text-sm font-bold text-slate-200">{getTitle()}</h3>
                    <span className="text-xs font-mono text-slate-500">{currentStep}/{totalSteps}</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden mb-2">
                    <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
                <p className="text-xs text-indigo-300 truncate font-medium animate-pulse">
                   正在處理：{currentLabel}
                </p>
            </div>
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px h-12 bg-slate-700/50 mx-2"></div>

        {/* Right: Quote Area */}
        <div className="w-full md:w-1/2 bg-slate-900/50 p-4 flex items-center justify-center md:justify-start gap-3 border-t md:border-t-0 border-slate-700/50">
             <Quote className="w-8 h-8 text-slate-600 shrink-0 opacity-40" />
             <p className={`text-sm text-slate-400 italic font-serif transition-opacity duration-500 ${quoteFade ? 'opacity-100' : 'opacity-0'}`}>
                 {QUOTES[quoteIndex]}
             </p>
        </div>

      </div>
    </div>
  );
};

export default LoadingScreen;