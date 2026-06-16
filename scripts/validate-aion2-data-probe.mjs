import assert from 'node:assert/strict'
import fs from 'node:fs'
import probeAion2Listings from './probe-aion2-listings.browser.mjs'

const scriptPath = new URL('./probe-aion2-listings.browser.mjs', import.meta.url)
const source = fs.readFileSync(scriptPath, 'utf8')

const forbiddenPatterns = [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /\.click\s*\(/,
  /\bscroll(?:To|By)?\s*\(/,
  /location\.(?:assign|replace)\s*\(/,
  /window\.open\s*\(/
]

for (const pattern of forbiddenPatterns) {
  assert.equal(pattern.test(source), false, `probe contains forbidden behavior: ${pattern}`)
}

const samples = [
  ['/product/111/1', '【艾瑞爾】45级天族男弓星，装等4514，战斗力573.32K 永恒之塔2台服 | 天族 | 艾瑞爾 | NC手机账号 | 弓星 | 男 ￥750 17分钟内发布'],
  ['/product/222/1', '【納尼亞】45级天族女剑星，装等5197，战斗力704.07K 永恒之塔2台服 | 天族 | 納尼亞 | NC手机账号 | 剑星 | 女 ￥4,999 2小时内发布'],
  ['/product/333/1', '【凱西內爾】天族护法星，装等45，战斗力566K 永恒之塔2台服 | 天族 | 凱西內爾 | NC邮箱账号 | 护法星 ￥600 1天内发布'],
  ...Array.from({ length: 14 }, (_, index) => [
    `/product/${444 + index}/1`,
    `【测试区${index}】天族治愈星，装等4000，战斗力500K 永恒之塔2台服 | 天族 | 测试区${index} | NC邮箱账号 | 治愈星 ￥800 1天内发布`
  ])
].map(([href, innerText]) => ({
  innerText,
  getAttribute(name) {
    return name === 'href' ? href : null
  }
}))

const originalLocation = globalThis.location
const originalDocument = globalThis.document
const originalConsoleLog = console.log

globalThis.location = {
  hostname: 'www.pxb7.com',
  pathname: '/buy/175178554941486/1',
  origin: 'https://www.pxb7.com',
  href: 'https://www.pxb7.com/buy/175178554941486/1'
}
globalThis.document = {
  querySelectorAll(selector) {
    assert.equal(selector, 'a[href^="/product/"]')
    return samples
  }
}
console.log = () => {}

let result
try {
  result = probeAion2Listings()
} finally {
  console.log = originalConsoleLog
  if (originalLocation === undefined) delete globalThis.location
  else globalThis.location = originalLocation
  if (originalDocument === undefined) delete globalThis.document
  else globalThis.document = originalDocument
}

assert.equal(result.itemCount, 16)
assert.equal(result.items[0].productId, '111')
assert.equal(result.items[0].serverName, '艾瑞爾')
assert.equal(result.items[0].race, '天族')
assert.equal(result.items[0].priceYuan, 750)
assert.equal(result.items[0].profession, '弓星')
assert.equal(result.items[0].equipmentLevel, '4514')
assert.equal(result.items[0].combatPower, '573.32K')
assert.equal(result.items[1].priceYuan, 4999)
assert.equal(result.items[1].publishedAtLabel, '2小时内发布')
assert.equal(result.items[2].profession, '护法星')
assert.equal(result.items[2].combatPower, '566K')
assert.equal(result.items.some(item => item.productId === '457'), false)

console.log('Aion2 listing data probe validation passed')
