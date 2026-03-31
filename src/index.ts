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
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
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
      prompts: {},
    },
  }
);

/**
 * 列出可用 Prompts
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: "vocab_from_url",
      description: "貼上文章網址，自動擷取詞彙並建立 Notion 頁面（需要 Playwright MCP 與 Notion MCP）",
      arguments: [
        { name: "url", description: "文章網址", required: true },
        { name: "level", description: "CEFR 等級（A1–C2），預設 B2", required: false },
        { name: "max_items", description: "最多擷取幾個單字，預設 20", required: false },
        { name: "parent_database_id", description: "Notion parent database ID（選填，不填則由 agent 搜尋）", required: false },
      ],
    },
  ],
}));

/**
 * 回傳 Prompt 內容
 */
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "vocab_from_url") {
    const url = args?.url ?? "";
    const level = args?.level ?? "B2";
    const max_items = args?.max_items ?? "20";
    const parent_database_id = args?.parent_database_id ?? "";

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `You are a vocabulary learning assistant.

Process the following URL and execute all steps automatically in sequence without asking for confirmation:

URL: ${url}

## Step 1 — Fetch article
Use the Playwright MCP tool to navigate to the URL and get its visible text content.
Also extract the page title (use it as the Notion page title; fallback to the URL if unavailable).

## Step 2 — Extract vocabulary
Call \`extract_vocab_from_text\` with:
- \`text\`: the full visible text from Step 1
- \`level\`: ${level}
- \`max_items\`: ${max_items}

## Step 3 — Expand vocabulary
Pass the \`items\` array from Step 2 directly to \`expand_vocab\`.

## Step 4 — Determine target database
${parent_database_id
  ? `The target parent database ID is already provided: \`${parent_database_id}\`. Skip to Step 5.`
  : `Use the Notion MCP search tool to find available databases. Present the results to the user and ask them to choose which database the new page should be saved under. Wait for the user's selection before proceeding.`
}

## Step 5 — Create Notion page
Use the Notion MCP to create a new page under the selected parent database ID.
- Page title = article title from Step 1
- The page should contain two sections (use heading_2 blocks):
  1. **Article** — insert the **exact visible text retrieved in Step 1** as paragraph blocks, without summarizing or truncating
  2. **Vocabulary** — leave empty for now (the database will be added in Step 6)

## Step 6 — Create vocabulary database
Under the page created in Step 5, create a child inline database with the following properties:

| Property name  | Notion type  | Source field                                          |
|----------------|--------------|-------------------------------------------------------|
| Name           | title        | \`lemma\`                                             |
| Category       | multi_select | \`ielts_topics\`                                      |
| Type           | select       | \`pos\`                                               |
| AI Translation | rich_text    | \`definition_en\` + " / " + \`translation_zh\`        |
| Description    | rich_text    | \`examples_en\` joined with "\\n"                     |
| Synonyms       | rich_text    | each synonym on its own line, formatted as "- word"   |

Create one database row per vocabulary item from Step 3's output.

## Output
After all steps complete, reply with:
- The Notion page URL
- A summary table of vocabulary items added (Name / Level / AI Translation)`,
          },
        },
      ],
    };
  }

  throw new Error(`Unknown prompt: ${name}`);
});

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
