/**
 * extract_vocab_from_text 工具
 * 從純文字中抽取指定 CEFR 等級的詞彙
 */

import { ExtractVocabFromTextArgs, ExtractVocabFromTextResult } from "../types.js";
import { extractVocabFromText } from "../extractor.js";

export async function extractVocab(
  args: ExtractVocabFromTextArgs,
  apiKey: string
): Promise<ExtractVocabFromTextResult> {
  const { text, level, max_items } = args;

  const items = await extractVocabFromText(text, level, max_items ?? 20, apiKey);

  return {
    items,
    total: items.length,
    source_length: text.length,
  };
}
