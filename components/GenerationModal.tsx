import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Square, Play, Calendar } from 'lucide-react';

interface GenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedMonths: string[]) => void;
  availableMonths: string[]; // ['2025-01', '2025-02'...]
  stories: Record<string, any>; // To check if already generated
}

const GenerationModal: React.FC<GenerationModalProps> = ({ isOpen, onClose, onConfirm, availableMonths, stories }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Reset or pre-select when opening
  useEffect(() => {
    if (isOpen) {
      // By default, select months that haven't been generated yet, or all if everything is new
      const ungenerated = availableMonths.filter(m => !stories[m] || stories[m].title === '生成失敗');
      if (ungenerated.length > 0) {
        setSelected(new Set(ungenerated));
      } else {
        setSelected(new Set(availableMonths));
      }
    }
  }, [isOpen, availableMonths, stories]);

  if (!isOpen) return null;

  const toggleMonth = (month: string) => {
    const newSet = new Set(selected);
    if (newSet.has(month)) {
      newSet.delete(month);
    } else {
      newSet.add(month);
    }
    setSelected(newSet);
  };

  const toggleAll = () => {
    if (selected.size === availableMonths.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(availableMonths));
    }
  };

  const handleConfirm = () => {
    const sorted = Array.from(selected).sort();
    onConfirm(sorted);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              選擇要生成的月份
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              已選取 {selected.size} 個月份
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          <div className="flex justify-end mb-4">
             <button 
                onClick={toggleAll}
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
             >
                {selected.size === availableMonths.length ? (
                    <><Square className="w-3 h-3" /> 取消全選</>
                ) : (
                    <><CheckSquare className="w-3 h-3" /> 全選所有月份</>
                )}
             </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {availableMonths.map(month => {
                const isSelected = selected.has(month);
                const isGenerated = stories[month] && stories[month].title !== '生成失敗';
                
                return (
                    <div 
                        key={month}
                        onClick={() => toggleMonth(month)}
                        className={`
                            cursor-pointer rounded-lg p-3 border transition-all flex items-center justify-between
                            ${isSelected 
                                ? 'bg-indigo-600/20 border-indigo-500/50' 
                                : 'bg-slate-700/30 border-slate-700 hover:bg-slate-700/50'}
                        `}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`
                                w-5 h-5 rounded flex items-center justify-center border transition-colors
                                ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-500 bg-transparent'}
                            `}>
                                {isSelected && <CheckSquare className="w-3.5 h-3.5" />}
                            </div>
                            <span className={`text-sm font-mono ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                                {month}
                            </span>
                        </div>
                        
                        {isGenerated && (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                已完成
                            </span>
                        )}
                    </div>
                );
            })}
          </div>
          
          {availableMonths.length === 0 && (
             <div className="text-center py-8 text-slate-500 text-sm">
                目前沒有可用的月份資料。請先匯入資料。
             </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-700 bg-slate-800/50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 transition-all"
          >
            <Play className="w-4 h-4 fill-current" />
            開始生成 ({selected.size})
          </button>
        </div>
      </div>
    </div>
  );
};

export default GenerationModal;