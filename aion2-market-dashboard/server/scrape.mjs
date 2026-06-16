import crypto from 'node:crypto'

const PXB7_SOURCE_URL = 'https://www.pxb7.com/buy/175178554941486/1'
const PXB7_API_URL = 'https://api-pc.pxb7.com/api/search/product/v2/selectSearchPageList'
const PXB7_GAME_ID = '175178554941486'
const SOURCE_7881_URL = 'https://search.7881.com/G6212-100003-0-0-0.html?pageNum=1'
const GOODS_7881_API_URL = 'https://gw.7881.com/goods-service-api/api/goods/list'
const PXB7_SOURCE_PAGE_SIZE = 16
const SOURCE_7881_PAGE_SIZE = 30
const MAX_ITEMS_PER_SOURCE = 100
const PXB7_MAX_PAGES = Math.ceil(MAX_ITEMS_PER_SOURCE / PXB7_SOURCE_PAGE_SIZE)
const PXB7_SOURCE_NAME = '螃蟹'
const SOURCE_7881_NAME = '7881'
const SOURCE_7881_SIGN_SEED = '5c2c538a3937c6db2d04bce3d03bbe88bl'.split('').reverse().join('')

let scrapeQueue = Promise.resolve()

function decodeHtml(value = '') {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function md5(value) {
  return crypto.createHash('md5').update(String(value)).digest('hex')
}

function uuid() {
  return crypto.randomUUID?.() || md5(`${Date.now()}-${Math.random()}`)
}

function attribute(chunk, name) {
  return decodeHtml(chunk.match(new RegExp(`${name}="([^"]*)"`))?.[1] || '')
}

function parseMembershipDays(text = '') {
  const normalized = String(text).replace(/\s+/g, '')
  const match = normalized.match(/会员(?:还剩|还有|剩余)?(\d+)天/)
    || normalized.match(/(\d+)天.*(?:会员|通行证)/)
  if (match) return Number(match[1])

  const dateMatches = [...normalized.matchAll(/20\d{2}-\d{2}-\d{2}(?=到期|，|,|。|$)/g)]
  const remainingDays = dateMatches.map(([dateText]) => {
    const expiresAt = new Date(`${dateText}T23:59:59+08:00`).getTime()
    return Math.ceil((expiresAt - Date.now()) / 86400000)
  }).filter((days) => Number.isFinite(days) && days >= 0)
  return remainingDays.length ? Math.max(...remainingDays) : null
}

export function parseSellerRemark(text = '') {
  const normalized = decodeHtml(text).replace(/\s+/g, ' ').trim()
  const match = normalized.match(/卖家说[:：]?\s*卖家自主行为，真实数据以最终验号为准\s*(.+?)(?:找回赔付|100%赔付保障|验号报告|商品描述|交流|交易流程|商务合作|$)/)
  return match?.[1]?.trim() || ''
}

export function parseChildCharacters(text = '') {
  const normalized = String(text).replace(/\s+/g, '')
  const spaced = String(text).replace(/\s+/g, ' ')
  const children = []
  const consecutiveMatch = spaced.match(/(?:同职)?([一二三四五六七八九十\d]+)连号/)
  const digitMap = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }

  if (consecutiveMatch) {
    const rawCount = consecutiveMatch[1]
    const count = Number(rawCount) || digitMap[rawCount] || null
    children.push({ type: '连号', label: `${rawCount}连号`, count })
  }

  const altMatch = normalized.match(/小号([0-9Kk,.，、和]+)(?:找回|$)/)
  if (altMatch) {
    altMatch[1].split(/[，、和,]/).filter(Boolean).forEach((value, index) => {
      const combatPower = value.toUpperCase().endsWith('K') ? value.toUpperCase() : `${value}K`
      children.push({ type: '小号', label: `小号${index + 1}`, combatPower })
    })
  }

  for (const match of normalized.matchAll(/([\d.]+)\s*[Kk]小号/g)) {
    const combatPower = `${match[1]}K`
    if (!children.some((child) => child.type === '小号' && child.combatPower === combatPower)) {
      children.push({ type: '小号', label: `小号${children.filter((child) => child.type === '小号').length + 1}`, combatPower })
    }
  }

  for (const match of normalized.matchAll(/(\d+)个([\d.]+)\s*[Kk]/g)) {
    const count = Number(match[1])
    const combatPower = `${match[2]}K`
    for (let index = 0; index < count; index += 1) {
      children.push({ type: '小号', label: `小号${children.filter((child) => child.type === '小号').length + 1}`, combatPower })
    }
  }

  return children
}

