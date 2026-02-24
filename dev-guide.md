# MCP 英文單字庫開發文件

> 目標：從文章 URL 抽取指定 CEFR 等級的單字/片語，透過 LLM 生成繁中翻譯、英文例句、同義字，並支援匯出至 Notion（含 IELTS topic tags）。

---

## 1. 產品範圍與 MVP

### MVP 功能
1. 文章 URL 輸入（由 Playwright MCP 抓取 HTML/文字）
2. 單字/片語抽取（lemma + POS）
3. CEFR 篩選
4. LLM 詞彙擴充
5. 匯出至 Notion（含 IELTS topic tags）

### 延伸功能（非 MVP）
- SRS 單字卡複習
- 成本/速率控制儀表板
- 多文章合併與去重

---

## 2. 系統架構

### 分層
- MCP Server（工具層）
- 外部 MCP（Playwright：抓網頁內容 / Notion：寫入資料）
- LLM 生成層（詞彙擴充）
- 資料層（文章、詞彙、輸出）
- 匯出層（Notion）

### 核心資料模型（最小）
- `Article`: `id`, `html`, `text`, `levelTarget`, `createdAt`
- `VocabItem`: `lemma`, `pos`, `level`, `context`, `sourceArticleId`
- `VocabExpanded`: `lemma`, `translation_zh`, `example_en`, `synonyms[]`, `ielts_topics[]`
- `ExportRecord`: `target`, `path`, `createdAt`

---

## 3. 核心流程（端到端）

1. 使用者輸入文章 URL
2. 透過 Playwright MCP 抓取 HTML/文字
3. 解析 HTML → 純文字
4. 斷詞、詞性標註、lemma 化
5. 依 CEFR 篩選（目標等級）
6. LLM 生成擴充資料
7. 儲存擴充結果
8. 透過 Notion MCP 匯出（含 IELTS tags）

---

## 4. MCP 工具設計（MVP）

### 工具 1：`extract_vocab_from_html`
**用途**：HTML → 單字/片語清單

**輸入**
- `html` (string, required)
- `level` (string, required) 例如 `A2`, `B1`, `B2`

**輸出**
- `items[]`: `lemma`, `pos?`, `level?`, `context?`

---

### 工具 2：`expand_vocab`
**用途**：LLM 擴充詞彙資料

**輸入**
- `items[]`
  - `lemma` (required)
  - `pos` (optional)
  - `level` (optional)
  - `context` (optional)

**輸出**
- `items[]`
  - `lemma`
  - `translation_zh`
  - `example_en`
  - `synonyms[]`
  - `ielts_topics[]`（多選，固定清單）

---

### 外部 MCP：Playwright MCP
**用途**：抓取 URL 內容（HTML/文字），支援動態頁面

### 外部 MCP：Notion MCP
**用途**：寫入 Notion Database 或 Page（含 tags）

---

## 5. IELTS Topics 固定清單（多選）
> 建議固定清單如下（可多選）：

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

---

## 6. Notion 匯出格式（建議）

建議使用 Notion Database 欄位：
- `Lemma`（title）
- `Translation (ZH)`（text）
- `Example (EN)`（text）
- `Synonyms`（multi-select 或 text）
- `IELTS Topics`（multi-select）
- `CEFR`（select，可選）

### 6.1 Notion 匯出策略（存在則更新，不存在則新增）
1. 以 `Lemma` 作為唯一鍵（建議先正規化：小寫、去空白、還原 lemma）
2. 查詢是否已存在該 `Lemma`
3. 若存在：比對欄位（翻譯、例句、同義字、IELTS Topics），有變更則更新
4. 若不存在：新增新的資料列

### 6.2 Notion 查詢/更新欄位策略（實作流程）
1. **正規化 Lemma**：`normalize(lemma)`（小寫、trim、去多餘空白）
2. **查詢**：使用 Notion MCP 以 `Lemma`（title）做 equals 查詢
3. **比對欄位**：
  - `Translation (ZH)`：字串不同即更新
  - `Example (EN)`：字串不同即更新
  - `Synonyms`：排序後比對（去重）
  - `IELTS Topics`：集合比對（多選）
  - `CEFR`：值不同即更新
4. **更新策略**：
  - 只更新有變動的欄位（避免重寫）
  - `Synonyms`/`IELTS Topics` 以「集合覆蓋」為主
5. **新增策略**：查無結果時，建立新資料列並填入所有欄位
6. **紀錄**：保存 `notionPageId`（若有）以利後續快速更新

### 6.3 可行作法（避免重複、支援更新）
**方案 A：自己包一層 MCP server（推薦）**
- 你的 MCP server 對外只提供 `export_to_notion`
- 內部流程：查詢 → 比對 → 更新/新增
- 優點：策略集中、client 只需呼叫一次工具

**方案 B：直接呼叫 Notion API**
- 由你的 MCP server 直接打 Notion API
- 需要設定 Notion Integration Token（環境變數）
- 優點：少一層 MCP 依賴、流程更單純

---

## 7. VS Code 掛載 MCP（HTTP/SSE）

使用 `.vscode/mcp.json` 或使用者層級 `mcp.json`：

```
{
  "servers": {
    "vocab-mcp": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@microsoft/mcp-server-playwright"]
    },
    "notion": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"]
    }
  }
}
```

---

## 8. 部署（HTTP/SSE）

### 本機
- Build: `npm run build`
- Start: `node dist/index.js`
- ENV: `PORT`, `LLM_API_KEY`

### Docker
- `Dockerfile` + `docker run -p 3000:3000 ...`

### Cloud（Render/Railway）
- Build command: `npm run build`
- Start command: `node dist/index.js`
- Port: `PORT`

---

## 9. 測試建議
- 單筆輸入
- 批次輸入
- 無 context / 無 pos 測試
- 空白/極短詞彙
- LLM 超時 / 失敗重試

---

## 10. 里程碑
- M1：`expand_vocab` 完成
- M2：整合 Playwright MCP（抓取）
- M3：整合 Notion MCP（匯出）
- M4：批次與重試
- M5：SRS 單字卡
