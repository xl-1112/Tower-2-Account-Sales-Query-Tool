# Session Handoff

## Current Objective

交付永恒之塔2售卖数据的本地查询网站。

## Completed

- 已阅读微信 AI 模式和 SKILL 封装官方规范。
- 已创建仓库级 `AGENTS.md`、功能状态、进度、交接和验证文件。
- 已记录校园物联网的初始安全边界。
- 已新增 `docs/aion2-listing-data-probe.md`，约束角色交易数据任务的允许范围。
- 已新增浏览器 DOM 探针和自动校验，最多返回当前页前 16 条公开商品。
- 已支持区名、种族、价格、职业、装等、战斗力、发布时间和详情链接字段。
- 已新增 `aion2-market-dashboard`，支持价格和职业查询；每次查询重新抓取公开列表页。
- 已支持价格升序/降序、抓取状态与时间、价格摘要和详情跳转。
- 已新增解析测试、生产构建检查、浏览器交互证据与 `design-qa.md`。
- 已改为使用来源页原生无限滚动加载全部查询结果，每批 16 条，直到连续 3 次没有新增商品。
- 已新增网站端每页 10 条分页、页码跳转、上一页/下一页，并让价格排序自动回到第 1 页。
- 默认条件浏览器实测：87 个来源分页、1392 条商品、140 个网站分页。
- 已将单平台单次抓取上限改为 100 条，避免持续滚动触发限流。
- 已新增种族和会员天数筛选，查询仍会触发重新抓取。
- 已新增来源、会员天数、卖家说和账号子集字段；当前螃蟹详情页可从“卖家说”解析 `4连号`、小号战斗力等子集信息。
- 已接入 7881 搜索来源，使用公开搜索页同源接口和页面签名逻辑，按价格、种族、职业重新抓取。
- 7881 字段已映射到统一表格：`战力值` 作为装等，`战力评分K` 作为战斗力，标题/连体号作为子集来源，详情链接为 `https://search.7881.com/{goodsId}.html`。
- 已将筛选交互拆为“查询”和“重新抓取”：查询只筛选当前已抓取数据，重新抓取才访问平台。
- 已将价格、装等、战斗力、会员天数、发布时间排序移入表头；排序和分页不触发重新抓取。
- 已移除子集列，改为每行可展开卖家说详情；默认展开排序后前 3 行。
- 已将默认种族筛选改为“全部”，初始抓取覆盖天族和魔族；分页支持每页 10、50、100 条本地切换。
- 已新增 EdgeOne Pages Function：`aion2-market-dashboard/cloud-functions/api/listings.js`，线上 `/api/listings` 复用本地 `scrapeListings`。
- 已将螃蟹来源改为直接调用 `api-pc.pxb7.com/api/search/product/v2/selectSearchPageList` JSON 接口，线上不再依赖 Playwright 或本机 Chrome；7881 继续使用公开搜索接口签名逻辑。
- 已新增连体号筛选与展示：支持全部、4连号、5连号、6连号、7连号、8连号；数据模型新增 `linkedAccountCount` / `linkedAccountLabel`。
- 已支持从卖家说/标题中推断连体号：显式“4连号/连体号-5连号”直接识别；“小号158杀+181护+154弓”按主号+3个小号识别为 4 连号。
- 已修正会员天数识别：只从明确会员/战令/通行证上下文和会员到期日期解析，避免把深渊点、战力值、标题数字或天族字段误判为会员天数。
- 已接入螃蟹列表 API 的连体号标签：`important` 中的 `同职业4连号/6连号` 会优先映射到 `linkedAccountLabel`；无接口标签时继续从卖家说小号战力描述推断。
- 已将抓取数量上限改为用户分别配置：前端提供 `螃蟹上限` 和 `7881上限`，重新抓取时透传到本地 API/EdgeOne Function，后端按平台独立限制。
- 已新增战斗力本地筛选：前端提供 `战斗力 ≥` 数字输入，查询时按当前已抓取数据筛选，不触发重新抓取。
- 已新增最高角色等级解析与本地筛选：从卖家说/标题中的明确 `最高角色等级:50` 字段写入 `maxCharacterLevel`，前端提供仅允许数字的 `等级` 输入并精确匹配。
- 已修复最高角色等级与连体号数字粘连：解析时保留字段后的空格边界，`最高角色等级:49 4连号` 解析为 49，`最高角色等级:50 5连号` 解析为 50；真实抓取 200 条复核三位异常等级为 0。
- 已修复页面长期运行后的抓取卡死：纯 HTTP 抓取不再通过遗留全局队列串行等待，挂起的历史请求不会阻塞新的抓取请求。
- 螃蟹和 7881 单次来源请求均有 15 秒超时；聚合返回按来源和商品 ID 去重，避免首屏重复键复用旧节点。
- 前端重新抓取有 60 秒超时，会取消上一请求并只接收最新请求响应，旧响应无法覆盖新列表。
- 应用内浏览器真实验证刷新前后抓取时间成功变化，首屏 10 条链接唯一，加载期间及完成后展开按钮与详情链接均可用，浏览器错误为 0。
- 已在前端和后端职业选项中新增拳星；默认全部职业包含拳星，选择拳星可同时用于本地查询和重新抓取。
- 螃蟹与 7881 的拳星数据均映射为统一 `profession: 拳星` 并显示在列表职业列；应用内浏览器重新抓取返回 11 条拳星，首屏 10 条均正确显示。

## Verification

