import { z } from "zod";

/**
 * CEFR 等級
 */
export const CEFRLevels = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CEFRLevel = (typeof CEFRLevels)[number];

/**
 * 詞性 (Part of Speech)
 */
export type PartOfSpeech = 
  | "noun" 
  | "verb" 
  | "adjective" 
  | "adverb" 
  | "preposition" 
  | "conjunction" 
  | "pronoun" 
  | "interjection"
  | "phrase"
  | string;

/**
 * IELTS Topics 固定清單
 */
export const IELTSTopics = [
  "Education",
  "Technology",
  "Environment",
  "Health",
  "Work & Career",
  "Society",
  "Culture",
  "Travel & Tourism",
  "Media & Communication",
  "Crime & Law",
  "Government & Politics",
  "Economy & Business",
  "Science & Research",
  "Housing & Urban Life",
  "Transportation",
  "Family & Relationships",
  "Food & Diet",
  "Sports & Fitness",
  "Arts & Entertainment",
  "Animals & Wildlife",
  "Climate & Energy",
] as const;
export type IELTSTopic = (typeof IELTSTopics)[number];

/**
 * 輸入詞彙項目 (expand_vocab 工具的輸入)
 */
export const VocabItemInputSchema = z.object({
  lemma: z.string().min(1, "lemma is required"),
  pos: z.string().optional(),
  level: z.enum(CEFRLevels).optional(),
  context: z.string().optional(),
});
export type VocabItemInput = z.infer<typeof VocabItemInputSchema>;

/**
 * 擴充後的詞彙項目 (expand_vocab 工具的輸出)
 */
export const VocabItemExpandedSchema = z.object({
  lemma: z.string(),
  definition_en: z.string(),
  translation_zh: z.string(),
  examples_en: z.array(z.string()),
  synonyms: z.array(z.string()),
  ielts_topics: z.array(z.enum(IELTSTopics)),
});
export type VocabItemExpanded = z.infer<typeof VocabItemExpandedSchema>;

/**
 * expand_vocab 工具的輸入參數
 */
export const ExpandVocabArgsSchema = z.object({
  items: z.array(VocabItemInputSchema).min(1, "At least one item is required"),
});
export type ExpandVocabArgs = z.infer<typeof ExpandVocabArgsSchema>;

/**
 * expand_vocab 工具的輸出結果
 */
export interface ExpandVocabResult {
  items: VocabItemExpanded[];
  success: number;
  total: number;
  errors?: string[];
}

/**
 * extract_vocab_from_text 工具的輸入參數
 */
export const ExtractVocabFromTextArgsSchema = z.object({
  text: z.string().min(1, "text is required"),
  level: z.enum(CEFRLevels).describe("目標 CEFR 等級，只抽取該等級的詞彙"),
  max_items: z.number().int().min(1).max(100).optional().default(20),
});
export type ExtractVocabFromTextArgs = z.infer<typeof ExtractVocabFromTextArgsSchema>;

/**
 * extract_vocab_from_text 工具的輸出結果
 */
export interface ExtractVocabFromTextResult {
  items: VocabItemInput[];
  total: number;
  source_length: number;
}