export function enrichListingWithSellerRemark(item, sellerRemark = '') {
  const detailText = `${item.title || ''} ${sellerRemark}`
  return {
    ...item,
    membershipDays: parseMembershipDays(detailText),
    children: parseChildCharacters(detailText),
    sellerRemark: sellerRemark || null,
  }
}

export function normalizeListing(raw) {
  const title = decodeHtml(raw.title || '')
  const metadata = Array.isArray(raw.metadata)
    ? raw.metadata.map((value) => String(value).trim())
    : decodeHtml(raw.metadata || '').split(',').map((value) => value.trim())
  const cents = Number(raw.price)
  const equipmentLevel = title.match(/装等\s*([\d.]+)/)?.[1] || null
  const combatPower = title.match(/战斗力\s*([\d.]+\s*[KkMm]?)/)?.[1]?.replace(/\s+/g, '') || null
  const sellerRemark = raw.sellerRemark || ''
  const membershipDays = parseMembershipDays(`${title} ${sellerRemark}`)
  const children = parseChildCharacters(`${title} ${sellerRemark}`)

  if (!raw.productId || !title || !metadata[0] || !metadata[1] || !Number.isFinite(cents)) return null

  return {
    productId: String(raw.productId),
    source: raw.source || PXB7_SOURCE_NAME,
    title,
    serverName: metadata[1],
    race: metadata[0],
    priceYuan: cents / 100,
    profession: metadata[3] || null,
    equipmentLevel,
    combatPower,
    membershipDays,
    children,
    sellerRemark: sellerRemark || title || null,
    publishedAtLabel: decodeHtml(raw.publishedAtLabel || '') || null,
    detailUrl: `https://www.pxb7.com/product/${raw.productId}/1`,
  }
}

export function normalizePxb7ApiListing(raw) {
  return normalizeListing({
    productId: raw.productId,
    title: raw.showTitle,
    metadata: raw.attrNameList || [],
    price: raw.price,
    publishedAtLabel: raw.shelveUpTimeText || raw.shelveUpTime || raw.shelveUpTimeFormat,
    sellerRemark: raw.showTitle,
    source: PXB7_SOURCE_NAME,
  })
}

function subTitleValue(subTitle = '', key) {
  const pair = subTitle.split('|').find((item) => item.startsWith(`${key}-`))
  return pair ? pair.slice(key.length + 1).trim() : null
}

export function normalize7881Listing(raw) {
  const title = decodeHtml(raw.title || '')
  const subTitle = decodeHtml(raw.subTitle || raw.subTitlePc || '')
  const profession = subTitleValue(subTitle, '职业')
    || raw.recommendTitleList?.find((item) => item.title === '职业')?.value
    || null
  const equipmentLevel = subTitleValue(subTitle, '战力值')?.replace(/,/g, '')
    || title.match(/战力值[:：]?\s*([\d,]+)/)?.[1]?.replace(/,/g, '')
    || null
  const combatPowerRaw = subTitleValue(subTitle, '战力评分K')
    || title.match(/战力评分K[:：]?\s*([\d.]+)/)?.[1]
    || null
  const race = raw.groupName?.includes('天族') ? '天族' : raw.groupName?.includes('魔族') ? '魔族' : raw.groupName || null
  const sellerRemark = title || null
  const detailText = `${title} ${subTitle}`
  const goodsId = String(raw.goodsId || '')
  const priceYuan = Number(raw.price)

  if (!goodsId || !title || !race || !raw.serverName || !Number.isFinite(priceYuan)) return null

  return {
    productId: `${SOURCE_7881_NAME}-${goodsId}`,
    source: SOURCE_7881_NAME,
    title,
    serverName: raw.serverName,
    race,
    priceYuan,
    profession,
    equipmentLevel,
    combatPower: combatPowerRaw ? `${String(combatPowerRaw).replace(/\s+/g, '')}K` : null,
    membershipDays: parseMembershipDays(detailText),
    children: parseChildCharacters(detailText),
    sellerRemark,
    publishedAtLabel: raw.lastTime || raw.createtime || null,
    detailUrl: `https://search.7881.com/${goodsId}.html`,
  }
}

