/**
 * LLM 客戶端
 * 用於調用 LLM API 生成詞彙擴充資料
 */

import { GoogleGenAI } from "@google/genai";
import { VocabItemInput, VocabItemExpanded, IELTSTopics } from "./types.js";

interface LLMResponse {
  definition_en: string;
  translation_zh: string;
  examples_en: string[];
  synonyms: string[];
  ielts_topics: string[];
}

/**
 * 建立 LLM 提示詞
 */
function createPrompt(item: VocabItemInput): string {
  const contextInfo = item.context ? `\n原文語境：${item.context}` : "";
  const posInfo = item.pos ? `\n詞性：${item.pos}` : "";
  const levelInfo = item.level ? `\n程度：${item.level}` : "";

  const topicsList = IELTSTopics.join(", ");

  return `請幫我擴充以下英文單字的學習資料：

單字/片語：${item.lemma}${posInfo}${levelInfo}${contextInfo}

請提供：
1. 英英釋義（Definition in English，簡潔清晰的定義）
2. 繁體中文翻譯（簡潔明確）
3. IELTS 情境例句（2-3 句，必須是適合 IELTS 考試的真實情境，涵蓋口說或寫作常見主題）
4. 同義字（2-4 個，視情況而定）
5. 適用的 IELTS 主題標籤（從以下清單選出 1-3 個最相關的）：
   ${topicsList}

請以 JSON 格式回應，格式如下：
{
  "definition_en": "A clear definition in English",
  "translation_zh": "繁體中文翻譯",
  "examples_en": [
    "Example sentence 1 in IELTS context.",
    "Example sentence 2 in IELTS context."
  ],
  "synonyms": ["synonym1", "synonym2"],
  "ielts_topics": ["Topic1", "Topic2"]
}

重要注意事項：
- examples_en 必須是 2-3 句適合 IELTS 的例句，展現真實考試情境
- ielts_topics 必須從上述清單中選擇，不可自創
- 回應必須是有效的 JSON 格式
- 不要包含任何其他文字或解釋`;
}

/**
 * 解析 LLM 回應
 */
function parseLLMResponse(responseText: string): LLMResponse {
  // 移除 markdown code block 標記（如果有）
  let cleaned = responseText.trim();
  cleaned = cleaned.replace(/^```json\s*/i, "");
  cleaned = cleaned.replace(/^```\s*/i, "");
  cleaned = cleaned.replace(/\s*```$/i, "");
  cleaned = cleaned.trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      definition_en: parsed.definition_en || "",
      translation_zh: parsed.translation_zh || "",
      examples_en: Array.isArray(parsed.examples_en) ? parsed.examples_en : [],
      synonyms: Array.isArray(parsed.synonyms) ? parsed.synonyms : [],
      ielts_topics: Array.isArray(parsed.ielts_topics) ? parsed.ielts_topics : [],
    };
  } catch (error) {
    throw new Error(`Failed to parse LLM response: ${error}`);
  }
}

/**
 * 調用 Google Gemini API（使用官方 @google/genai 套件）
 */
async function callGeminiAPI(prompt: string, apiKey: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      temperature: 0.7,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  });

  if (!response.text) {
    throw new Error("Gemini API returned empty response");
  }

  return response.text;
}

/**
 * 使用 LLM 擴充單一詞彙項目
 */
export async function expandVocabItem(
  item: VocabItemInput,
  apiKey: string
): Promise<VocabItemExpanded> {
  const prompt = createPrompt(item);
  const responseText = await callGeminiAPI(prompt, apiKey);
  const parsed = parseLLMResponse(responseText);

  // 驗證並過濾 IELTS topics（確保只包含有效的主題）
  const validTopics = parsed.ielts_topics.filter((topic) =>
    IELTSTopics.includes(topic as any)
  ) as Array<typeof IELTSTopics[number]>;

  return {
    lemma: item.lemma,
    definition_en: parsed.definition_en,
    translation_zh: parsed.translation_zh,
    examples_en: parsed.examples_en,
    synonyms: parsed.synonyms,
    ielts_topics: validTopics,
  };
}

/**
 * 批次擴充詞彙項目（逐一處理，避免超過 rate limit）
 */
export async function expandVocabBatch(
  items: VocabItemInput[],
  apiKey: string,
  onProgress?: (current: number, total: number) => void
): Promise<{
  results: VocabItemExpanded[];
  errors: Array<{ item: VocabItemInput; error: string }>;
}> {
  const results: VocabItemExpanded[] = [];
  const errors: Array<{ item: VocabItemInput; error: string }> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const expanded = await expandVocabItem(item, apiKey);
      results.push(expanded);
      onProgress?.(i + 1, items.length);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({ item, error: errorMessage });
      console.error(`Failed to expand vocab item "${item.lemma}":`, errorMessage);
    }

    // 添加延遲以避免觸發 rate limit（每個請求間隔 500ms）
    if (i < items.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return { results, errors };
}
