# MCP 工具開發指南

本文件以 vocab-mcp 為實作範例，說明如何從零開始建立一個 MCP Server。

---

## 1. 什麼是 MCP Tool

MCP（Model Context Protocol）讓 AI 客戶端（Claude、Copilot 等）能夠呼叫外部工具，執行它本身無法完成的事。

**適合做成 MCP 工具的事情：**
- 讀取本地檔案或資料庫
- 呼叫需要憑證的第三方 API
- 執行系統指令或 shell 腳本
- 存取私有資料來源

**不適合做成 MCP 工具的事情：**
- 只是組一個 prompt 轉發給另一個 LLM（使用者直接下指令或設定 system prompt 效果相同）
- 純粹的文字轉換（LLM 本身就能做）

---

## 2. MCP 的三個核心原語

### Tools（工具）
最常用的原語。AI 可以呼叫工具、傳入參數、取得結果。

```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "my_tool",
    description: "工具說明",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string", description: "輸入內容" }
      },
      required: ["input"]
    }
  }]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name === "my_tool") {
    const result = doSomething(args.input);
    return {
      content: [{ type: "text", text: result }]
    };
  }
});
```

工具執行失敗時，回傳 `isError: true`：

```typescript
return {
  content: [{ type: "text", text: JSON.stringify({ error: "..." }) }],
  isError: true
};
```

### Prompts（提示範本）
讓伺服器提供可重用的 prompt 範本，客戶端可帶入參數後呼叫。適合將複雜的多步驟流程打包成一個入口。

```typescript
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [{
    name: "my_prompt",
    description: "提示說明",
    arguments: [
      { name: "param", description: "參數說明", required: true }
    ]
  }]
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name === "my_prompt") {
    return {
      messages: [{
        role: "user",
        content: { type: "text", text: `請處理：${args?.param}` }
      }]
    };
  }
});
```

### Resources（資源）
讓伺服器暴露可讀取的資料來源（檔案、資料庫記錄等），AI 可以讀取其內容。本專案未實作此原語。

---

## 3. 傳輸方式：stdio

本專案使用 **stdio** 傳輸，這是最常見的本地 MCP Server 模式：

```typescript
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const transport = new StdioServerTransport();
await server.connect(transport);
```

**重要**：stdio 模式下，`stdout` 是 MCP 協定通道，所有的日誌輸出都必須寫到 `stderr`，否則會破壞協定。

```typescript
// ✅ 正確
console.error("log message");

// ❌ 錯誤 — 會污染 MCP 通訊
console.log("log message");
```

---

## 4. 建立伺服器

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

const server = new Server(
  { name: "my-mcp-server", version: "1.0.0" },
  {
    capabilities: {
      tools: {},     // 宣告支援 Tools
      prompts: {},   // 宣告支援 Prompts
    }
  }
);
```

只宣告你實際實作的原語；沒有實作的原語不要加進 `capabilities`。

---

## 5. 輸入驗證：Zod

使用 Zod 在工具執行前驗證參數，避免執行期的型別錯誤。

```typescript
import { z } from "zod";

const MyToolArgsSchema = z.object({
  text: z.string().min(1),
  level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  max_items: z.number().int().min(1).max(100).optional().default(20),
});

// 在 CallToolRequestSchema handler 中：
const validatedArgs = MyToolArgsSchema.parse(args);
```

`parse` 會在驗證失敗時拋出例外，讓錯誤在進入業務邏輯前就被攔截。

---

## 6. 專案結構建議

```
src/
├── index.ts          # Server 主程式：建立 server、註冊 handler、啟動傳輸
├── types.ts          # 所有 Zod schema 與 TypeScript 型別（單一來源）
├── config.ts         # 環境變數集中管理
├── debug.ts          # debug 日誌工具（寫到 stderr）
└── tools/
    ├── tool_a.ts     # 每個工具的業務邏輯獨立一個檔案
    └── tool_b.ts
```

`index.ts` 只負責接線（route dispatch），業務邏輯放在 `tools/` 下。

---

## 7. 環境變數管理

集中在 `config.ts` 讀取所有環境變數，其他模組從 `config` 取值，不直接讀 `process.env`：

```typescript
// src/config.ts
export const config = {
  apiKey: process.env.MY_API_KEY || "",
  model: process.env.MODEL || "default-model",
} as const;
```

在 `index.ts` 啟動時做必要性檢查：

```typescript
if (!config.apiKey) {
  console.error("Error: MY_API_KEY is required");
  process.exit(1);
}
```

---

## 8. 在 VS Code 掛載測試

```json
// .vscode/mcp.json
{
  "servers": {
    "my-mcp": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "MY_API_KEY": "..."
      }
    }
  }
}
```

開發時可用 `tsx watch` 省去每次手動重新編譯：

```json
// package.json
"scripts": {
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "typecheck": "tsc --noEmit"
}
```
