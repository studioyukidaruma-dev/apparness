import { defineConfig } from "vitest/config";

// 結合テストはDOMを組み立てて3機能を実際にマウントするため jsdom 環境を使う
// （各機能単体のテストは純粋関数中心のため node 環境のままでよく、ここでは変更しない）。
export default defineConfig({
  test: {
    environment: "jsdom",
  },
});
