# 微信小程序 AI SKILL 开发契约

本文将微信官方 AI 开发模式规范转成当前仓库可执行的工程规则，供后续校园物联网 SKILL 使用。

## 1. 能力模型

- 小程序 AI 通过小程序 MCP 分析用户意图，并选择原子接口和原子组件。
- 原子接口是单一业务功能的最小执行单元，运行在独立 JS 环境。
- 原子组件负责把接口返回的结构化数据渲染成对话流 GUI 卡片。
- 一个 SKILL 是完整场景能力包，可包含多个原子接口和组件。

标准目录：

```text
skills/campus-iot-skill/
|-- SKILL.md
|-- mcp.json
|-- index.js
|-- apis/
|-- components/
|-- utils/          # 项目需要时使用
`-- data/           # mock 或本地种子数据，禁止放密钥
```

## 2. MCP 声明

`mcp.json` 至少包含 `apis`，使用组件时包含 `components`。

- API 名称必须唯一，并与 `registerAPI` 完全一致。
- `description` 需要描述调用条件、禁止场景、数据来源和下一步动作。
- `inputSchema`、`outputSchema` 遵循 JSON Schema。
- 图片或文件输入字段使用 `format: "image"` 或 `format: "file"`。
- 卡片 API 使用 `_meta.ui.componentPath` 绑定组件。
- 每个组件必须配置固定 `relatedPage`；动态参数由 `setRelatedPage` 设置。

## 3. 原子接口返回值

```js
return {
  isError: false,
  content: [{ type: 'text', text: '事实说明和下一步引导' }],
  structuredContent: {
    // 模型需要理解且组件需要展示的数据
  },
  _meta: {
    // 模型不可见的私有数据或纯渲染数据
  }
}
```

- `isError`、`content`、`structuredContent` 会进入模型上下文。
- `_meta` 对模型不可见，只传给组件。
- `isError: true` 时不会渲染卡片，`structuredContent` 会被忽略。
- 当前 `content` 只使用文本块。
- 接口和中间件共享超时上限；中间件必须保持轻量并正确 `await next()`。

## 4. 原子组件约束

- 通过 `wx.modelContext.getContext(this)` 接收输入和结果通知。
- 通过 `wx.modelContext.getViewContext(this)` 获取尺寸、关联页面和半屏能力。
- 卡片初始化后高度不可变化；不得纵向滚动。
- 只依赖 tap、image load、image error 等受支持事件。
- 默认不使用网络、云开发或定时器；确需实时数据时声明 `scope.dynamic` 并说明场景。
- 不使用动画或打开小程序的接口。
- 可通过 `sendFollowUpMessage` 让用户继续流程，也可从组件打开半屏页面。
- 对状态已变化的控制卡片，优先声明 `expirable` 并及时设置过期态。

## 5. 半屏页面约束

- 只用于更多详情或补充信息，不是新的导航容器。
- 不调用页面路由、广告或跳出小程序的接口。
- 完成选择后，以用户第一人称发送文本，并可附带 `api/call` 指定下一接口。
- 使用 `wx.getDetailPageCloseButtonBoundingClientRect` 适配关闭按钮。

## 6. 校园物联网建议接口边界

首期候选接口，最终以业务确认结果为准：

| 原子接口 | 用途 | 风险策略 | 建议展示 |
|---|---|---|---|
| `searchCampusDevices` | 按建筑、房间、类型查询设备 | 只读 | 设备列表卡片 |
| `getDeviceStatus` | 查询在线状态、遥测和更新时间 | 只读 | 状态卡片 |
| `getEnvironmentMetrics` | 查询温湿度、CO2、照度、能耗 | 只读 | 指标卡片/半屏趋势 |
| `listActiveAlerts` | 查询当前告警 | 只读，隐藏敏感人员信息 | 告警卡片 |
| `requestDeviceControl` | 创建控制请求 | 低风险可执行，高风险进入审批 | 确认卡片 |
| `getControlRequestStatus` | 查询控制或审批状态 | 只读 | 结果卡片 |

高风险动作如门禁放行、总闸断电、消防联动默认不得由模型直接执行。

## 7. 校验与调试

自动校验：

```bash
node scripts/validate-wechat-ai-skill.mjs
```

手工校验必须使用微信开发者工具 Nightly 最新版，覆盖：

1. 模糊意图能选择正确 SKILL。
2. 明确设备查询能选择正确 API。
3. 缺少设备 ID 时会澄清，不猜测。
4. 权限不足、设备离线、接口超时都有可恢复出口。
5. 卡片 `relatedPage`、半屏回传和过期态正常。
6. 高风险动作不会绕过审批或二次确认。

## 8. 官方来源

- [小程序 AI 开发模式能力介绍](https://developers.weixin.qq.com/miniprogram/dev/ai/guide.html#_4%E3%80%81SKILL)
- [SKILL 封装与接入方式](https://developers.weixin.qq.com/miniprogram/dev/ai/integration.html#%E4%B8%89%E3%80%81SKILL-%E5%B0%81%E8%A3%85)

