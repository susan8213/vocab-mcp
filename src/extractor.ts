/**
 * 詞彙抽取器
 * 使用 LLM 從純文字中抽取指定 CEFR 等級的單字與片語
 */

import { GoogleGenAI } from "@google/genai";
import { CEFRLevel, VocabItemInput } from "./types.js";
import { debugLog } from "./debug.js";
import { config } from "./config.js";

/**
 * 建立抽取提示詞
 */
function createExtractionPrompt(
  text: string,
  level: CEFRLevel,
  maxItems: number
): string {
  // 文字過長時截斷（Gemini 2.0 Flash 支援 1M token，但實務上文章幾千字即可）
  const truncated = text.length > 8000 ? text.slice(0, 8000) + "\n...[truncated]" : text;

  return `你是一個 IELTS 英語教學專家。請從以下文章中，抽取適合 CEFR ${level} 等級學習者的英文單字與片語。

## 抽取規則
- 只選符合 ${level} 等級的詞彙（不要太簡單也不要太難）
- 優先選在 IELTS 寫作或口說中實用的詞彙
- 包含動詞片語、名詞片語等多字詞組（如："take into account", "in terms of"）
- 每個詞彙提供其在文章中的原始語境句子（context）
- 去除人名、地名、縮寫等專有名詞
- 最多抽取 ${maxItems} 個詞彙
- lemma 請還原為原型（動詞用原形、名詞用單數）

## 輸出格式
請以 JSON 陣列回應，格式如下：
[
  {
    "lemma": "resilience",
    "pos": "noun",
    "level": "${level}",
    "context": "The resilience of local communities was put to the test."
  }
]

pos 可選值：noun, verb, adjective, adverb, phrase

## 文章內容
${truncated}`;
}

/**
 * 解析 LLM 回傳的詞彙陣列
 */
function parseExtractionResponse(responseText: string): VocabItemInput[] {
  let cleaned = responseText.trim();
  cleaned = cleaned.replace(/^```json\s*/i, "");
  cleaned = cleaned.replace(/^```\s*/i, "");
  cleaned = cleaned.replace(/\s*```$/i, "");
  cleaned = cleaned.trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      throw new Error("Expected an array from LLM response");
    }
    return parsed
      .filter((item: unknown) => {
        if (typeof item !== "object" || item === null) return false;
        const obj = item as Record<string, unknown>;
        return typeof obj.lemma === "string" && obj.lemma.trim().length > 0;
      })
      .map((item: Record<string, unknown>) => ({
        lemma: String(item.lemma).toLowerCase().trim(),
        pos: typeof item.pos === "string" ? item.pos : undefined,
        level: typeof item.level === "string" ? (item.level as CEFRLevel) : undefined,
        context: typeof item.context === "string" ? item.context : undefined,
      }));
  } catch (error) {
    throw new Error(`Failed to parse extraction response: ${error}`);
  }
}

/**
 * 使用 LLM 從純文字抽取詞彙
 */
export async function extractVocabFromText(
  text: string,
  level: CEFRLevel,
  maxItems: number,
  apiKey: string
): Promise<VocabItemInput[]> {
  const ai = new GoogleGenAI({ apiKey });

  const prompt = createExtractionPrompt(text, level, maxItems);
  debugLog("extractVocabFromText: prompt", prompt);

  const response = await ai.models.generateContent({
    model: config.extractModel,
    contents: prompt,
    config: {
      temperature: 0.3, // 低溫度讓結果更穩定
      maxOutputTokens: config.extractMaxTokens,
      responseMimeType: "application/json",
    },
  });

  debugLog("extractVocabFromText: raw response.text", response.text);

  if (!response.text) {
    throw new Error("Gemini API returned empty response");
  }

  return parseExtractionResponse(response.text);
}
