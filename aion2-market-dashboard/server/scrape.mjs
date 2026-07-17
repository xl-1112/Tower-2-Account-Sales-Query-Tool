import crypto from 'node:crypto'

const PXB7_SOURCE_URL = 'https://www.pxb7.com/buy/175178554941486/1'
const PXB7_API_URL = 'https://api-pc.pxb7.com/api/search/product/v2/selectSearchPageList'
const PXB7_GAME_ID = '175178554941486'
const SOURCE_7881_URL = 'https://search.7881.com/G6212-100003-0-0-0.html?pageNum=1'
const GOODS_7881_API_URL = 'https://gw.7881.com/goods-service-api/api/goods/list'
const PXB7_SOURCE_PAGE_SIZE = 16
const SOURCE_7881_PAGE_SIZE = 30
const DEFAULT_ITEMS_PER_SOURCE = 100
const PXB7_SOURCE_NAME = '螃蟹'
const SOURCE_7881_NAME = '7881'
const SOURCE_7881_SIGN_SEED = '5c2c538a3937c6db2d04bce3d03bbe88bl'.split('').reverse().join('')
const ALL_OPTION = '全部'
const PROFESSION_OPTIONS = ['剑星', '守护星', '杀星', '弓星', '护法星', '精灵星', '治愈星', '魔道星']
const RACE_OPTIONS = ['天族', '魔族']
const LINKED_ACCOUNT_OPTIONS = ['4连号', '5连号', '6连号', '7连号', '8连号']

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

function chineseCount(value) {
  const map = { 一: 1, 二: 2, 两: 2, 俩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }
  return Number(value) || map[value] || null
}

function linkedAccountLabel(count) {
  return count ? `${count}连号` : null
}

function uniqueSmallChildren(children) {
  return children.map((child, index, list) => {
    if (child.type !== '小号') return child
    const smallIndex = list.slice(0, index + 1).filter((item) => item.type === '小号').length
    return { ...child, label: `小号${smallIndex}` }
  })
}

function appendSmallChild(children, value) {
  const normalized = String(value || '').replace(/\s+/g, '')
  if (!/\d/.test(normalized)) return
  children.push({
    type: '小号',
    label: `小号${children.filter((child) => child.type === '小号').length + 1}`,
    combatPower: normalized.toUpperCase().endsWith('K') ? normalized.toUpperCase() : normalized,
  })
}

function parseSmallAccountSegment(segment = '') {
  return String(segment)
    .split(/[+＋，、和,]/)
    .map((value) => value.trim())
    .filter((value) => /\d/.test(value))
}

function collectTextFragments(value) {
  if (value === null || value === undefined || value === '') return []
  if (Array.isArray(value)) return value.flatMap(collectTextFragments)
  if (typeof value === 'object') return Object.values(value).flatMap(collectTextFragments)
  return [String(value)]
}

function joinTextFragments(...values) {
  return values.flatMap(collectTextFragments).join(' ')
}

function normalizeSourceLimit(value) {
  const limit = Math.floor(Number(value))
  return Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_ITEMS_PER_SOURCE
}

function normalizeMultiOption(value, options) {
  const rawValues = Array.isArray(value) ? value : [value]
  const selected = rawValues
    .flatMap((item) => String(item || '').split(','))
    .map((item) => item.trim())
    .filter((item) => item && item !== ALL_OPTION && options.includes(item))
  return [...new Set(selected)]
}

function multiOptionMatches(selectedValues, value) {
  return !selectedValues.length || selectedValues.includes(value)
}

function parseSmallAccountCountHint(text = '') {
  const normalized = String(text).replace(/\s+/g, '')
  const patterns = [
    /([一二两俩三四五六七八九十\d]+)个?小号/,
    /小号([一二两俩三四五六七八九十\d]+)个/,
    /除(?:账号)?本身还(?:有|存在)([一二两俩三四五六七八九十\d]+)个?(?:小号|角色|号)?/,
    /还(?:有|存在)([一二两俩三四五六七八九十\d]+)个?(?:小号|角色|号)/,
  ]

  for (const pattern of patterns) {
    const count = chineseCount(normalized.match(pattern)?.[1])
    if (count) return count
  }
  return null
}

