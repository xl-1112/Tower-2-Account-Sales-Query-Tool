import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowClockwise,
  ArrowSquareOut,
  CheckCircle,
  ClockCounterClockwise,
  Database,
  FunnelSimple,
  MagnifyingGlass,
  WarningCircle,
} from '@phosphor-icons/react'

const professions = ['剑星', '守护星', '杀星', '弓星', '护法星', '精灵星', '治愈星', '魔道星', '拳星']
const races = ['天族', '魔族']
const linkedAccountOptions = ['4连号', '5连号', '6连号', '7连号', '8连号']
const pageSizeOptions = [10, 50, 100]
const refreshTimeoutMs = 60_000
const gameIcon = 'https://public-image.pxb7.com/pxb7-upload/game/image/20250929/1759125349054_rjtqzmqm8ul.jpg'

const defaultSort = { key: 'price', direction: 'asc' }
const defaultPlatformLimit = { 螃蟹: 100, 7881: 100 }
const sortLabels = {
  price: '价格',
  equipment: '装等',
  combat: '战斗力',
  membership: '会员天数',
  published: '发布时间',
}

function formatPlatformLimit(limit = defaultPlatformLimit) {
  const pxb7Limit = limit?.螃蟹 ?? defaultPlatformLimit.螃蟹
  const source7881Limit = limit?.['7881'] ?? defaultPlatformLimit['7881']
  return `螃蟹 ${pxb7Limit} 条 / 7881 ${source7881Limit} 条`
}

