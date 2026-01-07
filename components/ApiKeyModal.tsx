import React, { useState, useEffect } from 'react';
import { Key, ExternalLink, ShieldCheck, Lock, AlertTriangle, HelpCircle, ChevronDown, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react';
import { validateApiKey } from '../services/geminiService';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string, isSessionOnly: boolean) => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave }) => {
  const [keyInput, setKeyInput] = useState('');
  const [isSessionOnly, setIsSessionOnly] = useState(false);
  const [showSecurityInfo, setShowSecurityInfo] = useState(true);
  
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  
  useEffect(() => {
    if (isOpen) {
      const savedKey = localStorage.getItem('nexus_gemini_key') || sessionStorage.getItem('nexus_gemini_key');
      if (savedKey) setKeyInput(savedKey);
      setStatus('idle');
      setStatusMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setStatus('checking');
    setStatusMsg("正在檢查金鑰格式...");
    
    const trimmed = keyInput.trim();
    
    if (!trimmed) {
        setStatus('error');
        setStatusMsg("請輸入 API Key");
        return;
    }

    try {
        setStatusMsg("正在連線至 Google 伺服器...");
        const result = await validateApiKey(trimmed);
        
        if (result.isValid) {
            setStatus('success');
            setStatusMsg("驗證成功！");
            setTimeout(() => {
                onSave(trimmed, isSessionOnly);
                onClose();
            }, 800);
        } else {
            setStatus('error');
            setStatusMsg(result.message || "驗證失敗");
        }
    } catch (e) {
        setStatus('error');
        setStatusMsg("發生未預期的錯誤");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg p-6">
        
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
            <div className={`p-3 rounded-full transition-colors ${status === 'success' ? 'bg-emerald-500/20' : 'bg-indigo-500/20'}`}>
                {status === 'success' ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                ) : (
                    <Lock className="w-6 h-6 text-indigo-400" />
                )}
            </div>
            <div>
                <h3 className="text-xl font-bold text-white">API 連線設定</h3>
                <p className="text-xs text-slate-400">Bring Your Own Key (BYOK)</p>
            </div>
        </div>

        <div className="space-y-5 mb-6">
            
            {/* Input Field */}
            <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">Gemini API Key</label>
                <div className="relative">
                    <Key className={`absolute left-3 top-3 w-4 h-4 ${status === 'error' ? 'text-red-400' : 'text-slate-500'}`} />
                    <input 
                        type="password" 
                        value={keyInput}
                        onChange={(e) => {
                            setKeyInput(e.target.value);
                            setStatus('idle');
                            setStatusMsg(null);
                        }}
                        disabled={status === 'checking' || status === 'success'}
                        placeholder="•••••••••••••••••••••••••••••••••••••••"
                        className={`w-full bg-slate-900 border rounded-lg py-2.5 pl-10 pr-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm placeholder:text-slate-600 shadow-inner ${status === 'error' ? 'border-red-500/50 focus:border-red-500' : 'border-slate-700 focus:border-indigo-500'}`}
                    />
                </div>
                
                {/* Status Message Area */}
                <div className="min-h-[24px] mt-2">
                    {status === 'checking' && (
                        <div className="flex items-center gap-2 text-indigo-400 text-xs animate-pulse">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            {statusMsg}
                        </div>
                    )}
                    {status === 'error' && (
                        <div className="flex items-start gap-2 text-red-400 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20 animate-fade-in">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span className="text-xs font-medium">{statusMsg}</span>
                        </div>
                    )}
                    {status === 'success' && (
                         <div className="flex items-center gap-2 text-emerald-400 text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {statusMsg}
                        </div>
                    )}
                </div>

                <div className="flex justify-end mt-1.5">
                     <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                    >
                        取得免費 Key <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
            </div>

            {/* Session Only Option */}
            <div 
                className="bg-slate-900/40 p-3 rounded-lg border border-slate-700/50 flex items-center gap-3 cursor-pointer hover:bg-slate-900/60 transition-colors group" 
                onClick={() => setIsSessionOnly(!isSessionOnly)}
            >
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isSessionOnly ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 bg-slate-800 group-hover:border-slate-500'}`}>
                    {isSessionOnly && <ShieldCheck className="w-3.5 h-3.5 text-white" />}
                </div>
                <div>
                    <span className={`text-sm font-medium block transition-colors ${isSessionOnly ? 'text-emerald-400' : 'text-slate-200'}`}>
                        高安全性模式 (Session Only)
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                        金鑰僅暫存於記憶體，關閉分頁即自動銷毀
                    </span>
                </div>
            </div>

            {/* Collapsible Security Explanation */}
            <div>
                <button 
                    onClick={() => setShowSecurityInfo(!showSecurityInfo)}
                    className="flex items-center gap-2 text-xs text-slate-500 hover:text-indigo-400 transition-colors w-full group"
                >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span className="font-medium">為什麼在這裡輸入是安全的？</span>
                    {showSecurityInfo ? <ChevronDown className="w-3.5 h-3.5 ml-auto" /> : <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
                </button>

                {showSecurityInfo && (
                    <div className="mt-2 p-3 bg-slate-700/30 rounded-lg text-xs text-slate-400 leading-relaxed border border-slate-700/50 animate-fade-in">
                        <p className="mb-1">
                            本專案採用 <strong>純客戶端 (Client-Side)</strong> 架構。
                        </p>
                        <p>
                             我們沒有後端伺服器，您的金鑰只會保存在您的瀏覽器中，並直接向 Google 發送請求。您可以隨時檢查開源程式碼或瀏覽器的網路請求來驗證這一點。
                        </p>
                    </div>
                )}
            </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            {(localStorage.getItem('nexus_gemini_key') || sessionStorage.getItem('nexus_gemini_key')) && status !== 'checking' && (
                 <button 
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                    取消
                </button>
            )}
            <button 
                onClick={handleSave}
                disabled={status === 'checking' || status === 'success'}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/20 text-sm flex items-center gap-2"
            >
                {status === 'checking' ? (
                    <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        驗證中...
                    </>
                ) : status === 'success' ? (
                    <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        已完成
                    </>
                ) : (
                    <>
                        <Lock className="w-3.5 h-3.5" />
                        確認並啟用
                    </>
                )}
            </button>
        </div>

      </div>
    </div>
  );
};

export default ApiKeyModal;