| Check | Command | Expected |
|---|---|---|
| JSON、路径、API 注册一致性 | `node scripts/validate-wechat-ai-skill.mjs` | `Validation passed` |
| 完整启动检查 | `bash init.sh` | 所有检查通过 |
| AI 运行时 | 微信开发者工具 Nightly 最新版 | SKILL 可加载、接口可调用、卡片可展示 |
| 售卖数据探针 | `node scripts/validate-aion2-data-probe.mjs` | `Aion2 listing data probe validation passed` |
| 查询网站解析测试 | `cd aion2-market-dashboard && npm test` | 21 tests passed |
| 查询网站生产构建 | `cd aion2-market-dashboard && npm run build` | Vite build passed |
| 查询网站真实抓取 | `GET /api/listings?minPrice=500&race=天族&profession=弓星` | 81.9 秒返回 100 条、7 个来源页、来源=螃蟹、首条含 `4连号` 子集 |
| 查询网站双来源抓取 | `GET /api/listings?minPrice=500&race=天族&profession=弓星` | 85.9 秒返回 200 条、螃蟹 100 条、7881 100 条、总源页 11 页 |
| 查询网站交互验证 | in-app browser at `http://127.0.0.1:4173/` | 查询/重新抓取双按钮存在；无子集表头；默认 3 条卖家说展开；点击装等排序不重新抓取；发布时间排序夹具验证通过 |
| 战斗力筛选验证 | `npm test && npm run build` | 战斗力下限输入仅保留数字；构建通过，筛选在前端本地完成 |
| 等级筛选验证 | `npm test && npm run build` + 本地浏览器 | 18 项测试通过，含 `49 4连号`、`50 5连号` 回归样例；本地 194 条数据查询 50 返回 93 条，浏览器无错误 |
| 查询网站分页验证 | in-app browser at `http://127.0.0.1:4173/` | 默认种族为全部；每页 10/50/100 切换可用，切换后回到第 1 页且不新增 `/api/listings` 调用 |
| EdgeOne Function 迁移验证 | `cloud-functions/api/listings.js` + local preview `/api/listings` | 直接调用函数返回 200 条，螃蟹/7881 各 100 条；本地 preview 返回 `Count=200`、`SourceCount=2`、`Warnings=0` |
| 连体号筛选验证 | `npm test` + Cloud Function fixture/live call | 10 项测试通过；`linkedAccount=4连号` 实测返回 47 条且结果标签均为 `4连号` |
| 会员天数修正验证 | live scrape anomaly scan | 真实抓取 200 条后 `membershipDays > 10000` 异常为 0 条 |
| 螃蟹连体号修正验证 | Cloud Function live call | `linkedAccount=4连号` 返回 84 条，其中螃蟹 39 条且结果标签均为 `4连号` |
| 双平台抓取上限验证 | live scrape + Cloud Function call | `pxb7Limit=5&source7881Limit=7` 返回螃蟹 5 条、7881 7 条；Function `pxb7Limit=3&source7881Limit=4` 返回总计 7 条 |
| 长期运行卡死回归 | `npm test` + in-app browser | 挂起旧抓取不阻塞新抓取；首屏 10 条链接唯一，重新抓取更新时间且列表交互正常，浏览器错误为 0 |
| 拳星职业验证 | `npm test` + in-app browser | 双来源拳星归一化与筛选通过；下拉可选拳星，重新抓取返回拳星且列表职业列正确显示 |

## Existing User Changes

- `project.config.json`
- `project.private.config.json`
- `skills/drink-skill/mcp.json`

这些改动在创建 harness 前已经存在，后续不得无故回滚。

## Files Changed

- `AGENTS.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`
- `init.sh`
- `docs/wechat-ai-skill-contract.md`
- `scripts/validate-wechat-ai-skill.mjs`
- `docs/aion2-listing-data-probe.md`
- `scripts/probe-aion2-listings.browser.mjs`
- `scripts/validate-aion2-data-probe.mjs`
- `aion2-market-dashboard/`

## Blockers / Risks

- 高风险设备控制必须先确认审批和审计方案。
- 螃蟹页面 HTML 仍会返回反自动化挑战；当前线上实现改用其公开 JSON 列表接口，不读取 Cookie、不绕过验证码。详情页“卖家说”暂以列表标题作为展开内容，后续若发现稳定详情 API 再补全。
- 7881 使用公开搜索页同源接口；接口需要 `lb-timestamp` 和 `lb-sign`，签名逻辑来自页面脚本 `lb-cry.js`。
- 当前重新抓取每个来源的数量由用户分别填写，默认螃蟹 100 条、7881 100 条；默认种族为“全部”以包含天族和魔族；不定时抓取、不保存历史；密集请求可能触发站点临时限流，禁止绕过。查询按钮、战斗力与等级筛选、排序、翻页和每页条数切换只筛选或重排本地已抓取数据。
- 根目录缺少 `app.json`、`page-meta.json`、`project.config.json`，微信 AI 校验当前有 4 个既有基线错误；等级筛选模块自身的测试、构建和数据探针校验均通过。
- 当前 Windows 终端找不到 `bash`，`bash init.sh` 无法执行；需在提供 Bash 的终端重试完整启动检查。

## Next Session Startup

1. 阅读 `AGENTS.md`、`progress.md` 和本文件。
2. 执行 `bash init.sh`。
3. 角色交易网站先阅读 `aion2-market-dashboard/AGENTS.md` 和 `design-qa.md`；校园任务恢复时只推进 `feat-002`。

## Recommended Next Step

角色交易网站扩展定时抓取或历史存储前先确认站点授权与频率；校园任务则继续完成 `feat-002`。
