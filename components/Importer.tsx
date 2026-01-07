import React, { useState, useRef } from 'react';
import { SourceType, ActivityItem } from '../types';
import { Plus, FolderOpen, HelpCircle, ChevronDown, ChevronRight, Loader2, AlertTriangle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import { QuoteDisplay } from './QuoteDisplay';

interface ImporterProps {
  onImport: (items: ActivityItem[]) => void;
  onSetGlobalLoading: (active: boolean, mode?: 'importing', step?: number, total?: number, label?: string) => void;
  isImporting: boolean;
  loadingLabel: string;
}

const Importer: React.FC<ImporterProps> = ({ onImport, onSetGlobalLoading, isImporting, loadingLabel }) => {
  // Removed 'github' and 'cursor' tabs
  const [activeTab, setActiveTab] = useState<'manual' | 'file'>('manual');
  const [showGuide, setShowGuide] = useState<string | null>(null);
  
  // Manual Input State
  const [manualText, setManualText] = useState('');
  const [selectedSource, setSelectedSource] = useState<SourceType>(SourceType.CHATGPT);

  // File Input State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Helper: Try to parse various date formats
  const safeParseDate = (input: any, fallbackDate: Date): string => {
      if (!input) return fallbackDate.toISOString();
      if (typeof input === 'number' && input > 1000000000 && input < 20000000000) return new Date(input * 1000).toISOString();
      if (typeof input === 'number' && input > 20000000000) return new Date(input).toISOString();
      const d = new Date(input);
      if (!isNaN(d.getTime())) return d.toISOString();
      return fallbackDate.toISOString();
  };

  const handleManualImport = () => {
    if (!manualText.trim()) return;

    // INTELLIGENT KEY DETECTION
    const lines = manualText.split('\n').filter(line => line.trim().length > 0);
    const hasPotentialKey = lines.some(line => {
        const trimmed = line.trim();
        return trimmed.startsWith('AIza') && trimmed.length === 39;
    });

    if (hasPotentialKey) {
        alert("⚠️ 攔截：偵測到您可能貼上了 API Key。\n\n請勿將金鑰貼在「匯入資料」欄位，這樣會被當作日記內容儲存，且無法啟用功能。\n\n請點擊右上角的「設定」圖示來正確設定您的金鑰。");
        return;
    }

    const newItems: ActivityItem[] = lines.map(line => ({
      id: uuidv4(),
      source: selectedSource,
      rawContent: line.trim(),
      date: new Date().toISOString(),
      analyzed: false
    }));
    onImport(newItems);
    setManualText('');
  };

  const findBestTitle = (item: any): string => {
    if (item.title && typeof item.title === 'string' && item.title.trim().length > 0) return item.title;
    if (item.name && typeof item.name === 'string' && item.name.trim().length > 0) return item.name;
    if (item.summary && typeof item.summary === 'string' && item.summary.trim().length > 0) return item.summary;
    
    if (item.mapping) {
        try {
            const nodes = Object.values(item.mapping) as any[];
            const userMsg = nodes.find(n => n.message?.author?.role === 'user' && n.message?.content?.parts);
            if (userMsg) {
                const text = userMsg.message.content.parts.join(' ');
                return text.slice(0, 150);
            }
        } catch (e) {}
    }
    return "未命名對話";
  };

  const parseJsonData = (data: any, defaultSource: SourceType, fallbackDate: Date): ActivityItem[] => {
      let items: ActivityItem[] = [];
      if (Array.isArray(data)) {
          items = data.map((item: any) => {
              const itemDateRaw = item.create_time || item.created_at || item.createdAt || item.date || item.time;
              return {
                  id: uuidv4(),
                  source: defaultSource,
                  rawContent: findBestTitle(item),
                  date: safeParseDate(itemDateRaw, fallbackDate),
                  analyzed: false
              };
          });
      } else if (typeof data === 'object') {
           const potentialArrays = Object.values(data).filter(v => Array.isArray(v));
           if (potentialArrays.length > 0) {
               return parseJsonData(potentialArrays.sort((a:any, b:any) => b.length - a.length)[0], defaultSource, fallbackDate);
           }
      }
      return items;
  };
  
  const parseCsvText = (text: string, source: SourceType, fallbackDate: Date): ActivityItem[] => {
      const rows = text.split('\n').filter(r => r.trim());
      if (rows.length === 0) return [];
      return rows.slice(1).map(row => ({
          id: uuidv4(),
          source,
          rawContent: row.split(',')[0] || "CSV Item",
          date: fallbackDate.toISOString(),
          analyzed: false
      }));
  };

  const processSingleFile = async (file: File): Promise<ActivityItem[]> => {
    const fileName = file.name.toLowerCase();
    let newItems: ActivityItem[] = [];
    
    // 1. ZIP (Claude/Notion/ChatGPT)
    if (fileName.endsWith('.zip')) {
        const zip = new JSZip();
        const loadedZip = await zip.loadAsync(file);
        const files = Object.values(loadedZip.files) as any[];
        
        // Check for conversations.json (ChatGPT format)
        const chatGptFile = files.find(f => f.name.endsWith('conversations.json') || f.name.endsWith('chat.json'));
        if (chatGptFile) {
            const text = await chatGptFile.async('string');
            newItems = parseJsonData(JSON.parse(text), selectedSource, chatGptFile.date);
        } else {
             // Generic loop for other JSONs in zip
             for (const f of files) {
                 if (!f.dir) {
                     if (f.name.endsWith('.json')) {
                         const text = await f.async('string');
                         newItems.push(...parseJsonData(JSON.parse(text), selectedSource, f.date));
                     } else if (f.name.endsWith('.md')) {
                         const text = await f.async('string');
                         newItems.push({
                            id: uuidv4(),
                            source: selectedSource,
                            rawContent: `[${f.name}] ${text.slice(0, 1000)}`,
                            date: f.date.toISOString(),
                            analyzed: false
                        });
                     }
                 }
             }
        }
    } 
    // 2. JSON
    else if (fileName.endsWith('.json')) {
        const text = await file.text();
        newItems = parseJsonData(JSON.parse(text), selectedSource, new Date(file.lastModified));
    } 
    // 3. CSV
    else if (fileName.endsWith('.csv')) {
        const text = await file.text();
        newItems = parseCsvText(text, fileName.includes('notion') ? SourceType.NOTION : selectedSource, new Date(file.lastModified));
    }
    // 4. Markdown
    else if (fileName.endsWith('.md')) {
        const text = await file.text();
        newItems.push({
            id: uuidv4(),
            source: fileName.includes('notion') ? SourceType.NOTION : selectedSource,
            rawContent: `[File: ${file.name}] \n${text.slice(0, 2000)}`,
            date: new Date(file.lastModified).toISOString(),
            analyzed: false
        });
    }

    return newItems;
  };

  const handleFiles = async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      
      const files = Array.from(fileList);
      onSetGlobalLoading(true, 'importing', 0, files.length, '準備開始處理檔案...');

      const allNewItems: ActivityItem[] = [];
      try {
          for (let i = 0; i < files.length; i++) {
              onSetGlobalLoading(true, 'importing', i + 1, files.length, `分析中: ${files[i].name}`);
              await new Promise(r => setTimeout(r, 100));
              const items = await processSingleFile(files[i]);
              allNewItems.push(...items);
          }
          
          if (allNewItems.length > 0) {
              onImport(allNewItems);
          } else {
              alert("未找到可匯入的記錄。");
          }
      } catch (e) { 
          console.error(e);
          alert("部分檔案處理發生錯誤。"); 
      } 
      finally { 
          onSetGlobalLoading(false); 
      }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };

  const GuideAccordion = ({ id, title, children }: { id: string, title: string, children?: React.ReactNode }) => (
    <div className="border border-slate-700 rounded-lg overflow-hidden mb-2">
        <button 
            onClick={() => setShowGuide(showGuide === id ? null : id)}
            className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-750 transition-colors text-left"
        >
            <span className="text-sm font-medium text-indigo-300 flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                {title}
            </span>
            {showGuide === id ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
        </button>
        {showGuide === id && (
            <div className="p-4 bg-slate-900/50 text-xs text-slate-300 space-y-2 border-t border-slate-700 leading-relaxed">
                {children}
            </div>
        )}
    </div>
  );

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg transition-all duration-300">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Plus className="w-5 h-5 text-indigo-400" />
        匯入數位足跡
      </h2>

      {/* Simplified Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-700 pb-2 overflow-x-auto">
        <button onClick={() => setActiveTab('manual')} className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap ${activeTab === 'manual' ? 'bg-slate-700 text-indigo-400' : 'text-slate-400'}`}>貼上文字</button>
        <button onClick={() => setActiveTab('file')} className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap ${activeTab === 'file' ? 'bg-slate-700 text-indigo-400' : 'text-slate-400'}`}>上傳檔案</button>
      </div>

      {activeTab === 'file' && (
        <div className="space-y-4">
            <div className="mb-4">
                <GuideAccordion id="chatgpt-claude" title="ChatGPT / Claude 匯出教學">
                    <p className="font-bold text-slate-200 mb-1">ChatGPT:</p>
                    <p>Settings &gt; Data controls &gt; Export data。收到 Email 後下載 ZIP 檔，直接拖曳到下方即可。</p>
                    <div className="h-4"></div>
                    <p className="font-bold text-slate-200 mb-1">Claude:</p>
                    <p>Settings &gt; Account &gt; Export Data。下載 ZIP 檔，直接拖曳到下方即可。</p>
                </GuideAccordion>
            </div>

             <div className="flex items-center gap-2 mb-2">
                 <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value as SourceType)} className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 flex-1">
                  <option value={SourceType.CHATGPT}>ChatGPT</option>
                  <option value={SourceType.CLAUDE}>Claude</option>
                </select>
             </div>

            {isImporting ? (
                <div className="border-2 border-dashed border-indigo-500/50 bg-slate-900/50 p-8 text-center rounded-xl flex flex-col items-center justify-center min-h-[250px] animate-pulse">
                    <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
                    <h3 className="text-lg font-bold text-white mb-2">{loadingLabel || "正在處理檔案..."}</h3>
                    <div className="w-full h-px bg-slate-700/50 my-4"></div>
                    <QuoteDisplay />
                </div>
            ) : (
                <div 
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors min-h-[200px] flex flex-col items-center justify-center ${dragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-slate-900/50'}`}
                    onDragEnter={() => setDragActive(true)}
                    onDragLeave={() => setDragActive(false)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        multiple 
                        accept=".zip,.json,.csv,.txt,.md" 
                        onChange={(e) => handleFiles(e.target.files)} 
                    />
                    <FolderOpen className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm text-slate-300 font-medium">
                        點擊或拖曳檔案上傳
                    </p>
                    <p className="text-xs text-slate-500 mt-1">支援 ZIP, JSON, CSV, MD, TXT</p>
                </div>
            )}
        </div>
      )}

      {activeTab === 'manual' && (
         <div className="space-y-4">
             <div className="flex items-center gap-2 mb-2">
                 <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value as SourceType)} className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 w-full">
                  <option value={SourceType.CHATGPT}>ChatGPT</option>
                  <option value={SourceType.CLAUDE}>Claude</option>
                </select>
             </div>
             
             <div className="relative">
                 <textarea 
                    value={manualText} 
                    onChange={(e) => setManualText(e.target.value)} 
                    placeholder="直接貼上標題或內容，一行一筆..." 
                    className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:border-indigo-500 outline-none" 
                 />
                 {manualText.trim().startsWith('AIza') && (
                     <div className="absolute top-2 right-2 text-yellow-500 animate-pulse">
                         <AlertTriangle className="w-5 h-5" />
                     </div>
                 )}
             </div>

             <button onClick={handleManualImport} disabled={!manualText.trim()} className="w-full bg-indigo-600 text-white py-2 rounded-lg">加入</button>
         </div>
      )}
    </div>
  );
};

export default Importer;
