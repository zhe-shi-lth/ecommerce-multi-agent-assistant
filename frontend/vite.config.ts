import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 开发期把 /api 代理到 Java 服务（默认 :8080），避免改 Java CORS。
// 生产/阶段6 docker 再统一处理跨域或反向代理。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      // 线1上架等编排接口由 Python 服务（默认 :8000）提供。
      "/agent": {
        target: "http://localhost:8000",
        changeOrigin: true,
        // 文生图（万相）单步可能耗时数十秒，放宽容忍避免代理提前断连。
        timeout: 300000,
        proxyTimeout: 300000,
      },
    },
  },
});
