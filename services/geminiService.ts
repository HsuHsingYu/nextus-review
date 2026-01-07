import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ActivityItem, MonthlyStory } from "../types";

// Helper for delay
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to get API Key securely
// Priority: SessionStorage (Memory only, safer) -> LocalStorage (Persisted)
const getApiKey = (): string => {
  const sessionKey = sessionStorage.getItem('nexus_gemini_key');
  if (sessionKey) return sessionKey;

  const localKey = localStorage.getItem('nexus_gemini_key');
  if (localKey) return localKey;

  throw new Error("請先設定 Gemini API Key");
};

export type ValidationResult = {
    isValid: boolean;
    message?: string;
    stage?: 'format' | 'network' | 'challenge' | 'success';
};

// Validate API Key by making a simple request
export const validateApiKey = async (key: string): Promise<ValidationResult> => {
    const trimmedKey = key.trim();
    
    // 1. Basic Syntax Check
    if (!trimmedKey) return { isValid: false, message: "請輸入金鑰" };
    if (!/^[a-zA-Z0-9\-_]+$/.test(trimmedKey)) return { isValid: false, message: "包含無效字元" };

    // 2. Length Check for Standard Google Keys (Strict 39 chars)
    if (trimmedKey.startsWith('AIza') && trimmedKey.length !== 39) {
        return { isValid: false, message: `長度錯誤 (目前 ${trimmedKey.length} 字元，Google 金鑰應為 39 字元)` };
    }

    // 2.1 Dummy Key Check (Fail Fast) - Only check specific dummy patterns, not general content
    if (/000000$/.test(trimmedKey)) {
        return { isValid: false, message: "這看起來像是無效的範例金鑰 (Placeholder)" };
    }

    const ai = new GoogleGenAI({ apiKey: trimmedKey });
    try {
        // 3. Simple Verification
        // FIX: Do NOT set maxOutputTokens for Gemini 3 models during validation.
        // If set too low without thinkingBudget, the model consumes all tokens for "thinking"
        // and returns an empty string, causing "Model response abnormal".
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: 'Reply with "OK"', 
            config: {
                temperature: 0.1,
            }
        });
        
        // 4. Content Verification
        const text = response.text || '';
        
        if (text.toUpperCase().includes('OK')) {
            return { isValid: true, stage: 'success' };
        }
        
        console.warn("API Key Validation Failed: Output mismatch", { expected: 'OK', got: text });
        return { isValid: false, message: `驗證失敗：模型回應異常 (Got: "${text.slice(0, 20)}...")` };

    } catch (error: any) {
        // Parse Google Error
        let msg = "無法連線至 Google";
        const errMsg = error.message || error.toString();

        if (errMsg.includes('400')) msg = "無效的金鑰 (400 Invalid Key)";
        else if (errMsg.includes('403')) msg = "金鑰權限不足或專案未啟用 (403)";
        else if (errMsg.includes('429')) msg = "流量限制 (429)";
        else if (errMsg.includes('API key not valid')) msg = "金鑰無效 (API key not valid)";
        
        console.warn("API Key Validation Error:", error); 
        return { isValid: false, message: msg };
    }
};

// 1. DATE CORRECTION PROMPT
const DATE_FIX_SYSTEM_INSTRUCTION = `
你的任務是從使用者的數位足跡（標題、對話內容）中，判斷該活動的「實際發生日期」。
匯入的資料可能會有錯誤的日期（例如全部都是匯出當天），你需要從內容推斷。

規則：
1. 如果內容包含明確日期（如 "2025/03/20 會議"、"2025-05-01 日記"），請提取該日期 (YYYY-MM-DD)。
2. 如果沒有明確日期，請回傳 null。
3. 提供一個極簡短的摘要 (summary)。

輸出必須是有效的 JSON。
`;

const DATE_SCHEMA: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      summary: { type: Type.STRING },
      inferredDate: { type: Type.STRING, nullable: true },
    },
    required: ['id', 'summary'],
  },
};

