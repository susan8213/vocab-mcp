/**
 * expand_vocab 工具
 * 使用 LLM 擴充詞彙資料
 */

import { ExpandVocabArgs, ExpandVocabResult } from "../types.js";
import { expandVocabBatch } from "../llm.js";

/**
 * 執行詞彙擴充
 */
export async function expandVocab(
  args: ExpandVocabArgs,
  apiKey: string
): Promise<ExpandVocabResult> {
  const { items } = args;

  console.log(`Expanding ${items.length} vocab items...`);

  const { results, errors } = await expandVocabBatch(items, apiKey, (current: number, total: number) => {
    console.log(`Progress: ${current}/${total}`);
  });

  const errorMessages = errors.map(
    (e: { item: { lemma: string }; error: string }) => `Failed to expand "${e.item.lemma}": ${e.error}`
  );

  return {
    items: results,
    success: results.length,
    total: items.length,
    errors: errorMessages.length > 0 ? errorMessages : undefined,
  };
}
