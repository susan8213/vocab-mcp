/**
 * Debug logger
 * MCP server 走 stdio，stdout 屬於協定通道，只能用 stderr 輸出 debug 訊息
 * 設定環境變數 DEBUG=1 啟用
 */

const isDebug = process.env.DEBUG === "1" || process.env.DEBUG === "true";

export function debugLog(label: string, data: unknown): void {
  if (!isDebug) return;
  const timestamp = new Date().toISOString();
  console.error(`[DEBUG ${timestamp}] ${label}:`);
  console.error(JSON.stringify(data, null, 2));
}
