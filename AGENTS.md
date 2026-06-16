# AGENTS.md

本仓库是永恒之塔2台服账号行情小工具。

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