export function parseMembershipDays(text = '') {
  const normalized = String(text).replace(/\s+/g, '')
  if (/(?:无|没|没有)会员/.test(normalized)) return 0
  if (/(?:会员|通行证|战令|会员战令)[:：-]?(?:-|0天?)/.test(normalized)) return 0

  const dayPatterns = [
    /(?:会员|通行证|战令|会员战令)[:：]?[^，,。；;】)]{0,24}?(?:还剩|还有|剩余)(\d{1,4})天/,
    /(?:会员|通行证|战令|会员战令)[:：]?(\d{1,4})天/,
    /(?:还剩|还有|剩余)(\d{1,4})天(?:会员|通行证|战令)/,
    /(\d{1,4})天(?:会员|通行证|战令)/,
  ]
  for (const pattern of dayPatterns) {
    const match = normalized.match(pattern)
    const days = Number(match?.[1])
    if (Number.isFinite(days) && days >= 0 && days <= 3660) return days
  }

  const dateMatches = [
    ...normalized.matchAll(/(?:会员|通行证|战令|会员战令)[:：]?[^，,。；;】)]{0,40}?(20\d{2}-\d{2}-\d{2})(?:到期)?/g),
  ]
  const remainingDays = dateMatches.map((match) => {
    const expiresAt = new Date(`${match[1]}T23:59:59+08:00`).getTime()
    return Math.ceil((expiresAt - Date.now()) / 86400000)
  }).filter((days) => Number.isFinite(days) && days >= 0)
  return remainingDays.length ? Math.max(...remainingDays) : null
}

export function parseMaxCharacterLevel(text = '') {
  const levels = [...String(text).matchAll(/最高角色\s*(?:等级|等級)\s*[:：-]?\s*(\d{1,3})(?:\s*(?:级|級))?(?!\d)/g)]
    .map((match) => Number(match[1]))
    .filter((level) => Number.isInteger(level) && level > 0)
  return levels.length ? Math.max(...levels) : null
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

  if (consecutiveMatch) {
    const rawCount = consecutiveMatch[1]
    children.push({ type: '连号', label: `${rawCount}连号`, count: chineseCount(rawCount) })
  }

  const numericAltMatch = normalized.match(/小号([0-9Kk,.，、和]+)(?:找回|$)/)
  if (numericAltMatch) {
    parseSmallAccountSegment(numericAltMatch[1]).forEach((value) => {
      appendSmallChild(children, value.toUpperCase().endsWith('K') ? value : `${value}K`)
    })
  }

  const countedSmallMatch = normalized.match(/(?:[一二两俩三四五六七八九十\d]+个?)?小号([^。；;]*)/)
  if (
    !numericAltMatch
    && parseSmallAccountCountHint(normalized)
    && countedSmallMatch
    && !/\d+个[\d.]+\s*[Kk]/.test(countedSmallMatch[1])
  ) {
    for (const match of countedSmallMatch[1].matchAll(/([\d.]+)\s*[Kk]/g)) {
      appendSmallChild(children, `${match[1]}K`)
    }
  }

  const roleAltMatch = normalized.match(/小号((?:\d+[^\d，。；;+＋和]*)[+＋](?:\d+[^\d，。；;+＋和]*)(?:[+＋]\d+[^\d，。；;+＋和]*)*)/)
  if (roleAltMatch && /[+＋]/.test(roleAltMatch[1])) {
    parseSmallAccountSegment(roleAltMatch[1]).forEach((value) => appendSmallChild(children, value))
  }

  for (const match of normalized.matchAll(/([\d.]+)\s*[Kk]小号/g)) {
    appendSmallChild(children, `${match[1]}K`)
  }

  for (const match of normalized.matchAll(/(\d+)个([\d.]+)\s*[Kk]/g)) {
    const count = Number(match[1])
    for (let index = 0; index < count; index += 1) appendSmallChild(children, `${match[2]}K`)
  }

  return uniqueSmallChildren(children)
}

export function parseLinkedAccountCount(text = '') {
  const spaced = String(text).replace(/\s+/g, ' ')
  const explicitMatch = spaced.match(/(?:连体号[-:：]?)?\s*(?:同职)?([一二三四五六七八九十\d]+)连号/)
  if (explicitMatch) return chineseCount(explicitMatch[1])

  const childCount = parseChildCharacters(text).filter((child) => child.type === '小号').length
  const hintedChildCount = parseSmallAccountCountHint(text)
  const inferredChildCount = Math.max(childCount, hintedChildCount || 0)
  return inferredChildCount > 0 ? inferredChildCount + 1 : null
}

