import assert from 'node:assert/strict'
import test from 'node:test'

import {
  enrichListingWithSellerRemark,
  normalize7881Listing,
  parseChildCharacters,
  parseListings,
  parseSellerRemark,
} from './scrape.mjs'

test('parseListings extracts the requested marketplace fields', () => {
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
      sellerRemark: null,
      publishedAtLabel: '9分钟前',
      detailUrl: 'https://www.pxb7.com/product/123456/1',
    },
  ])
})

test('parseListings removes duplicate product ids without limiting source pages', () => {
  const card = (id) => `<a href="/product/${id}/1"><span showtitle="装等1 战斗力1K" attrnamelist="天族,天加隆,男,守护星" price="100" shelveuptimetext="刚刚"></span></a>`
  const html = [card(1), card(1), ...Array.from({ length: 20 }, (_, index) => card(index + 2))].join('')
  const items = parseListings(html)

  assert.equal(items.length, 21)
  assert.equal(new Set(items.map((item) => item.productId)).size, 21)
})

test('parseSellerRemark trims the detail page seller speech', () => {
  const bodyText = '卖家说*卖家自主行为，真实数据以最终验号为准会员还有13天，3个外观四连号，小号290k，210k，200k找回赔110%起'

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
    serverName: '卡薩卡 天15',
    price: 988,
    lastTime: '2026-06-16 10:00:52',
    title: '【战力评分K:558.3 性别:女 战力值:4413 5连号】558K大号+455K小号应龙弓+3个240K精灵魔道护法【7881平台】',
    subTitle: '账号类型-NC邮箱账号|职业-守护星|战力值-4413|守护力-1185|战力评分K-558.3|连体号-5连号',
  })

  assert.equal(item.productId, '7881-201612610455502')
  assert.equal(item.source, '7881')
  assert.equal(item.serverName, '卡薩卡 天15')
  assert.equal(item.race, '天族')
  assert.equal(item.priceYuan, 988)
  assert.equal(item.profession, '守护星')
  assert.equal(item.equipmentLevel, '4413')
  assert.equal(item.combatPower, '558.3K')
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
