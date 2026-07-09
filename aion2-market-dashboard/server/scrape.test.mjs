import assert from 'node:assert/strict'
import test from 'node:test'

import {
  enrichListingWithSellerRemark,
  filterListings,
  normalize7881Listing,
  normalizeFilters,
  normalizePxb7ApiListing,
  parseChildCharacters,
  parseLinkedAccountCount,
  parseListings,
  parseMembershipDays,
  parseSellerRemark,
  scrapeListings,
} from './scrape.mjs'

test('parseListings extracts the requested marketplace fields from rendered HTML', () => {
  const html = `
    <a href="/product/123456/1">
      <div showtitle="【艾瑞爾】45级天族男弓星 装等4514 战斗力573.32K"
        attrnamelist="天族,艾瑞爾,男,弓星"
        price="500000"
        shelveuptimetext="9分钟前"></div>
    </a>
  `

  assert.deepEqual(parseListings(html), [
    {
      productId: '123456',
      source: '螃蟹',
      title: '【艾瑞爾】45级天族男弓星 装等4514 战斗力573.32K',
      serverName: '艾瑞爾',
      race: '天族',
      priceYuan: 5000,
      profession: '弓星',
      equipmentLevel: '4514',
      combatPower: '573.32K',
      membershipDays: null,
      children: [],
      linkedAccountCount: null,
      linkedAccountLabel: null,
      sellerRemark: '【艾瑞爾】45级天族男弓星 装等4514 战斗力573.32K',
      publishedAtLabel: '9分钟前',
      detailUrl: 'https://www.pxb7.com/product/123456/1',
    },
  ])
})

test('normalizePxb7ApiListing maps direct PXB7 API goods into the shared table model', () => {
  const item = normalizePxb7ApiListing({
    productId: '2231636572488668783',
    price: 33000,
    showTitle: '【希塔尼耶】45级天族女护法星，装等3715，战斗力346.59K，守护力1039',
    attrNameList: ['天族', '希塔尼耶', 'NC邮箱账号', '护法星', '女'],
    shelveUpTimeText: '2分钟内发布',
  })

  assert.equal(item.productId, '2231636572488668783')
  assert.equal(item.source, '螃蟹')
  assert.equal(item.serverName, '希塔尼耶')
  assert.equal(item.race, '天族')
  assert.equal(item.priceYuan, 330)
  assert.equal(item.profession, '护法星')
  assert.equal(item.equipmentLevel, '3715')
  assert.equal(item.combatPower, '346.59K')
  assert.equal(item.publishedAtLabel, '2分钟内发布')
  assert.equal(item.detailUrl, 'https://www.pxb7.com/product/2231636572488668783/1')
})

test('normalizePxb7ApiListing reads linked-account labels from PXB7 important tags first', () => {
  const item = normalizePxb7ApiListing({
    productId: '2231752357888798043',
    price: 50000,
    showTitle: '【伊斯拉佩爾】45级魔族女剑星，装等4084，战斗力478.86K',
    attrNameList: ['魔族', '伊斯拉佩爾', 'NC邮箱账号', '剑星', '女'],
    important: ['盧德萊絕滅刀', '暗龍王臂甲', '同职业4连号'],
    shelveUpTimeText: '刚刚',
  })

  assert.equal(item.source, '螃蟹')
  assert.equal(item.linkedAccountCount, 4)
  assert.equal(item.linkedAccountLabel, '4连号')
})

test('parseListings removes duplicate product ids without limiting source pages', () => {
  const card = (id) => `<a href="/product/${id}/1"><span showtitle="装等1 战斗力2K" attrnamelist="天族,天加隆,男,守护星" price="100" shelveuptimetext="刚刚"></span></a>`
  const html = [card(1), card(1), ...Array.from({ length: 20 }, (_, index) => card(index + 2))].join('')
  const items = parseListings(html)

  assert.equal(items.length, 21)
  assert.equal(new Set(items.map((item) => item.productId)).size, 21)
})

