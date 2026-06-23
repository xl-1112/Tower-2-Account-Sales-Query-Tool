import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { scrapeListings } from './server/scrape.mjs'

function listingsApi() {
  return async (req, res, next) => {
    if (!req.url?.startsWith('/api/listings')) return next()

    res.setHeader('Content-Type', 'application/json; charset=utf-8')

    try {
      const url = new URL(req.url, 'http://localhost')
      const result = await scrapeListings({
        minPrice: Number(url.searchParams.get('minPrice') || 0),
        maxPrice: url.searchParams.get('maxPrice') || '',
        profession: url.searchParams.get('profession') || '全部',
        race: url.searchParams.get('race') || '全部',
        linkedAccount: url.searchParams.get('linkedAccount') || '全部',
        minMemberDays: Number(url.searchParams.get('minMemberDays') || 0),
        pxb7Limit: url.searchParams.get('pxb7Limit') || '',
        source7881Limit: url.searchParams.get('source7881Limit') || '',
      })

      res.statusCode = 200
      res.end(JSON.stringify(result))
    } catch (error) {
      res.statusCode = 502
      res.end(JSON.stringify({ message: error.message || '重新抓取失败，请稍后重试' }))
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
    include: ['react', 'react-dom/client'],
  },
  server: {
    warmup: {
      clientFiles: ['./src/main.jsx'],
    },
  },
  plugins: [react(), liveListingsPlugin()],
})
