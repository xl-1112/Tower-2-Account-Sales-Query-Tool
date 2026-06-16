# AGENTS.md

本仓库是微信小程序 AI 开发模式示例。当前目标是在现有饮品 demo 基础上，设计并实现一个校园物联网 `SKILL`。

## Startup Workflow / 启动流程

Before writing code：

1. 阅读本文件、`README.md`、`docs/wechat-ai-skill-contract.md`。
2. 阅读 `feature_list.json`、`progress.md`、`session-handoff.md`。
3. 执行 `node scripts/validate-wechat-ai-skill.mjs`；有基线错误时先修复。
4. One feature at a time：每次只推进 `feature_list.json` 中一个未完成功能。
5. 保留用户已有改动，不修改无关业务。

处理角色交易数据任务时，还需阅读 `docs/aion2-listing-data-probe.md`，并执行
`node scripts/validate-aion2-data-probe.mjs`。

Stay in scope：当前功能未要求的重构、依赖升级和业务改写一律不做。

## 微信 AI SKILL 不变量

- 一个 SKILL 至少包含 `SKILL.md`、`mcp.json`、`index.js`、`apis/`；需要卡片时再加入 `components/`。
- `app.json.agent.skills[].path`、`wx.modelContext.createSkill(path)` 和实际目录必须完全一致。
- `mcp.json.apis[].name` 必须与 `skill.registerAPI(name, handler)` 一一对应，不能漏注册、重复或只写一侧。
- `inputSchema`、`outputSchema` 遵循 JSON Schema；字段描述应说明来源、边界、必填条件和禁止编造规则。
- 成功结果使用 `isError: false`；`content` 负责事实与后续动作，`structuredContent` 只放模型需要理解的结构化数据，私有或纯渲染数据放 `_meta`。
- 失败结果使用 `isError: true`；说明失败事实和可恢复出口，不返回可渲染卡片数据。
- 绑定原子组件的 API 必须配置 `_meta.ui.componentPath`；对应组件必须在 `mcp.json.components` 中声明 `relatedPage`。
- 原子组件只设计有限高度内的点击交互，不使用滚动、动画或小程序跳转 API。网络请求和定时器仅在确有实时需求时声明 `scope.dynamic`。
- 半屏页面只用于详情或补充输入；不得继续页面路由。完成操作后以用户第一人称调用 `sendFollowUpMessage` 回到 AI 流程。
- 当前能力处于 beta，AI 模式代码不得未经确认合入正式提审版本。
- 不提交真实 AppID、令牌、设备密钥、校园人员隐私或生产接口凭证。

## 校园物联网设计边界

- 第一阶段只做查询与低风险控制：设备状态、环境数据、告警、教室/实验室设备控制申请。
- 对开门、断电、消防、门禁放行等高风险动作，默认只查询或创建审批，不直接执行。
- 所有控制接口都要显式包含设备标识、目标状态、权限依据、幂等键和审计结果。
- 实时卡片必须给出数据时间戳、数据来源和过期态，避免把历史数据描述为实时状态。
- 用户、建筑、房间、设备等标识必须来自上游接口返回值或已认证上下文，禁止模型猜测。

## 公开交易数据探针边界

- 第一阶段只验证当前已打开列表页中的公开数据可被读取，不做批量抓取。
- 只读取当前 DOM，不主动发起网络请求，不翻页、不滚动加载、不访问商品详情。
- 不读取或导出 Cookie、Local Storage、账号信息等浏览器私有状态。
- 不绕过验证码、风控、登录、访问频率限制或其他反自动化措施。
- 默认最多返回当前页前 16 条，只输出到标准输出，不落库、不生成跨页数据集。
- 目标页面、字段定义和后续采集频率必须在进入下一功能前重新确认。

## Definition of Done / 完成标准

- 目标行为已实现，且作用域符合当前功能定义。
- `node scripts/validate-wechat-ai-skill.mjs` 通过。
- 在微信开发者工具 Nightly 最新版中完成必要的手工验证并记录证据。
- 更新 `feature_list.json`、`progress.md`；跨会话任务同步更新 `session-handoff.md`。

## Verification Commands / 验证命令

```bash
# Full verification and static/lint-like checks
bash init.sh

# Direct validator, also performs JavaScript syntax checks
node scripts/validate-wechat-ai-skill.mjs
```

当前仓库没有独立单元 test runner 或 build/type-check 流程。新增可独立测试的业务逻辑时，应同时补充 test 命令，并写入 `init.sh`。

## End of Session / 会话结束

Before ending：

1. 重新运行验证命令并记录结果。
2. 更新 `feature_list.json` 的 status 和 evidence。
3. 更新 `progress.md`；有未完成工作时更新 `session-handoff.md`。
4. 记录 blockers、风险和下一步，不在验证失败时声称完成。
5. 保持仓库 clean/restartable；不得删除或覆盖用户已有改动。

## 官方资料

- [能力介绍](https://developers.weixin.qq.com/miniprogram/dev/ai/guide.html#_4%E3%80%81SKILL)
- [SKILL 封装](https://developers.weixin.qq.com/miniprogram/dev/ai/integration.html#%E4%B8%89%E3%80%81SKILL-%E5%B0%81%E8%A3%85)