test('parseSellerRemark trims the detail page seller speech', () => {
  const bodyText = '卖家说 卖家自主行为，真实数据以最终验号为准 会员还有13天，3个外观四连号，小号290k，210k，200k 找回赔付 100%赔付保障'

  assert.equal(
    parseSellerRemark(bodyText),
    '会员还有13天，3个外观四连号，小号290k，210k，200k',
  )
})

test('parseChildCharacters extracts child role hints from seller speech', () => {
  assert.deepEqual(parseChildCharacters('会员还有13天，3个外观四连号，小号290k，210k，200k'), [
    { type: '连号', label: '四连号', count: 4 },
    { type: '小号', label: '小号1', combatPower: '290K' },
    { type: '小号', label: '小号2', combatPower: '210K' },
    { type: '小号', label: '小号3', combatPower: '200K' },
  ])
})

test('parseChildCharacters extracts small-account combat powers after role names', () => {
  assert.deepEqual(parseChildCharacters('两个小号治愈146k，魔道185k'), [
    { type: '小号', label: '小号1', combatPower: '146K' },
    { type: '小号', label: '小号2', combatPower: '185K' },
  ])
})

test('parseLinkedAccountCount reads explicit linked-account labels', () => {
  assert.equal(parseLinkedAccountCount('同职五连号，会员还有13天'), 5)
  assert.equal(parseLinkedAccountCount('连体号-6连号'), 6)
})

test('parseLinkedAccountCount infers linked accounts from seller speech with role shorthand', () => {
  const text = '557K双夔剑星，胸针没做的战力，能量满的，包里也很多没吃，小号158杀+181护+154弓，557K，158杀，181护，154弓'

  assert.equal(parseLinkedAccountCount(text), 4)
  assert.deepEqual(parseChildCharacters(text), [
    { type: '小号', label: '小号1', combatPower: '158杀' },
    { type: '小号', label: '小号2', combatPower: '181护' },
    { type: '小号', label: '小号3', combatPower: '154弓' },
  ])
})

test('parseLinkedAccountCount infers linked accounts from counted small-account descriptions', () => {
  assert.equal(parseLinkedAccountCount('除账号本身还存在三个小号，治愈146k，魔道185k，弓星190k'), 4)
  assert.equal(parseLinkedAccountCount('还有四个角色，146k，185k，190k，200k'), 5)
})

test('parseMembershipDays avoids distant numeric fields and reads explicit member context', () => {
  assert.equal(parseMembershipDays('深渊点:15280 天族武器: 閃耀短劍 周一刚刚充的会员'), null)
  assert.equal(parseMembershipDays('深渊点:200000 天族武器: 盧德萊心臟 没会员 号上还有3亿基纳'), 0)
  assert.equal(parseMembershipDays('会员还有13天，4连号'), 13)
  assert.equal(parseMembershipDays('11111111天 梅斯蘭泰蓮 天8'), null)
})

test('enrichListingWithSellerRemark adds seller-derived account details', () => {
  const item = parseListings(`
    <a href="/product/123456/1">
      <span showtitle="【艾瑞爾】45级天族男弓星 装等4514 战斗力573.32K"
        attrnamelist="天族,艾瑞爾,男,弓星"
        price="500000"
        shelveuptimetext="9分钟前"></span>
    </a>
  `)[0]
  const enriched = enrichListingWithSellerRemark(item, '会员还有13天，4连号，小号290k')

  assert.equal(enriched.membershipDays, 13)
  assert.equal(enriched.linkedAccountCount, 4)
  assert.equal(enriched.linkedAccountLabel, '4连号')
  assert.deepEqual(enriched.children, [
    { type: '连号', label: '4连号', count: 4 },
    { type: '小号', label: '小号1', combatPower: '290K' },
  ])
  assert.equal(enriched.source, '螃蟹')
})

