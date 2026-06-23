import { scrapeListings } from '../../server/scrape.mjs'

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  })
}

function readFilters(request) {
  const url = new URL(request.url)
  return {
    minPrice: Number(url.searchParams.get('minPrice') || 0),
    maxPrice: url.searchParams.get('maxPrice') || '',
    profession: url.searchParams.get('profession') || '全部',
    race: url.searchParams.get('race') || '全部',
    linkedAccount: url.searchParams.get('linkedAccount') || '全部',
    minMemberDays: Number(url.searchParams.get('minMemberDays') || 0),
    pxb7Limit: url.searchParams.get('pxb7Limit') || '',
    source7881Limit: url.searchParams.get('source7881Limit') || '',
  }
}

export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: jsonHeaders })
  if (request.method !== 'GET') return jsonResponse({ message: 'Method not allowed' }, 405)

  try {
    const result = await scrapeListings(readFilters(request))
    return jsonResponse(result)
  } catch (error) {
    return jsonResponse({
      message: error.message || '重新抓取失败，请稍后重试',
    }, 502)
  }
}
