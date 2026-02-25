#!/usr/bin/env node

/**
 * Vocab MCP Server
 * HTTP/SSE 模式的 MCP 伺服器
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ExpandVocabArgsSchema, ExpandVocabArgs, ExtractVocabFromTextArgsSchema, ExtractVocabFromTextArgs } from "./types.js";
import { expandVocab } from "./tools/expand_vocab.js";
import { extractVocab } from "./tools/extract_vocab_from_text.js";
import { config } from "./config.js";

// 驗證必要的環境變數
if (!config.geminiApiKey) {
  console.error("Error: GEMINI_API_KEY environment variable is required");
  process.exit(1);
}

/**
 * 建立 MCP Server
 */
const server = new Server(
  {
    name: "vocab-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * 列出可用工具
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "expand_vocab",
        description:
          "使用 LLM 擴充詞彙資料，生成繁體中文翻譯、英文例句、同義字和 IELTS 主題標籤",
        inputSchema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              description: "要擴充的詞彙項目清單",
              items: {
                type: "object",
                properties: {
                  lemma: {
                    type: "string",
                    description: "單字或片語的原型（必填）",
                  },
                  pos: {
                    type: "string",
                    description: "詞性（選填）",
                  },
                  level: {
                    type: "string",
                    description: "CEFR 等級，如 A1, A2, B1, B2, C1, C2（選填）",
                    enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
                  },
                  context: {
                    type: "string",
                    description: "來源文章中的語境（選填）",
                  },
                },
                required: ["lemma"],
              },
              minItems: 1,
            },
          },
          required: ["items"],
        },
      },
      {
        name: "extract_vocab_from_text",
        description:
          "從純文字（由 Playwright MCP 取得的文章內容）中抽取指定 CEFR 等級的英文單字與片語，附上詞性與原文語境",
        inputSchema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "文章純文字內容（由 Playwright MCP 的 playwright_get_visible_text 取得）",
            },
            level: {
              type: "string",
              description: "目標 CEFR 等級，只抽取該等級的詞彙",
              enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
            },
            max_items: {
              type: "number",
              description: "最多回傳幾個詞彙（預設 20，最大 100）",
            },
          },
          required: ["text", "level"],
        },
      },
    ],
  };
});

/**
 * 處理工具調用
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "expand_vocab") {
    try {
      // 驗證輸入參數
      const validatedArgs = ExpandVocabArgsSchema.parse(args) as ExpandVocabArgs;

      // 執行詞彙擴充
      const result = await expandVocab(validatedArgs, config.geminiApiKey);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: errorMessage,
                success: 0,
                total: 0,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }

  if (name === "extract_vocab_from_text") {
    try {
      const validatedArgs = ExtractVocabFromTextArgsSchema.parse(args) as ExtractVocabFromTextArgs;
      const result = await extractVocab(validatedArgs, config.geminiApiKey);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: errorMessage }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

/**
 * 啟動 Server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Vocab MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
