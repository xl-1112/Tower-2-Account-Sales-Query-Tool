import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { scrapeListings } from "./server/scrape.mjs";

function listingsApi() {
  return async (req, res, next) => {
    if (!req.url?.startsWith('/api/listings')) return next()

    res.setHeader('Content-Type', 'application/json; charset=utf-8')

    try {
      const url = new URL(req.url, 'http://localhost')
      const minPrice = Number(url.searchParams.get('minPrice') || 0)
      const maxPriceRaw = url.searchParams.get('maxPrice')
      const profession = url.searchParams.get('profession') || '全部'
      const race = url.searchParams.get('race') || '全部'
      const minMemberDays = Number(url.searchParams.get('minMemberDays') || 0)
      const result = await scrapeListings({ minPrice, maxPrice: maxPriceRaw, profession, race, minMemberDays })

      res.statusCode = 200
      res.end(JSON.stringify(result))
    } catch (error) {
      res.statusCode = 502
      const rawMessage = error.message || ''
      const message = rawMessage.includes('目标列表页连续 3 次未返回商品')
        ? '目标站点暂时没有返回商品列表，请稍后重试'
        : rawMessage || '重新抓取失败，请稍后重试'
      res.end(JSON.stringify({ message }))
    }
  }
}

function liveListingsPlugin() {
  return {
    name: 'live-aion2-listings',
    configureServer(server) {
      server.middlewares.use(listingsApi())
    },
    configurePreviewServer(server) {
      server.middlewares.use(listingsApi())
    },
  }
}

export default defineConfig({
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(), liveListingsPlugin()],
});
