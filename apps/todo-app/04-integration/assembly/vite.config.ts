import { defineConfig } from "vite";

// この統合層は 03-features/*/src を「呼び出して繋ぐ」だけの薄い組み上げ層。
// 各機能のソース（このディレクトリの外、../../03-features/*/src）を直接 import するため、
// Vite のデフォルトのファイルシステム制限を assembly の親（apps/todo-app）まで緩める。
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    fs: {
      allow: [".."],
    },
  },
});