export function parseListings(html) {
  const items = []
  const seen = new Set()
  const cardPattern = /<a[^>]*href="\/product\/(\d+)\/1"[^>]*>([\s\S]*?)<\/a>/g

  for (const match of html.matchAll(cardPattern)) {
    const [, productId, chunk] = match
    if (seen.has(productId)) continue

    const item = normalizeListing({
      productId,
      title: attribute(chunk, 'showtitle'),
      metadata: attribute(chunk, 'attrnamelist'),
      price: attribute(chunk, 'price'),
      publishedAtLabel: attribute(chunk, 'shelveuptimetext'),
    })
    if (!item) continue

    seen.add(productId)
    items.push(item)
  }

  return items
}

export function normalizeFilters(filters = {}) {
  return {
    minPrice: Number(filters.minPrice) || 0,
    maxPrice: filters.maxPrice === undefined || filters.maxPrice === null || filters.maxPrice === ''
      ? Number.POSITIVE_INFINITY
      : Number(filters.maxPrice),
    profession: filters.profession || '全部',
    race: filters.race || '全部',
    minMemberDays: Number(filters.minMemberDays) || 0,
  }
}

export function filterListings(items, filters = {}) {
  const normalizedFilters = normalizeFilters(filters)
  return items.filter((item) => {
    const priceMatches = item.priceYuan >= normalizedFilters.minPrice && item.priceYuan <= normalizedFilters.maxPrice
    const professionMatches = normalizedFilters.profession === '全部' || item.profession === normalizedFilters.profession
    const raceMatches = normalizedFilters.race === '全部' || item.race === normalizedFilters.race
    const memberMatches = normalizedFilters.minMemberDays <= 0 || (item.membershipDays || 0) >= normalizedFilters.minMemberDays
    return priceMatches && professionMatches && raceMatches && memberMatches
  })
}

export async function scrapeListings(filters = {}) {
  const task = scrapeQueue.then(() => runScrape(filters))
  scrapeQueue = task.catch(() => undefined)
  return task
}

function pxb7Headers() {
  return {
    accept: 'application/json',
    'content-type': 'application/json',
    referer: 'https://www.pxb7.com/',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    device_id: uuid(),
    gio_device: uuid(),
    client_type: '0',
    os_type: '5',
    user_id: '',
    'px-authorization-user': '',
    'px-authorization-merchant': '',
  }
}

async function fetchPxb7Page(pageIndex, headers) {
  const body = {
    query: '',
    gameId: PXB7_GAME_ID,
    pageIndex,
    pageSize: PXB7_SOURCE_PAGE_SIZE,
    bizProd: 1,
    type: '4',
    posType: 1,
    filterDTOList: [],
    combineFilterList: [],
  }

  const response = await fetch(PXB7_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const text = await response.text()
    throw new Error(`螃蟹接口未返回 JSON：HTTP ${response.status} ${text.slice(0, 80)}`)
  }

  const data = await response.json()
  if (!data.success) throw new Error(`螃蟹接口返回异常：${data.errMessage || data.errCode || response.status}`)
  return data.data || { list: [] }
}

async function scrapePxb7Listings() {
  const items = []
  const seen = new Set()
  const headers = pxb7Headers()
  let pagesFetched = 0

  for (let pageIndex = 1; pageIndex <= PXB7_MAX_PAGES && items.length < MAX_ITEMS_PER_SOURCE; pageIndex += 1) {
    const pageData = await fetchPxb7Page(pageIndex, headers)
    pagesFetched += 1
    const list = pageData.list || []

    for (const raw of list) {
      const item = normalizePxb7ApiListing(raw)
      if (!item || seen.has(item.productId)) continue
      seen.add(item.productId)
      items.push(item)
      if (items.length >= MAX_ITEMS_PER_SOURCE) break
    }

    if (list.length < PXB7_SOURCE_PAGE_SIZE) break
  }

  return {
    sourceUrl: PXB7_SOURCE_URL,
    source: PXB7_SOURCE_NAME,
    sourcePageSize: PXB7_SOURCE_PAGE_SIZE,
    sourcePagesFetched: pagesFetched,
    items,
  }
}

