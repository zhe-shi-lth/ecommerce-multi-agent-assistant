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
      // 注意：本机 8000 被一个僵死旧进程长期占用且无法 kill，临时改用 8011 规避；
      // 若后续 8000 已释放，改回 http://localhost:8000 即可。
      "/agent": {
        target: "http://localhost:8011",
        changeOrigin: true,
      },
    },
  },
});