export function enrichListingWithSellerRemark(item, sellerRemark = '') {
  const detailText = `${item.title || ''} ${sellerRemark}`
  const linkedAccountCount = parseLinkedAccountCount(detailText)
  return {
    ...item,
    maxCharacterLevel: parseMaxCharacterLevel(sellerRemark) ?? item.maxCharacterLevel ?? null,
    membershipDays: parseMembershipDays(detailText),
    children: parseChildCharacters(detailText),
    linkedAccountCount,
    linkedAccountLabel: linkedAccountLabel(linkedAccountCount),
    sellerRemark: sellerRemark || null,
  }
}

export function normalizeListing(raw) {
  const title = decodeHtml(raw.title || '')
  const metadata = Array.isArray(raw.metadata)
    ? raw.metadata.map((value) => String(value).trim())
    : decodeHtml(raw.metadata || '').split(',').map((value) => value.trim())
  const cents = Number(raw.price)
  const sellerRemark = raw.sellerRemark || ''
  const detailText = joinTextFragments(title, sellerRemark, raw.linkedAccountText)
  const equipmentLevel = title.match(/装等\s*([\d.]+)/)?.[1] || null
  const combatPower = title.match(/战斗力\s*([\d.]+\s*[KkMm]?)/)?.[1]?.replace(/\s+/g, '') || null
  const maxCharacterLevel = parseMaxCharacterLevel(sellerRemark || title)
  const membershipDays = parseMembershipDays(detailText)
  const children = parseChildCharacters(detailText)
  const linkedAccountCount = parseLinkedAccountCount(detailText)

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
    maxCharacterLevel,
    membershipDays,
    children,
    linkedAccountCount,
    linkedAccountLabel: linkedAccountLabel(linkedAccountCount),
    sellerRemark: sellerRemark || title || null,
    publishedAtLabel: decodeHtml(raw.publishedAtLabel || '') || null,
    detailUrl: `https://www.pxb7.com/product/${raw.productId}/1`,
  }
}