function formatCurrency(value) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatTimestamp(value) {
  if (!value) return '尚未抓取'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function rowKey(item) {
  return `${item.source}-${item.productId}`
}

function numberValue(value) {
  if (value === null || value === undefined || value === '') return null
  const match = String(value).replace(/,/g, '').match(/[\d.]+/)
  return match ? Number(match[0]) : null
}

function publishedTimeValue(value) {
  if (!value) return null
  const text = String(value).trim()
  const absoluteMatch = text.match(/20\d{2}[-/]\d{1,2}[-/]\d{1,2}(?:\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)?/)
  if (absoluteMatch) {
    const timestamp = new Date(absoluteMatch[0].replace(/\//g, '-')).getTime()
    return Number.isFinite(timestamp) ? timestamp : null
  }

  const relativeMatch = text.match(/(\d+(?:\.\d+)?)(?:\s*)(秒|分钟|小时|天|周|月).*前/)
  if (relativeMatch) {
    const amount = Number(relativeMatch[1])
    const unitMs = {
      秒: 1000,
      分钟: 60000,
      小时: 3600000,
      天: 86400000,
      周: 604800000,
      月: 2592000000,
    }[relativeMatch[2]]
    return Date.now() - amount * unitMs
  }

  if (text.includes('刚刚')) return Date.now()
  return null
}

function sortMetric(item, key) {
  if (key === 'price') return Number(item.priceYuan)
  if (key === 'equipment') return numberValue(item.equipmentLevel)
  if (key === 'combat') return numberValue(item.combatPower)
  if (key === 'membership') return item.membershipDays ?? null
  if (key === 'published') return publishedTimeValue(item.publishedAtLabel)
  return 0
}

function sortRows(rows, sortConfig) {
  return [...rows].sort((left, right) => {
    const leftValue = sortMetric(left, sortConfig.key)
    const rightValue = sortMetric(right, sortConfig.key)
    if (leftValue === null && rightValue === null) return 0
    if (leftValue === null) return 1
    if (rightValue === null) return -1
    return sortConfig.direction === 'asc' ? leftValue - rightValue : rightValue - leftValue
  })
}

function selectedOptions(value) {
  if (Array.isArray(value)) return value
  if (!value || value === '全部') return []
  return String(value).split(',').map((item) => item.trim()).filter(Boolean)
}

function optionLabel(selected, allOptions) {
  if (!selected.length || selected.length === allOptions.length) return '全部'
  return selected.join('、')
}

function filterRows(rows, activeFilters) {
  const minPrice = Number(activeFilters.minPrice || 0)
  const maxPrice = activeFilters.maxPrice ? Number(activeFilters.maxPrice) : Number.POSITIVE_INFINITY
  const minMemberDays = Number(activeFilters.minMemberDays || 0)
  const minCombatPower = Number(activeFilters.minCombatPower || 0)
  const characterLevel = Number(activeFilters.characterLevel || 0)
  const selectedRaces = selectedOptions(activeFilters.race)
  const selectedLinkedAccounts = selectedOptions(activeFilters.linkedAccount)
  const selectedProfessions = selectedOptions(activeFilters.profession)

  return rows.filter((item) => {
    const priceMatches = item.priceYuan >= minPrice && item.priceYuan <= maxPrice
    const combatPowerValue = numberValue(item.combatPower) || 0
    const combatMatches = minCombatPower <= 0 || combatPowerValue >= minCombatPower
    const levelMatches = characterLevel <= 0 || item.maxCharacterLevel === characterLevel
    const professionMatches = !selectedProfessions.length || selectedProfessions.includes(item.profession)
    const raceMatches = !selectedRaces.length || selectedRaces.includes(item.race)
    const linkedMatches = !selectedLinkedAccounts.length || selectedLinkedAccounts.includes(item.linkedAccountLabel)
    const memberMatches = minMemberDays <= 0 || (item.membershipDays || 0) >= minMemberDays
    return priceMatches && combatMatches && levelMatches && professionMatches && raceMatches && linkedMatches && memberMatches
  })
}

function defaultExpandedRows(rows, sortConfig) {
  return new Set(sortRows(rows, sortConfig).slice(0, 3).map(rowKey))
}

function StatusBadge({ loading, error }) {
  if (loading) {
    return <span className="status-badge loading"><ArrowClockwise size={15} /> 正在重新抓取</span>
  }
  if (error) {
    return <span className="status-badge error"><WarningCircle size={15} weight="fill" /> 抓取失败</span>
  }
  return <span className="status-badge success"><CheckCircle size={15} weight="fill" /> 数据已更新</span>
}

function SortHeader({ label, name, sortConfig, onSort }) {
  const active = sortConfig.key === name
  return (
    <button className={`sortable-header ${active ? 'active' : ''}`} type="button" onClick={() => onSort(name)}>
      <span>{label}</span>
      <span className="sort-arrows" aria-hidden="true">
        <i className={active && sortConfig.direction === 'asc' ? 'on' : ''} />
        <i className={active && sortConfig.direction === 'desc' ? 'on' : ''} />
      </span>
    </button>
  )
}

function MultiSelectDropdown({ label, options, selected, onChange, keepOne = false }) {
  const current = selectedOptions(selected)
  const toggleOption = (option) => {
    const next = current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option]
    onChange(keepOne && !next.length ? [...options] : next)
  }

  return (
    <div className="field-group">
      <span>{label}</span>
      <details className="multi-select">
        <summary>
          <span>{optionLabel(current, options)}</span>
        </summary>
        <div className="multi-select-menu">
          {options.map((option) => (
            <label className="multi-select-option" key={option}>
              <input
                type="checkbox"
                checked={current.includes(option)}
                onChange={() => toggleOption(option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </details>
    </div>
  )
}

export function App() {
  const defaultFilters = useMemo(() => ({
    minPrice: '500',
    maxPrice: '',
    profession: [...professions],
    race: [...races],
    linkedAccount: [],
    minCombatPower: '',
    characterLevel: '',
    minMemberDays: '',
    pxb7Limit: '100',
    source7881Limit: '100',
  }), [])
  const [filters, setFilters] = useState(defaultFilters)
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters)
  const [allItems, setAllItems] = useState([])
  const [items, setItems] = useState([])
  const [expandedRows, setExpandedRows] = useState(new Set())
  const [observedAt, setObservedAt] = useState('')
  const [sourcePagesFetched, setSourcePagesFetched] = useState(0)
  const [sourceStats, setSourceStats] = useState([])
  const [sourceWarnings, setSourceWarnings] = useState([])
  const [platformLimit, setPlatformLimit] = useState(defaultPlatformLimit)
  const [sortConfig, setSortConfig] = useState(defaultSort)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(pageSizeOptions[0])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refreshControllerRef = useRef(null)
  const refreshRequestIdRef = useRef(0)

  const applyLocalFilters = useCallback((nextFilters, sourceItems = allItems, nextSort = sortConfig) => {
    const filteredItems = filterRows(sourceItems, nextFilters)
    setItems(filteredItems)
    setAppliedFilters(nextFilters)
    setCurrentPage(1)
    setExpandedRows(defaultExpandedRows(filteredItems, nextSort))
  }, [allItems, sortConfig])

  const refresh = useCallback(async (nextFilters) => {
    refreshControllerRef.current?.abort()
    const controller = new AbortController()
    const requestId = refreshRequestIdRef.current + 1
    refreshControllerRef.current = controller
    refreshRequestIdRef.current = requestId
    const timeoutId = setTimeout(() => controller.abort(), refreshTimeoutMs)

    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        minPrice: nextFilters.minPrice || '0',
      })
      params.set('profession', selectedOptions(nextFilters.profession).join(',') || '全部')
      params.set('race', selectedOptions(nextFilters.race).join(',') || '全部')
      params.set('linkedAccount', selectedOptions(nextFilters.linkedAccount).join(',') || '全部')
      if (nextFilters.maxPrice) params.set('maxPrice', nextFilters.maxPrice)
      if (nextFilters.minMemberDays) params.set('minMemberDays', nextFilters.minMemberDays)
      params.set('pxb7Limit', nextFilters.pxb7Limit || String(defaultPlatformLimit.螃蟹))
      params.set('source7881Limit', nextFilters.source7881Limit || String(defaultPlatformLimit['7881']))

      const response = await fetch(`/api/listings?${params}`, { signal: controller.signal })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message || '重新抓取失败')
      if (requestId !== refreshRequestIdRef.current) return

      const nextItems = payload.items || []
      const filteredItems = filterRows(nextItems, nextFilters)

      setAllItems(nextItems)
      setItems(filteredItems)
      setObservedAt(payload.observedAt)
      setSourcePagesFetched(payload.sourcePagesFetched)
      setSourceStats(payload.sources || [])
      setSourceWarnings(payload.warnings || [])
      setPlatformLimit(payload.platformLimit || defaultPlatformLimit)
      setAppliedFilters(nextFilters)
      setCurrentPage(1)
      setExpandedRows(defaultExpandedRows(filteredItems, defaultSort))
    } catch (caughtError) {
      if (requestId !== refreshRequestIdRef.current) return
      setError(controller.signal.aborted ? '重新抓取超时，请稍后重试' : caughtError.message)
    } finally {
      clearTimeout(timeoutId)
      if (requestId === refreshRequestIdRef.current) {
        refreshControllerRef.current = null
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    refresh(defaultFilters)
    return () => {
      refreshRequestIdRef.current += 1
      refreshControllerRef.current?.abort()
    }
  }, [defaultFilters, refresh])

  const sortedItems = useMemo(() => sortRows(items, sortConfig), [items, sortConfig])
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize))
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedItems.slice(start, start + pageSize)
  }, [currentPage, pageSize, sortedItems])

  const visiblePages = useMemo(() => {
    const candidates = [1, currentPage - 1, currentPage, currentPage + 1, totalPages]
    return [...new Set(candidates.filter((page) => page >= 1 && page <= totalPages))]
  }, [currentPage, totalPages])

  const summary = useMemo(() => {
    if (!items.length) return { lowest: null, highest: null, average: null }
    const prices = items.map((item) => item.priceYuan)
    return {
      lowest: Math.min(...prices),
      highest: Math.max(...prices),
      average: Math.round(prices.reduce((sum, value) => sum + value, 0) / prices.length),
    }
  }, [items])

  const handleSubmit = (event) => {
    event.preventDefault()
    applyLocalFilters(filters)
  }

  const handleRefresh = () => {
    refresh(filters)
  }

  const resetFilters = () => {
    setFilters(defaultFilters)
    applyLocalFilters(defaultFilters, allItems)
  }

  const handleSort = (name) => {
    const nextSort = sortConfig.key === name
      ? { key: name, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' }
      : { key: name, direction: 'asc' }
    setSortConfig(nextSort)
    setCurrentPage(1)
    setExpandedRows(defaultExpandedRows(items, nextSort))
  }

  const toggleRow = (item) => {
    const key = rowKey(item)
    setExpandedRows((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img src={gameIcon} alt="永恒之塔2台服" className="game-icon" />
          <div>
            <p className="eyebrow">AION 2 MARKET WATCH</p>
            <h1>永恒之塔2台服账号行情</h1>
          </div>
        </div>
        <a className="source-link" href="https://www.pxb7.com/buy/175178554941486/1" target="_blank" rel="noreferrer">
          螃蟹源 <ArrowSquareOut size={16} />
        </a>
        <a className="source-link" href="https://search.7881.com/G6212-100003-0-0-0.html?pageNum=1" target="_blank" rel="noreferrer">
          7881源 <ArrowSquareOut size={16} />
        </a>
      </header>

      <section className="hero-copy">
        <div>
          <span className="section-kicker">公开售卖数据</span>
          <h2>快速比较角色价格、职业和账号详情</h2>
          <p>查询只筛选当前已抓取的数据；重新抓取才访问螃蟹和 7881。当前抓取上限：{formatPlatformLimit(platformLimit)}。</p>
        </div>
        <div className="freshness-card">
          <StatusBadge loading={loading} error={error} />
          <div className="freshness-time">
            <ClockCounterClockwise size={17} />
            抓取时间：{formatTimestamp(observedAt)}
          </div>
        </div>
      </section>

      <form className="filter-panel" onSubmit={handleSubmit}>
        <div className="filter-heading">
          <div>
            <FunnelSimple size={20} weight="fill" />
            <span>查询条件</span>
          </div>
          <button type="button" className="reset-button" onClick={resetFilters} disabled={loading}>
            重置筛选
          </button>
        </div>

        <div className="filter-grid">
          <label className="field-group">
            <span>最低价格</span>
            <div className="input-wrap">
              <span>¥</span>
              <input
                inputMode="numeric"
                min="0"
                type="number"
                value={filters.minPrice}
                onChange={(event) => setFilters({ ...filters, minPrice: event.target.value })}
                placeholder="500"
              />
            </div>
          </label>

          <label className="field-group">
            <span>最高价格</span>
            <div className="input-wrap">
              <span>¥</span>
              <input
                inputMode="numeric"
                min="0"
                type="number"
                value={filters.maxPrice}
                onChange={(event) => setFilters({ ...filters, maxPrice: event.target.value })}
                placeholder="不限"
              />
            </div>
          </label>

          <MultiSelectDropdown
            label="种族"
            options={races}
            selected={filters.race}
            keepOne
            onChange={(race) => setFilters({ ...filters, race })}
          />

          <MultiSelectDropdown
            label="职业"
            options={professions}
            selected={filters.profession}
            keepOne
            onChange={(profession) => setFilters({ ...filters, profession })}
          />

          <MultiSelectDropdown
            label="连体号"
            options={linkedAccountOptions}
            selected={filters.linkedAccount}
            onChange={(linkedAccount) => setFilters({ ...filters, linkedAccount })}
          />

          <label className="field-group">
            <span>战斗力 ≥</span>
            <div className="input-wrap">
              <input
                inputMode="numeric"
                min="0"
                pattern="[0-9]*"
                type="number"
                value={filters.minCombatPower}
                onChange={(event) => setFilters({ ...filters, minCombatPower: event.target.value.replace(/\D/g, '') })}
                placeholder="不限"
              />
            </div>
          </label>

          <label className="field-group">
            <span>会员天数 ≥</span>
            <div className="input-wrap">
              <input
                inputMode="numeric"
                min="0"
                type="number"
                value={filters.minMemberDays}
                onChange={(event) => setFilters({ ...filters, minMemberDays: event.target.value })}
                placeholder="不限"
              />
            </div>
          </label>

          <label className="field-group">
            <span>等级</span>
            <div className="input-wrap">
              <input
                inputMode="numeric"
                min="0"
                pattern="[0-9]*"
                type="number"
                value={filters.characterLevel}
                onChange={(event) => setFilters({ ...filters, characterLevel: event.target.value.replace(/\D/g, '') })}
                placeholder="不限"
              />
            </div>
          </label>

          <label className="field-group">
            <span>螃蟹上限</span>
            <div className="input-wrap">
              <input
                inputMode="numeric"
                min="1"
                type="number"
                value={filters.pxb7Limit}
                onChange={(event) => setFilters({ ...filters, pxb7Limit: event.target.value })}
                placeholder="100"
              />
            </div>
          </label>

          <label className="field-group">
            <span>7881上限</span>
            <div className="input-wrap">
              <input
                inputMode="numeric"
                min="1"
                type="number"
                value={filters.source7881Limit}
                onChange={(event) => setFilters({ ...filters, source7881Limit: event.target.value })}
                placeholder="100"
              />
            </div>
          </label>

          <div className="filter-actions">
            <button className="query-button" type="submit" disabled={loading}>
              <MagnifyingGlass size={18} weight="bold" />
              查询
            </button>
            <button className="search-button" type="button" onClick={handleRefresh} disabled={loading}>
              {loading ? <ArrowClockwise className="spin" size={18} /> : <ArrowClockwise size={18} />}
              {loading ? '抓取中' : '重新抓取'}
            </button>
          </div>
        </div>

        <div className="active-filter-row">
          <span>当前筛选</span>
          <b>账号</b>
          <b>{optionLabel(selectedOptions(appliedFilters.race), races)}</b>
          <b>价格 ≥ {appliedFilters.minPrice || 0}</b>
          {appliedFilters.maxPrice && <b>价格 ≤ {appliedFilters.maxPrice}</b>}
          <b>{optionLabel(selectedOptions(appliedFilters.profession), professions)}</b>
          <b>连体号：{optionLabel(selectedOptions(appliedFilters.linkedAccount), linkedAccountOptions)}</b>
          {appliedFilters.minCombatPower && <b>战斗力 ≥ {appliedFilters.minCombatPower}K</b>}
          {appliedFilters.characterLevel && <b>等级 = {appliedFilters.characterLevel}</b>}
          {appliedFilters.minMemberDays && <b>会员 ≥ {appliedFilters.minMemberDays} 天</b>}
          <b>下次抓取上限：螃蟹 {appliedFilters.pxb7Limit || defaultPlatformLimit.螃蟹} / 7881 {appliedFilters.source7881Limit || defaultPlatformLimit['7881']}</b>
          <b>来源：螃蟹 + 7881</b>
        </div>
      </form>

      {!!sourceWarnings.length && (
        <div className="warning-banner" role="status">
          <WarningCircle size={21} weight="fill" />
          <div>
            <strong>部分来源暂时不可用</strong>
            <span>{sourceWarnings.map((warning) => `${warning.source}：${warning.message}`).join('；')}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="error-banner" role="alert">
          <WarningCircle size={21} weight="fill" />
          <div><strong>这次没有拿到新数据</strong><span>{error}。已保留上一轮结果。</span></div>
          <button type="button" onClick={handleRefresh}>重试</button>
        </div>
      )}

      <section className="summary-grid" aria-label="价格概览">
        <article><span><Database size={18} /> 匹配账号</span><strong>{loading && !items.length ? '-' : items.length}</strong><small>已抓取 {allItems.length || '-'} 条；{sourceStats.length ? sourceStats.map((source) => `${source.source} ${source.itemCount}/${source.sourceLimit || '-'}`).join(' / ') : formatPlatformLimit(platformLimit)}</small></article>
        <article><span>最低价格</span><strong>{summary.lowest === null ? '-' : formatCurrency(summary.lowest)}</strong><small>当前筛选结果</small></article>
        <article><span>平均价格</span><strong>{summary.average === null ? '-' : formatCurrency(summary.average)}</strong><small>排序：{sortLabels[sortConfig.key]}{sortConfig.direction === 'asc' ? '升序' : '降序'}</small></article>
        <article><span>最高价格</span><strong>{summary.highest === null ? '-' : formatCurrency(summary.highest)}</strong><small>抓取 {sourcePagesFetched || '-'} 源页</small></article>
      </section>

      <section className="results-panel">
        <div className="results-header">
          <div>
            <h3>账号列表</h3>
            <p>表头可切换价格、装等、战斗力、会员天数和发布时间排序；连体号会从标题、卖家说和小号描述中识别。</p>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th aria-label="展开详情" />
                <th>来源</th>
                <th>区名</th>
                <th>种族</th>
                <th><SortHeader label="价格" name="price" sortConfig={sortConfig} onSort={handleSort} /></th>
                <th>职业</th>
                <th>连体号</th>
                <th><SortHeader label="装等" name="equipment" sortConfig={sortConfig} onSort={handleSort} /></th>
                <th><SortHeader label="战斗力" name="combat" sortConfig={sortConfig} onSort={handleSort} /></th>
                <th><SortHeader label="会员天数" name="membership" sortConfig={sortConfig} onSort={handleSort} /></th>
                <th><SortHeader label="发布时间" name="published" sortConfig={sortConfig} onSort={handleSort} /></th>
                <th aria-label="详情链接" />
              </tr>
            </thead>
            <tbody>
              {loading && !items.length && Array.from({ length: 7 }).map((_, index) => (
                <tr className="skeleton-row" key={index}>{Array.from({ length: 12 }).map((__, cell) => <td key={cell}><span /></td>)}</tr>
              ))}
              {!loading && !sortedItems.length && (
                <tr><td colSpan="12"><div className="empty-state"><MagnifyingGlass size={28} /><strong>没有符合条件的账号</strong><span>调整条件后点击“查询”筛选当前数据，或点击“重新抓取”更新来源数据。</span></div></td></tr>
              )}
              {paginatedItems.map((item) => {
                const key = rowKey(item)
                const expanded = expandedRows.has(key)
                return (
                  <Fragment key={key}>
                    <tr>
                      <td>
                        <button className={`expand-toggle ${expanded ? 'expanded' : ''}`} type="button" onClick={() => toggleRow(item)} aria-label={`${expanded ? '收起' : '展开'}卖家说`}>
                          <span />
                        </button>
                      </td>
                      <td><span className="source-tag">{item.source || '螃蟹'}</span></td>
                      <td><strong className="server-name">{item.serverName}</strong></td>
                      <td><span className="race-tag">{item.race}</span></td>
                      <td><strong className="price-cell">{formatCurrency(item.priceYuan)}</strong></td>
                      <td>{item.profession || '-'}</td>
                      <td><span className="linked-tag">{item.linkedAccountLabel || '-'}</span></td>
                      <td>{item.equipmentLevel || '-'}</td>
                      <td><span className="power-value">{item.combatPower || '-'}</span></td>
                      <td><span className="member-value">{item.membershipDays === null ? '-' : `${item.membershipDays}天`}</span></td>
                      <td><span className="published-time">{item.publishedAtLabel || '-'}</span></td>
                      <td><a className="detail-button" href={item.detailUrl} target="_blank" rel="noreferrer" aria-label={`查看 ${item.serverName} ${item.profession} 详情`}><ArrowSquareOut size={18} /></a></td>
                    </tr>
                    {expanded && (
                      <tr className="detail-row">
                        <td colSpan="12">
                          <div className="seller-remark">
                            <strong>卖家说</strong>
                            <p>{item.sellerRemark || item.title || '暂无卖家说内容'}</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        {!loading && sortedItems.length > 0 && (
          <nav className="pagination" aria-label="结果分页">
            <div className="pagination-meta">
              <span>第 {currentPage} / {totalPages} 页，每页</span>
              <select className="page-size-select" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setCurrentPage(1) }} aria-label="每页显示条数">
                {pageSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
              <span>条，共 {sortedItems.length} 条</span>
            </div>
            <div className="pagination-actions">
              <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)}>上一页</button>
              {visiblePages.map((page, index) => (
                <span className="page-slot" key={page}>
                  {index > 0 && page - visiblePages[index - 1] > 1 && <i>...</i>}
                  <button type="button" className={page === currentPage ? 'active' : ''} onClick={() => setCurrentPage(page)}>{page}</button>
                </span>
              ))}
              <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => page + 1)}>下一页</button>
            </div>
          </nav>
        )}
      </section>

      <footer className="page-footer">数据仅用于公开市场观察，不代表交易建议。</footer>
    </main>
  )
}
