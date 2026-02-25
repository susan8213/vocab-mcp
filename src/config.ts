/**
 * 環境變數設定
 */

export const config = {
  geminiApiKey: process.env.GEMINI_API_KEY || "",

  // 模型設定
  expandModel: process.env.GEMINI_EXPAND_MODEL || "gemini-2.5-flash",
  extractModel: process.env.GEMINI_EXTRACT_MODEL || "gemini-2.5-flash",

  // 輸出長度
  expandMaxTokens: parseInt(process.env.EXPAND_MAX_TOKENS || "2048", 10),
  extractMaxTokens: parseInt(process.env.EXTRACT_MAX_TOKENS || "4096", 10),
} as const;
