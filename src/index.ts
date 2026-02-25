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
import { ExpandVocabArgsSchema, ExpandVocabArgs } from "./types.js";
import { expandVocab } from "./tools/expand_vocab.js";

// 從環境變數讀取 API Key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

if (!GEMINI_API_KEY) {
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
      const result = await expandVocab(validatedArgs, GEMINI_API_KEY);

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
