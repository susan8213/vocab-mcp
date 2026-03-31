# Vocab MCP

英文單字庫 MCP Server，用於從文章抽取並擴充詞彙資料。

> **開發備註：** 本專案為 MCP 工具開發的學習範例，已停止繼續開發。詳見下方說明。

## 功能

- ✅ **Tool 1: extract_vocab_from_text** - 從文章純文字中抽取指定 CEFR 等級的詞彙
  - 輸入：文章純文字（由 Playwright MCP 取得）、目標 CEFR 等級
  - 輸出：VocabItem 清單（lemma, pos, level, context）
- ✅ **Tool 2: expand_vocab** - 使用 LLM 擴充詞彙資料
  - 輸入：單字/片語清單（含 lemma, pos, level, context）
  - 輸出：繁體中文翻譯、英英定義、IELTS 例句、同義字、主題標籤

## 安裝

```bash
npm install
```

## 設定

1. 複製環境變數範例檔：
```bash
cp .env.example .env
```

2. 編輯 `.env` 並填入你的 Google Gemini API Key：
```
GEMINI_API_KEY=your_api_key_here
```

取得 API Key：<https://aistudio.google.com/apikey>

## 開發

```bash
# 開發模式（自動重啟）
npm run dev

# 型別檢查
npm run typecheck

# 建置
npm run build
```

## 使用方式

### 在 VS Code 中使用

在 `.vscode/mcp.json` 或使用者層級 MCP 設定檔中加入：

```json
{
  "servers": {
    "vocab-mcp": {
      "command": "node",
      "args": ["/path/to/vocab-mcp/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### 典型使用流程（Copilot Chat）

1. 請 Copilot 用 Playwright MCP 抓取文章：
   > 「幫我從 https://... 抓取文章內容」

2. 呼叫 `extract_vocab_from_text` 抽取詞彙：
   ```json
   {
     "text": "<Playwright 回傳的文章文字>",
     "level": "B2",
     "max_items": 20
   }
   ```

3. 將結果傳入 `expand_vocab` 擴充詞彙資料

### 工具使用範例

#### extract_vocab_from_text

```json
{
  "text": "Governments worldwide are grappling with the challenge of mitigating climate change while sustaining economic growth. Resilience in communities exposed to extreme weather events has become a critical area of research.",
  "level": "B2",
  "max_items": 10
}
```

**輸出範例：**

```json
{
  "items": [
    {
      "lemma": "grapple with",
      "pos": "phrase",
      "level": "B2",
      "context": "Governments worldwide are grappling with the challenge of mitigating climate change."
    },
    {
      "lemma": "mitigate",
      "pos": "verb",
      "level": "B2",
      "context": "mitigating climate change while sustaining economic growth"
    },
    {
      "lemma": "resilience",
      "pos": "noun",
      "level": "B2",
      "context": "Resilience in communities exposed to extreme weather events"
    }
  ],
  "total": 3,
  "source_length": 198
}
```

#### expand_vocab

```json
{
  "items": [
    {
      "lemma": "resilience",
      "pos": "noun",
      "level": "B2",
      "context": "The resilience of the ecosystem is remarkable."
    },
    {
      "lemma": "mitigate",
      "pos": "verb",
      "level": "C1"
    }
  ]
}
```

**輸出範例：**

```json
{
  "items": [
    {
      "lemma": "resilience",
      "definition_en": "The ability to recover quickly from difficulties or adapt well to adversity",
      "translation_zh": "韌性；復原力",
      "examples_en": [
        "The resilience of the local community was evident after the natural disaster.",
        "In IELTS Speaking Part 3, you might discuss how resilience helps people overcome challenges in their careers.",
        "Many argue that building resilience should be a key part of mental health education in schools."
      ],
      "synonyms": ["adaptability", "toughness", "flexibility", "endurance"],
      "ielts_topics": ["Environment", "Society", "Health"]
    }
  ],
  "success": 1,
  "total": 1
}
```

## IELTS Topics 清單

- Education
- Technology
- Environment
- Health
- Work & Career
- Society
- Culture
- Travel & Tourism
- Media & Communication
- Crime & Law
- Government & Politics
- Economy & Business
- Science & Research
- Housing & Urban Life
- Transportation
- Family & Relationships
- Food & Diet
- Sports & Fitness
- Arts & Entertainment
- Animals & Wildlife
- Climate & Energy

## 專案結構

```
vocab-mcp/
├── src/
│   ├── index.ts                        # MCP Server 主程式
│   ├── types.ts                        # TypeScript 類型定義
│   ├── llm.ts                          # LLM 客戶端（expand_vocab 用）
│   ├── extractor.ts                    # LLM 詞彙抽取（extract_vocab 用）
│   └── tools/
│       ├── extract_vocab_from_text.ts  # extract_vocab_from_text 工具
│       └── expand_vocab.ts             # expand_vocab 工具
├── package.json
├── tsconfig.json
└── README.md
```

## 為什麼停止開發

這個專案的核心功能（`extract_vocab_from_text`、`expand_vocab`）本質上是把「叫 LLM 做某件事」包成 MCP 工具。

這不是一個好的 MCP 工具設計方向，原因如下：

**MCP 工具的價值在於做 LLM 本身做不到的事**，例如讀取本地檔案、查詢資料庫、呼叫需要憑證的 API、執行系統指令等。這些事情 LLM 無法直接完成，才需要委派給工具。

本專案的兩個工具都只是對 Gemini API 發送 prompt，這件事 LLM 客戶端（Claude、Copilot 等）本身就能做。使用者只需要在系統提示（system prompt）中定義好格式要求與規則，效果完全相同，甚至更靈活——不需要額外的 MCP server、不需要管理 API Key、不需要維護一層中介。

換句話說：**如果一個 MCP 工具的實作只是「組一個 prompt 丟給 LLM」，那它大概不需要存在。**

本專案保留作為 MCP 工具開發的技術參考（伺服器結構、Zod 驗證、stdio 傳輸、Prompt 原語），但不建議以此模式作為實際產品的設計方向。

## 授權

MIT
