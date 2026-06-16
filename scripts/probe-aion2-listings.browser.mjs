export default function probeAion2Listings() {
  const TARGET_HOST = 'www.pxb7.com'
  const TARGET_PATH_PREFIX = '/buy/175178554941486/'
  const PAGE_LIMIT = 16

  if (location.hostname !== TARGET_HOST || !location.pathname.startsWith(TARGET_PATH_PREFIX)) {
    throw new Error('请先打开已确认的永恒之塔2台服账号列表页')
  }

  const productLinks = Array.from(document.querySelectorAll('a[href^="/product/"]'))
    .slice(0, PAGE_LIMIT)

  const items = productLinks.map(link => {
    const href = link.getAttribute('href') || ''
    const rawText = (link.innerText || '').replace(/\s+/g, ' ').trim()
    const productId = href.match(/^\/product\/(\d+)\//)?.[1] || null
    const priceMatch = rawText.match(/￥\s*([\d,]+(?:\.\d{1,2})?)/)
    const publishedMatch = rawText.match(/(?:刚刚|\d+\s*(?:分钟|小时|天))内发布/)
    const equipmentLevelMatch = rawText.match(/装等\s*([\d.]+)/)
    const combatPowerMatch = rawText.match(/战斗力\s*([\d.]+\s*[KkMm]?)/)
    const gameMetadata = rawText.includes('永恒之塔2台服')
      ? rawText.slice(rawText.lastIndexOf('永恒之塔2台服') + '永恒之塔2台服'.length)
        .split('|')
        .map(value => value.trim())
        .filter(Boolean)
      : []
    const profession = gameMetadata[3]?.split('￥')[0].trim() || null

    return {
      productId,
      serverName: gameMetadata[1] || rawText.match(/【([^】]+)】/)?.[1] || null,
      race: gameMetadata[0] || rawText.match(/(天族|魔族)/)?.[1] || null,
      priceYuan: priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null,
      profession,
      equipmentLevel: equipmentLevelMatch?.[1] || null,
      combatPower: combatPowerMatch?.[1].replace(/\s+/g, '') || null,
      publishedAtLabel: publishedMatch?.[0] || null,
      detailUrl: new URL(href, location.origin).href
    }
  })

  const result = {
    sourceUrl: location.href,
    observedAt: new Date().toISOString(),
    filters: {
      productType: '账号',
      race: '天族',
      minimumPriceYuan: 500
    },
    itemCount: items.length,
    items
  }

  console.log(JSON.stringify(result, null, 2))
  return result
}