async function fetch7881Page(filters, pageNum) {
  const body = {
    marketRequestSource: 'search',
    sellerType: 'C',
    gameId: 'G6212',
    gtid: '100003',
    tradePlace: '0',
    goodsSortType: '1',
    extendAttrList: [],
    pageNum,
    pageSize: SOURCE_7881_PAGE_SIZE,
  }

  if (filters.race === '天族') body.groupId = 'G6212P001'
  if (filters.race === '魔族') body.groupId = 'G6212P002'
  if (filters.minPrice > 0) body.minPrice = filters.minPrice
  if (Number.isFinite(filters.maxPrice)) body.maxPrice = filters.maxPrice
  if (filters.profession !== '全部') {
    body.extendAttrList.push({
      eid: '398298',
      evs: [filters.profession],
      selectOption: '2',
      minCnt: 1,
    })
  }

  const payload = JSON.stringify(body)
  const timestamp = Date.now()
  const sign = md5(md5(`${SOURCE_7881_SIGN_SEED}${timestamp}`) + payload)
  const response = await fetch(GOODS_7881_API_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/javascript, */*; q=0.01',
      'content-type': 'application/json',
      referer: 'https://search.7881.com/',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
      'lb-timestamp': String(timestamp),
      'lb-sign': sign,
    },
    body: payload,
  })
  const data = await response.json()
  if (data.code !== 0) throw new Error(`7881 接口返回异常：${data.msg || data.code}`)
  return data.body || { results: [], pages: 0 }
}

async function scrape7881Listings(filters) {
  const items = []
  let pagesFetched = 0
  let totalPages = 1

  for (let pageNum = 1; pageNum <= totalPages && items.length < MAX_ITEMS_PER_SOURCE; pageNum += 1) {
    const pageData = await fetch7881Page(filters, pageNum)
    pagesFetched += 1
    totalPages = Math.min(pageData.pages || 1, Math.ceil(MAX_ITEMS_PER_SOURCE / SOURCE_7881_PAGE_SIZE))

    for (const raw of pageData.results || []) {
      const item = normalize7881Listing(raw)
      if (item) items.push(item)
      if (items.length >= MAX_ITEMS_PER_SOURCE) break
    }
  }

  return {
    sourceUrl: SOURCE_7881_URL,
    source: SOURCE_7881_NAME,
    sourcePageSize: SOURCE_7881_PAGE_SIZE,
    sourcePagesFetched: pagesFetched,
    items,
  }
}

async function runScrape(filters = {}) {
  const normalizedFilters = normalizeFilters(filters)
  const sourceResults = []
  const warnings = []

  const pxb7Result = await scrapePxb7Listings(normalizedFilters).catch((error) => {
    warnings.push({ source: PXB7_SOURCE_NAME, message: error.message || '螃蟹抓取失败' })
    return null
  })
  if (pxb7Result) sourceResults.push(pxb7Result)

  const source7881Result = await scrape7881Listings(normalizedFilters).catch((error) => {
    warnings.push({ source: SOURCE_7881_NAME, message: error.message || '7881 抓取失败' })
    return null
  })
  if (source7881Result) sourceResults.push(source7881Result)

  const fetchedItems = sourceResults.flatMap((result) => result.items)
  const items = filterListings(fetchedItems, normalizedFilters)

  if (!sourceResults.length) {
    throw new Error(warnings.map((warning) => `${warning.source}: ${warning.message}`).join('；') || '所有来源抓取失败')
  }

  return {
    sourceUrl: PXB7_SOURCE_URL,
    source: sourceResults.map((result) => result.source).join(','),
    observedAt: new Date().toISOString(),
    sourcePageSize: null,
    sourcePagesFetched: sourceResults.reduce((sum, result) => sum + result.sourcePagesFetched, 0),
    platformLimit: MAX_ITEMS_PER_SOURCE,
    totalFetched: fetchedItems.length,
    sources: sourceResults.map((result) => ({
      source: result.source,
      sourceUrl: result.sourceUrl,
      sourcePagesFetched: result.sourcePagesFetched,
      itemCount: result.items.length,
      sourcePageSize: result.sourcePageSize,
    })),
    warnings,
    items,
  }
}
