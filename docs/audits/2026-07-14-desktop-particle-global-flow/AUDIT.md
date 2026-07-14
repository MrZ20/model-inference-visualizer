# Desktop particle Global Flow audit

- 日期：2026-07-14
- Git 基线：`3ffdb16` (`main == origin/main`)
- 轨迹：`qwen35-a3b-w8a8-20260710-p4r4`
- 当前预览：本地 Vite production preview；最终端口以 `CURRENT_STATE.md` 为准
- 用户验收：**未通过；用户将继续指正视觉方向**

## 1. 本轮完成的核心实现

- 六张等形流程卡被替换为一条桌面 2.5D 管线：10 shards → 5 Token/ID → `[5, 2048]` → 40 层 → `[1, 248320]` top logits → completion。
- `buildGlobalFlowModel()` 从 `TraceExperience` 统一投影事实并执行不变量检查；页面不再持有 Token、shape、30/10 和 logits shape 常量。
- DOM 承载语义对象，SVG 流带连接测量后的 anchor，Canvas 使用稳定 seed 绘制确定性粒子。
- `PlaybackEngine` 仍是唯一时间源；没有 `Math.random()`、`Date.now()`、`setInterval` 或无限粒子 CSS 动画。
- pending Transformer layer / generation decision 不再提前 active。
- 生成语义已纠正为 1 次 prefill selection + 4 次 decode pass；KV loop 在第一次选择完成前保持隐藏。
- 深层 Decode 场景只为事实一致性做最小纠偏：4 个 KV reuse slot，不把第一枚 Token 误称为 decode forward。

## 2. 自动化证据

最终收口检查目标及当前已通过结果：

```text
npm test -- --run   11 files / 78 tests passed
npm run check       0 errors / 0 warnings
npm run build       adapter-static succeeded
```

覆盖内容包括 Global Flow 数据不变量、确定性粒子、几何重算、六个真实按钮、pending/active、1+4 KV loop、渐进 completion、reduced motion、完整六步 single-step，以及既有 Focus/滚动/双语回归。

## 3. 浏览器证据

已实际验证：

- 1280×720、1440×900 和 1920×1080 视口几何下无全局横向溢出，12 条 SVG path 与 Canvas/DOM 共用坐标系；
- 1280→1600→1280 resize 后 progress、active layer、particle checksum 和 path viewBox 保持一致；
- Play/Pause 冻结、播放恢复、滚动中 transport 继续、语言切换保留状态；
- Weights、Tokens、Transformer、Completion 的真实指针中心命中阶段按钮；
- 运行中滚动时 `scrollY` 与正文 progress 同时增加；
- 浏览器 warning/error 为空。

证据图片已经纠正为真实 JPEG 扩展名：

- `overview-idle.jpg`、`overview-weights.jpg`、`overview-tokens.jpg`、`overview-logits.jpg`、`overview-decode-loop.jpg`、`overview-complete.jpg`、`overview-zh-CN.jpg`：1280×720；
- `overview-1440x900.jpg`：1440×900；
- Embedding / Transformer 两张 1164×655 文件是元素裁剪证据，不宣称为整屏截图；
- `overview-wide-render-1440x900.jpg` 是浏览器在 wide viewport 下返回的 1440×900 raster，不再冒充 1920×1080 截图。

## 4. 未完成或未宣称的证据

- 没有可诚实提交的 1920×1080 原生 raster 截图；只有 1920 viewport 的 DOM/overflow/geometry 测量。
- 浏览器环境不能模拟操作系统 reduced-motion，因此只有纯函数与组件测试，没有 `overview-reduced-motion` 真实截图。
- 没有完成 10 秒 Performance 面板、Long Task、Canvas 单帧耗时或 listener 增长的正式性能审计，不能宣称达到稳定 60fps。
- 截图采集早于最后两项核心语义纠偏时，只作为构图证据；最终语义以测试和实时 DOM 测量为准。
- Hover 流带强化、Token capsule 独立键盘联动和若干 tooltip/fidelity 文案属于非核心收尾项，按用户最新要求停止扩展。

## 5. Gate

机器与局部浏览器证据证明核心技术路径可运行，但不能证明视觉方向符合用户预期。用户明确指出当前实现已经偏离方案，并要求停止非核心修补、先收尾，稍后继续指正。因此本轮状态是：**核心实现已形成可复验版本，产品/视觉 Gate 失败并保持打开；不进入移动端、P7、commit、push 或 deploy。**
