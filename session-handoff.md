# Session Handoff

## Current Objective

保持校园物联网 SKILL 开发基线，同时交付永恒之塔2售卖数据的本地查询网站。

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

## Verification

| Check | Command | Expected |
|---|---|---|
| JSON、路径、API 注册一致性 | `node scripts/validate-wechat-ai-skill.mjs` | `Validation passed` |
| 完整启动检查 | `bash init.sh` | 所有检查通过 |
| AI 运行时 | 微信开发者工具 Nightly 最新版 | SKILL 可加载、接口可调用、卡片可展示 |
| 售卖数据探针 | `node scripts/validate-aion2-data-probe.mjs` | `Aion2 listing data probe validation passed` |
| 查询网站解析测试 | `cd aion2-market-dashboard && npm test` | 6 tests passed |
| 查询网站生产构建 | `cd aion2-market-dashboard && npm run build` | Vite build passed |
| 查询网站真实抓取 | `GET /api/listings?minPrice=500&race=天族&profession=弓星` | 81.9 秒返回 100 条、7 个来源页、来源=螃蟹、首条含 `4连号` 子集 |
| 查询网站双来源抓取 | `GET /api/listings?minPrice=500&race=天族&profession=弓星` | 85.9 秒返回 200 条、螃蟹 100 条、7881 100 条、总源页 11 页 |
| 查询网站交互验证 | in-app browser at `http://127.0.0.1:4173/` | 查询/重新抓取双按钮存在；无子集表头；默认 3 条卖家说展开；点击装等排序不重新抓取；发布时间排序夹具验证通过 |
| 查询网站分页验证 | in-app browser at `http://127.0.0.1:4173/` | 默认种族为全部；每页 10/50/100 切换可用，切换后回到第 1 页且不新增 `/api/listings` 调用 |

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

- 缺少校园物联网真实设备模型、后端 API 和角色权限矩阵。
- 高风险设备控制必须先确认审批和审计方案。
- 螃蟹的直接 HTTP 请求会返回反自动化挑战；当前实现只启动无登录 headless 浏览器读取公开页面，不绕过验证、不使用用户 Cookie。
- 7881 使用公开搜索页同源接口；接口需要 `lb-timestamp` 和 `lb-sign`，签名逻辑来自页面脚本 `lb-cry.js`。
- 当前重新抓取每个来源最多加载前 100 条，默认种族为“全部”以包含天族和魔族；不定时抓取、不保存历史；密集请求可能触发站点临时限流，禁止绕过。查询按钮、排序、翻页和每页条数切换只筛选或重排本地已抓取数据。

## Next Session Startup

1. 阅读 `AGENTS.md`、`progress.md` 和本文件。
2. 执行 `bash init.sh`。
3. 角色交易网站先阅读 `aion2-market-dashboard/AGENTS.md` 和 `design-qa.md`；校园任务恢复时只推进 `feat-002`。

## Recommended Next Step

角色交易网站扩展定时抓取或历史存储前先确认站点授权与频率；校园任务则继续完成 `feat-002`。
