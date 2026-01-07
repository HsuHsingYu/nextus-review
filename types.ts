
export enum SourceType {
  GITHUB = 'GitHub',
  CHATGPT = 'ChatGPT',
  CLAUDE = 'Claude',
  GEMINI = 'Gemini',
  NOTION = 'Notion',
  CURSOR = 'Cursor',
  PERPLEXITY = 'Perplexity',
  OTHER = 'Other'
}

export enum Category {
  CODING = '程式開發',
  WRITING = '寫作產出',
  LEARNING = '學習成長',
  PLANNING = '專案規劃',
  RESEARCH = '資料研究',
  UNCATEGORIZED = '未分類'
}

export interface ActivityItem {
  id: string;
  source: SourceType;
  rawContent: string; 
  date?: string; 
  
  // Gemini enriched fields (Simplified)
  inferredDate?: string;
  analyzed: boolean; // True if date check is done
  summary?: string; // Optional short summary
  tags?: string[];
  category?: Category;
  impactScore?: number;
  
  // User control
  ignored?: boolean; // If true, exclude from monthly review
}

export interface MonthlyStory {
  monthKey: string; // Format: "YYYY-MM"
  title: string;    // e.g. "研究/作業實作環境與實驗資料整理"
  content: string;  // The full narrative text
}

export interface ChartData {
  name: string;
  value: number;
}