export function normalizePxb7ApiListing(raw) {
  const linkedAccountText = joinTextFragments(
    raw.important,
    raw.importantHighlights,
    raw.label,
    raw.mainLabel,
    raw.userActionTag,
    raw.shortTitle,
    raw.profile,
    raw.attrDocs,
    raw.attrValues,
  )

  return normalizeListing({
    productId: raw.productId,
    title: raw.showTitle,
    metadata: raw.attrNameList || [],
    price: raw.price,
    publishedAtLabel: raw.shelveUpTimeText || raw.shelveUpTime || raw.shelveUpTimeFormat,
    sellerRemark: raw.showTitle,
    linkedAccountText,
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
  const detailText = `${title} ${subTitle}`
  const children = parseChildCharacters(detailText)
  const linkedAccountCount = parseLinkedAccountCount(detailText)
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
    maxCharacterLevel: parseMaxCharacterLevel(title),
    membershipDays: parseMembershipDays(detailText),
    children,
    linkedAccountCount,
    linkedAccountLabel: linkedAccountLabel(linkedAccountCount),
    sellerRemark: title || null,
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
    profession: normalizeMultiOption(filters.profession, PROFESSION_OPTIONS),
    race: normalizeMultiOption(filters.race, RACE_OPTIONS),
    linkedAccount: normalizeMultiOption(filters.linkedAccount, LINKED_ACCOUNT_OPTIONS),
    minMemberDays: Number(filters.minMemberDays) || 0,
    pxb7Limit: normalizeSourceLimit(filters.pxb7Limit),
    source7881Limit: normalizeSourceLimit(filters.source7881Limit),
  }
}

export function filterListings(items, filters = {}) {
  const normalizedFilters = normalizeFilters(filters)
  return items.filter((item) => {
    const priceMatches = item.priceYuan >= normalizedFilters.minPrice && item.priceYuan <= normalizedFilters.maxPrice
    const professionMatches = multiOptionMatches(normalizedFilters.profession, item.profession)
    const raceMatches = multiOptionMatches(normalizedFilters.race, item.race)
    const linkedMatches = multiOptionMatches(normalizedFilters.linkedAccount, item.linkedAccountLabel)
    const memberMatches = normalizedFilters.minMemberDays <= 0 || (item.membershipDays || 0) >= normalizedFilters.minMemberDays
    return priceMatches && professionMatches && raceMatches && linkedMatches && memberMatches
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

async function scrapePxb7Listings(limit = DEFAULT_ITEMS_PER_SOURCE) {
  const items = []
  const seen = new Set()
  const headers = pxb7Headers()
  let pagesFetched = 0
  const maxPages = Math.ceil(limit / PXB7_SOURCE_PAGE_SIZE)

  for (let pageIndex = 1; pageIndex <= maxPages && items.length < limit; pageIndex += 1) {
    const pageData = await fetchPxb7Page(pageIndex, headers)
    pagesFetched += 1
    const list = pageData.list || []

    for (const raw of list) {
      const item = normalizePxb7ApiListing(raw)
      if (!item || seen.has(item.productId)) continue
      seen.add(item.productId)
      items.push(item)
      if (items.length >= limit) break
    }

    if (list.length < PXB7_SOURCE_PAGE_SIZE) break
  }

  return {
    sourceUrl: PXB7_SOURCE_URL,
    source: PXB7_SOURCE_NAME,
    sourcePageSize: PXB7_SOURCE_PAGE_SIZE,
    sourcePagesFetched: pagesFetched,
    sourceLimit: limit,
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

  if (filters.race.length === 1 && filters.race[0] === '天族') body.groupId = 'G6212P001'
  if (filters.race.length === 1 && filters.race[0] === '魔族') body.groupId = 'G6212P002'
  if (filters.minPrice > 0) body.minPrice = filters.minPrice
  if (Number.isFinite(filters.maxPrice)) body.maxPrice = filters.maxPrice
  if (filters.profession.length) {
    body.extendAttrList.push({
      eid: '398298',
      evs: filters.profession,
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
  const contentType = response.headers.get('content-type') || ''
  const text = await response.text()
  if (!contentType.includes('application/json')) {
    throw new Error(`7881 接口未返回 JSON：HTTP ${response.status} ${text.slice(0, 80)}`)
  }

  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`7881 接口 JSON 解析失败：HTTP ${response.status} ${text.slice(0, 80)}`)
  }

  if (data.code !== 0) throw new Error(`7881 接口返回异常：${data.msg || data.code}`)
  return data.body || { results: [], pages: 0 }
}

async function scrape7881Listings(filters, limit = DEFAULT_ITEMS_PER_SOURCE) {
  const items = []
  let pagesFetched = 0
  let totalPages = 1

  for (let pageNum = 1; pageNum <= totalPages && items.length < limit; pageNum += 1) {
    const pageData = await fetch7881Page(filters, pageNum)
    pagesFetched += 1
    totalPages = Math.min(pageData.pages || 1, Math.ceil(limit / SOURCE_7881_PAGE_SIZE))

    for (const raw of pageData.results || []) {
      const item = normalize7881Listing(raw)
      if (item) items.push(item)
      if (items.length >= limit) break
    }
  }

  return {
    sourceUrl: SOURCE_7881_URL,
    source: SOURCE_7881_NAME,
    sourcePageSize: SOURCE_7881_PAGE_SIZE,
    sourcePagesFetched: pagesFetched,
    sourceLimit: limit,
    items,
  }
}

async function runScrape(filters = {}) {
  const normalizedFilters = normalizeFilters(filters)
  const sourceResults = []
  const warnings = []

  const pxb7Result = await scrapePxb7Listings(normalizedFilters.pxb7Limit).catch((error) => {
    warnings.push({ source: PXB7_SOURCE_NAME, message: error.message || '螃蟹抓取失败' })
    return null
  })
  if (pxb7Result) sourceResults.push(pxb7Result)

  const source7881Result = await scrape7881Listings(normalizedFilters, normalizedFilters.source7881Limit).catch((error) => {
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
    platformLimit: {
      [PXB7_SOURCE_NAME]: normalizedFilters.pxb7Limit,
      [SOURCE_7881_NAME]: normalizedFilters.source7881Limit,
    },
    totalFetched: fetchedItems.length,
    sources: sourceResults.map((result) => ({
      source: result.source,
      sourceUrl: result.sourceUrl,
      sourcePagesFetched: result.sourcePagesFetched,
      itemCount: result.items.length,
      sourcePageSize: result.sourcePageSize,
      sourceLimit: result.sourceLimit,
    })),
    warnings,
    items,
  }
}
