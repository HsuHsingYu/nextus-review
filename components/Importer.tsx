import React, { useState, useRef } from 'react';
import { SourceType, ActivityItem } from '../types';
import { Plus, FolderOpen, HelpCircle, ChevronDown, ChevronRight, Database, Loader2, FileText, AlertTriangle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import { QuoteDisplay } from './QuoteDisplay';

interface ImporterProps {
  onImport: (items: ActivityItem[]) => void;
  onSetGlobalLoading: (active: boolean, mode?: 'importing', step?: number, total?: number, label?: string) => void;
  // New props for local loading state
  isImporting: boolean;
  loadingLabel: string;
}

const Importer: React.FC<ImporterProps> = ({ onImport, onSetGlobalLoading, isImporting, loadingLabel }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'github' | 'file' | 'cursor'>('manual');
  const [showGuide, setShowGuide] = useState<string | null>(null);
  
  // Manual Input State - Default to ChatGPT as requested
  const [manualText, setManualText] = useState('');
  const [selectedSource, setSelectedSource] = useState<SourceType>(SourceType.CHATGPT);

  // GitHub State
  const [githubUsername, setGithubUsername] = useState('');

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
    // Check every line to see if it looks like an API Key
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

  const handleGithubImport = async () => {
    if (!githubUsername) return;
    onSetGlobalLoading(true, 'importing', 0, 1, `連線 GitHub: ${githubUsername}`);
    
    try {
      const response = await fetch(`https://api.github.com/users/${githubUsername}/events?per_page=100`);
      if (!response.ok) throw new Error('API 限制或使用者不存在');
      const events = await response.json();
      const newItems: ActivityItem[] = events.map((event: any) => {
        let content = event.type;
        if (event.type === 'PushEvent') content = `推送至 ${event.repo.name}: ${event.payload.commits?.[0]?.message || 'updates'}`;
        else if (event.type === 'CreateEvent') content = `在 ${event.repo.name} 建立 ${event.payload.ref_type}`;
        else if (event.type === 'PullRequestEvent') content = `PR ${event.payload.action} ${event.repo.name}: ${event.payload.pull_request.title}`;
        else if (event.type === 'WatchEvent') content = `Star ${event.repo.name}`;
        
        return {
          id: uuidv4(),
          source: SourceType.GITHUB,
          rawContent: content,
          date: event.created_at,
          analyzed: false
        };
      });
      onImport(newItems);
    } catch (error) {
      alert('無法讀取 GitHub 資料。建議改用 ZIP 上傳方式匯入更多歷史資料。');
    } finally {
      onSetGlobalLoading(false);
    }
  };

  const findBestTitle = (item: any): string => {
    if (item.title && typeof item.title === 'string' && item.title.trim().length > 0) return item.title;
    if (item.name && typeof item.name === 'string' && item.name.trim().length > 0) return item.name;
    if (item.summary && typeof item.summary === 'string' && item.summary.trim().length > 0) return item.summary;
    
    // 如果找不到標題，嘗試深入挖掘對話內容的第一句 User message
    if (item.mapping) {
        try {
            const nodes = Object.values(item.mapping) as any[];
            // 找出第一個 user 發送的訊息
            const userMsg = nodes.find(n => n.message?.author?.role === 'user' && n.message?.content?.parts);
            if (userMsg) {
                const text = userMsg.message.content.parts.join(' ');
                // 回傳前 150 個字，讓 AI 有更多上下文可以判斷
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

   const extractTextFromCursorJson = (obj: any): string[] => {
      const results: string[] = [];
      if (!obj) return results;
      if (typeof obj === 'string' && obj.length > 50 && !obj.startsWith('{')) results.push(obj);
      if (Array.isArray(obj)) obj.forEach(item => results.push(...extractTextFromCursorJson(item)));
      if (typeof obj === 'object') {
          if (obj.text) results.push(obj.text);
          if (obj.content) results.push(obj.content);
          Object.values(obj).forEach(val => results.push(...extractTextFromCursorJson(val)));
      }
      return results;
  };

  const processSqliteFile = async (file: File): Promise<ActivityItem[]> => {
      try {
        const buffer = await file.arrayBuffer();
        if (!(window as any).initSqlJs) return [];
        const SQL = await (window as any).initSqlJs({ locateFile: () => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.0/sql-wasm.wasm` });
        const db = new SQL.Database(new Uint8Array(buffer));
        const stmt = db.prepare("SELECT key, value FROM ItemTable");
        const newItems: ActivityItem[] = [];
        const fileDate = new Date(file.lastModified);
        while (stmt.step()) {
            const row = stmt.getAsObject();
            const value = row.value as string;
            if (value && (value.includes('chat') || value.includes('user'))) {
                try {
                    const texts = extractTextFromCursorJson(JSON.parse(value));
                    if (texts.length > 0) {
                        newItems.push({
                            id: uuidv4(),
                            source: SourceType.CURSOR,
                            rawContent: `Cursor: ${texts[0].slice(0, 200)}`,
                            date: fileDate.toISOString(),
                            analyzed: false
                        });
                    }
                } catch (e) {}
            }
        }
        stmt.free(); db.close();
        return newItems;
      } catch (err) { return []; }
  };

  const processSingleFile = async (file: File): Promise<ActivityItem[]> => {
    const fileName = file.name.toLowerCase();
    
    // 1. Cursor SQLite
    if (fileName.endsWith('.vscdb') || (activeTab === 'cursor' && !fileName.includes('.'))) {
        return await processSqliteFile(file);
    }
    
    let newItems: ActivityItem[] = [];
    
    // 2. ZIP (Claude/Notion/ChatGPT - Legacy)
    if (fileName.endsWith('.zip')) {
        const zip = new JSZip();
        const loadedZip = await zip.loadAsync(file);
        const files = Object.values(loadedZip.files) as any[];
        
        // Check for conversations.json (ChatGPT format) - fallback to selectedSource
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
    // 3. JSON (Gemini)
    else if (fileName.endsWith('.json')) {
        const text = await file.text();
        newItems = parseJsonData(JSON.parse(text), selectedSource, new Date(file.lastModified));
    } 
    // 4. CSV (Notion/Excel)
    else if (fileName.endsWith('.csv')) {
        const text = await file.text();
        newItems = parseCsvText(text, fileName.includes('notion') ? SourceType.NOTION : selectedSource, new Date(file.lastModified));
    }
    // 5. Markdown (Notion/Obsidian)
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
      // Initialize Global Loading -> App updates 'processState', passing isImporting=true back here
      onSetGlobalLoading(true, 'importing', 0, files.length, '準備開始處理檔案...');

      const allNewItems: ActivityItem[] = [];
      try {
          for (let i = 0; i < files.length; i++) {
              // Update status for current file
              onSetGlobalLoading(true, 'importing', i + 1, files.length, `分析中: ${files[i].name}`);
              
              // Give UI a moment to render
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

      <div className="flex gap-2 mb-6 border-b border-slate-700 pb-2 overflow-x-auto">
        <button onClick={() => setActiveTab('manual')} className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap ${activeTab === 'manual' ? 'bg-slate-700 text-indigo-400' : 'text-slate-400'}`}>貼上文字</button>
        <button onClick={() => setActiveTab('file')} className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap ${activeTab === 'file' ? 'bg-slate-700 text-indigo-400' : 'text-slate-400'}`}>上傳檔案</button>
        <button onClick={() => setActiveTab('cursor')} className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap ${activeTab === 'cursor' ? 'bg-slate-700 text-indigo-400' : 'text-slate-400'}`}>Cursor</button>
        <button onClick={() => setActiveTab('github')} className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap ${activeTab === 'github' ? 'bg-slate-700 text-indigo-400' : 'text-slate-400'}`}>GitHub</button>
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

            {/* TRANSFORMING DROPZONE */}
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
                        accept=".zip,.json,.csv,.txt,.md,.vscdb" 
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

      {/* Manual, Cursor, GitHub tabs... */}
      {activeTab === 'manual' && (
         <div className="space-y-4">
             <div className="flex items-center gap-2 mb-2">
                 <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value as SourceType)} className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 w-full">
                  <option value={SourceType.CHATGPT}>ChatGPT</option>
                  <option value={SourceType.CLAUDE}>Claude</option>
                </select>
             </div>
             
             {/* Key Detection Warning UI happens in alert() on click, but we can also add a hint */}
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
      {activeTab === 'cursor' && (
          <div className="space-y-4">
            <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-700 bg-slate-900/50 p-8 text-center rounded-xl cursor-pointer">
                 <input type="file" ref={fileInputRef} className="hidden" accept=".vscdb" onChange={(e) => handleFiles(e.target.files)} />
                 <Database className="w-8 h-8 text-indigo-400 mx-auto" />
                 <p className="mt-2 text-sm text-slate-300">上傳 state.vscdb</p>
                 <p className="text-xs text-slate-500 mt-1">位於 %APPDATA%/Cursor/User/globalStorage/state.vscdb</p>
            </div>
          </div>
      )}
      {activeTab === 'github' && (
           <div className="space-y-4">
               {isImporting ? (
                    <div className="border border-slate-700 bg-slate-900/50 p-6 rounded-xl flex flex-col items-center justify-center min-h-[150px]">
                        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
                        <p className="text-slate-300">{loadingLabel}</p>
                    </div>
               ) : (
                    <>
                        <input type="text" value={githubUsername} onChange={(e) => setGithubUsername(e.target.value)} placeholder="GitHub Username" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2" />
                        <button onClick={handleGithubImport} disabled={!githubUsername} className="w-full bg-slate-700 text-white py-2 rounded-lg">抓取</button>
                    </>
               )}
           </div>
      )}
    </div>
  );
};

export default Importer;