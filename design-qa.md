# Design QA — desktop particle Global Flow

- 日期：2026-07-14
- 当前方案：`model-inference-visualizer-desktop-particle-flow-agent-plan.md`
- 轨迹：`qwen35-a3b-w8a8-20260710-p4r4`
- 详细证据：`docs/audits/2026-07-14-desktop-particle-global-flow/AUDIT.md`
- 最终结论：**用户视觉验收未通过**

## 已客观成立

- 首屏已从六张流程卡改为连续的 2.5D DOM/SVG/Canvas 管线。
- 10 shards、5 Token/ID、Embedding `[5, 2048]`、40 层 30/10 结构、top logits `[1, 248320]` 和五个输出 ID 都来自数据投影。
- PlaybackEngine 是唯一时间源；Pause/Seek/resize/语言切换下的粒子投影是确定的。
- pending Layer/Decision 不提前 active；KV loop 只覆盖 4 次 decode，不覆盖第一次 prefill selection。
- 六个阶段是语义按钮；浏览阶段不移动 inference cursor。
- 自动化为 11 files / 78 tests，Svelte check 和静态构建通过。

## 证据边界

- 1280/1440 有真实 raster；1920 只有 viewport 几何/overflow 测量，浏览器返回的 raster 实际为 1440×900，已更名。
- reduced motion 有纯函数和组件证据，没有操作系统媒体模拟截图。
- 没有正式 10 秒 Performance/Long Task/Canvas frame 审计，不能宣称稳定 60fps。
- 早期截图只证明构图，不覆盖最后的 pending/1+4 语义修复。

## 用户 Gate

用户最新判断是当前实现已经偏离方案，并要求非核心问题先不修、先收尾、稍后继续指正。该判断优先于自动化和本审计；因此不再写 `final result: passed`。当前版本只作为可运行的纠偏基线，不进入移动端、P7、commit、push 或 deploy。
