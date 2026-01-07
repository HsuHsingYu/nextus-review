import React, { useState, useEffect } from 'react';
import { Quote } from 'lucide-react';

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

export const QuoteDisplay = () => {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    // Initial random quote
    setIndex(Math.floor(Math.random() * QUOTES.length));

    const interval = setInterval(() => {
        setFade(false);
        setTimeout(() => {
            setIndex(prev => (prev + 1) % QUOTES.length);
            setFade(true);
        }, 500);
    }, 5000); 
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center text-center p-4 animate-fade-in max-w-md mx-auto">
        <Quote className="w-8 h-8 text-indigo-400 mb-3 opacity-50" />
        <p className={`text-slate-400 text-lg italic font-serif transition-opacity duration-500 min-h-[3rem] ${fade ? 'opacity-100' : 'opacity-0'}`}>
            "{QUOTES[index]}"
        </p>
    </div>
  );
};