test('normalize7881Listing maps 7881 goods fields into the shared table model', () => {
  const item = normalize7881Listing({
    goodsId: '201612610455502',
    groupName: '天族（台服）',
    serverName: '卡薩卡',
    price: 988,
    lastTime: '2026-06-16 10:00:52',
    title: '战力评分K:558.3 性别:女 战力值:4413 5连号，558K大号+455K小号应龙弓+3个240K精灵魔道护法',
    subTitle: '账号类型-NC邮箱账号|职业-守护星|战力值-4413|守护力-1185|战力评分K-558.3|连体号-5连号',
  })

  assert.equal(item.productId, '7881-201612610455502')
  assert.equal(item.source, '7881')
  assert.equal(item.serverName, '卡薩卡')
  assert.equal(item.race, '天族')
  assert.equal(item.priceYuan, 988)
  assert.equal(item.profession, '守护星')
  assert.equal(item.equipmentLevel, '4413')
  assert.equal(item.combatPower, '558.3K')
  assert.equal(item.linkedAccountCount, 5)
  assert.equal(item.linkedAccountLabel, '5连号')
  assert.equal(item.publishedAtLabel, '2026-06-16 10:00:52')
  assert.equal(item.detailUrl, 'https://search.7881.com/201612610455502.html')
  assert.deepEqual(item.children, [
    { type: '连号', label: '5连号', count: 5 },
    { type: '小号', label: '小号1', combatPower: '455K' },
    { type: '小号', label: '小号2', combatPower: '240K' },
    { type: '小号', label: '小号3', combatPower: '240K' },
    { type: '小号', label: '小号4', combatPower: '240K' },
  ])
})

test('filterListings applies local price, race, profession, membership, and linked-account filters', () => {
  const rows = [
    { priceYuan: 600, race: '天族', profession: '弓星', membershipDays: 10, linkedAccountLabel: '4连号' },
    { priceYuan: 400, race: '魔族', profession: '弓星', membershipDays: 30, linkedAccountLabel: '5连号' },
    { priceYuan: 900, race: '魔族', profession: '魔道星', membershipDays: 60, linkedAccountLabel: '5连号' },
  ]

  assert.deepEqual(filterListings(rows, {
    minPrice: 500,
    race: '魔族',
    profession: '魔道星',
    minMemberDays: 30,
    linkedAccount: '5连号',
  }), [rows[2]])
})

test('normalizeFilters keeps independent user-provided source limits', () => {
  assert.deepEqual({
    pxb7Limit: normalizeFilters({ pxb7Limit: '12', source7881Limit: '45' }).pxb7Limit,
    source7881Limit: normalizeFilters({ pxb7Limit: '12', source7881Limit: '45' }).source7881Limit,
  }, {
    pxb7Limit: 12,
    source7881Limit: 45,
  })

  assert.deepEqual({
    pxb7Limit: normalizeFilters({ pxb7Limit: '0', source7881Limit: 'abc' }).pxb7Limit,
    source7881Limit: normalizeFilters({ pxb7Limit: '0', source7881Limit: 'abc' }).source7881Limit,
  }, {
    pxb7Limit: 100,
    source7881Limit: 100,
  })
})

test('scrapeListings reports readable 7881 HTML responses and keeps other sources', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    const requestUrl = String(url)
    if (requestUrl.includes('api-pc.pxb7.com')) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          list: [{
            productId: '2231636572488668783',
            price: 33000,
            showTitle: '【希塔尼耶】45级天族女护法星，装等3715，战斗力346.59K',
            attrNameList: ['天族', '希塔尼耶', 'NC邮箱账号', '护法星', '女'],
            shelveUpTimeText: '2分钟内发布',
          }],
        },
      }), {
        headers: { 'content-type': 'application/json' },
      })
    }
    if (requestUrl.includes('gw.7881.com')) {
      return new Response('<html>blocked</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    }
    throw new Error(`Unexpected fetch URL: ${requestUrl}`)
  }

  try {
    const result = await scrapeListings({ pxb7Limit: '1', source7881Limit: '1' })
    assert.equal(result.items.length, 1)
    assert.equal(result.warnings.length, 1)
    assert.equal(result.warnings[0].source, '7881')
    assert.match(result.warnings[0].message, /7881 接口未返回 JSON：HTTP 200/)
    assert.doesNotMatch(result.warnings[0].message, /Unexpected token/)
  } finally {
    globalThis.fetch = originalFetch
  }
})