// 2. MONTHLY REVIEW PROMPT
const REVIEW_SYSTEM_INSTRUCTION = `
你是一位極具洞察力的「個人成長與職涯教練」，正在協助使用者進行深度的年度復盤。
你眼前是一份使用者這個月與 AI 工具（ChatGPT, Claude 等）的對話紀錄摘要。

### 核心任務：
不要只是整理「做了什麼事」，請挖掘「發生了什麼事」。
你需要像福爾摩斯一樣，透過對話的標題或片段，推敲出使用者當時面臨的處境、人際關係衝突、或重大的心理轉折。

### 分析指南：
1. **偵測人際互動與衝突**：
   - 如果使用者問「這句話什麼意思？」、「怎麼回覆比較委婉？」、「主管這樣說代表什麼？」，這代表**職場衝突或溝通協商**。請點出具體的事件（例如：與主管意見不合、處理客訴）。
   - 請分析使用者的情緒狀態（焦慮、尋求建議、憤怒）。

2. **偵測決策過程**：
   - 如果使用者在比較不同方案、查詢離職規定、或研究新技術架構，請歸納為**關鍵決策**。

3. **偵測技術與學習**：
   - 當然也要保留硬技能的產出，但請嘗試找出「為什麼要學這個」（例如：為了專案 X 的效能優化）。

### 輸出格式（Notion Markdown）：
請將內容分為三個維度，並使用 Markdown 條列式：

**🚀 關鍵事件與突破 (Highlights)**
- 記錄本月最重大的專案進展、技術突破或問題解決。

**❤️ 溝通與人際 (Interactions)**
- **(重要)** 如果偵測到「擬稿」、「修改語氣」、「詢問回覆建議」等內容，請描述當時的社交情境。
- 例如：「**主管溝通**：針對專案延期一事撰寫解釋信件，試圖化解信任危機。」

**🌱 學習與探索 (Growth)**
- 記錄新學到的技術、研究的主題或閱讀的論文。

### 注意事項：
- 語氣要專業但帶有溫度，讓使用者覺得「你真的懂我當時經歷了什麼」。
- 如果該類別沒有內容，可以省略該標題。
- 嚴禁寫「根據資料顯示...」等廢話，直接切入重點。
`;

const REVIEW_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "該月份最具代表性的一句話（例如：職場溝通的磨合期、技術架構的重構月）" },
    content: { type: Type.STRING, description: "Notion 風格的 Markdown 內容，包含事件、人際與學習三個維度" }
  },
  required: ['title', 'content']
};

export const analyzeActivities = async (activities: ActivityItem[]): Promise<ActivityItem[]> => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });

  // Use the full batch passed by the caller, do not slice internally.
  const processedActivities = [...activities];
  
  const promptData = activities.map(a => ({
    id: a.id,
    content: a.rawContent.slice(0, 200)
  }));

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: JSON.stringify(promptData),
      config: {
        systemInstruction: DATE_FIX_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: DATE_SCHEMA,
      }
    });

    const jsonText = response.text;
    if (!jsonText) return activities;

    const parsedResults = JSON.parse(jsonText);
    
    return processedActivities.map(item => {
      const result = parsedResults.find((r: any) => r.id === item.id);
      if (result) {
        return {
          ...item,
          summary: result.summary,
          date: result.inferredDate && !isNaN(Date.parse(result.inferredDate)) ? new Date(result.inferredDate).toISOString() : item.date,
          analyzed: true
        };
      }
      return item;
    });

  } catch (error) {
    console.error("Gemini Date Fix Failed:", error);
    return activities;
  }
};

export const generateMonthStory = async (items: ActivityItem[], monthKey: string): Promise<MonthlyStory> => {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    // Filter out ignored items
    const activeItems = items.filter(i => !i.ignored);

    if (activeItems.length === 0) {
        return { monthKey, title: "無有效活動", content: "本月無資料。" };
    }

    // Context Construction
    const context = activeItems.slice(0, 300).map(i => {
        const text = i.summary || i.rawContent;
        return `[${i.source}] ${text.slice(0, 500)}`; 
    }).join('\n---\n');

    let retries = 3;
    let lastError = null;

    while (retries > 0) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `月份：${monthKey}\n\n請分析以下對話紀錄，找出背後的故事、衝突與成長：\n\n${context}`,
                config: {
                    systemInstruction: REVIEW_SYSTEM_INSTRUCTION,
                    responseMimeType: "application/json",
                    responseSchema: REVIEW_SCHEMA,
                }
            });

            const result = JSON.parse(response.text || "{}");
            return {
                monthKey,
                title: result.title || "生成不完整",
                content: result.content || "AI 未能產生內容，請重試。"
            };

        } catch (error: any) {
            console.warn(`Gemini Gen Error (${monthKey}), retries left: ${retries}`, error);
            lastError = error;
            
            // Check for Rate Limit (429) or Server Error (5xx)
            // Error object structure might vary, checking multiple properties
            const isRateLimit = error.status === 429 || 
                                (error.message && error.message.includes('429')) || 
                                (error.message && error.message.includes('RESOURCE_EXHAUSTED'));

            if (isRateLimit) {
                // Wait 6-8 seconds to cool down
                await wait(6000 + (Math.random() * 2000)); 
                retries--;
            } else if (error.status >= 500) {
                await wait(2000);
                retries--;
            } else {
                // Break on client errors (400, 401 etc) unless we want to force retry
                break;
            }
        }
    }

    console.error("Gemini Review Gen Failed Final:", lastError);
    return {
        monthKey,
        title: "生成失敗",
        content: `處理時發生錯誤 (流量限制或內容過長)。\n請點擊下方紅色按鈕重新生成。`
    };
}