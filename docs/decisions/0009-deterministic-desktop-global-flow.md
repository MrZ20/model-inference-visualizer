# ADR 0009：确定性的桌面 Global Flow 渲染分层

- 状态：Implemented，视觉结果待用户验收
- 日期：2026-07-14
- 决策人：用户与项目执行者

## 背景

用户以 `model-inference-visualizer-desktop-particle-flow-agent-plan.md` 取代旧 P5 图对桌面首屏的具体约束，要求把六张流程卡重构为一条连续的 2.5D 张量管线与粒子数据流。已有 `PlaybackEngine`、Viewing/Cursor 解耦、自然文档流和真实性分级必须保留。

## 决策

1. `TraceExperience` 只承载真实事实；`buildGlobalFlowModel()` 统一验证并投影 shard、Token、Embedding、40 层、logits 和生成决策。
2. `projectGlobalFlow()` 是进度到视觉状态的纯函数。`PlaybackEngine` progress 是唯一时间源，组件不得新增自主时钟。
3. HTML/Svelte DOM 承载文字、shape、fidelity、按钮和 2.5D 实体；SVG 承载由真实 DOM anchor 测量得到的流带；Canvas 只绘制 `aria-hidden` 的确定性粒子。
4. 粒子 seed 来自稳定轨迹事实；相同 experience、progress 和 motion 必须得到相同 checksum 与位置。粒子数量、速度、路径和深度均为 `SCHEMATIC`。
5. `ResizeObserver` 只在布局变化时更新几何，播放帧不读取 DOMRect；Canvas DPR 上限为 2，总粒子预算不超过 140。
6. 五个输出必须解释为一次 prefill logits 选择加四次 decode pass；KV reuse 只在后四次 decode 区间出现。
7. 本轮只重构桌面 Global Flow。旧 P5 图继续作为长页面和下游 Focus Scene 的历史上下文，不再是该组件的视觉目标。

## 后果

- 数据事实、播放投影和渲染职责形成清晰 seam，可分别测试。
- Pause、Seek、语言切换和 resize 不会产生第二时间线或随机粒子漂移。
- SVG/Canvas 成为当前架构的一部分，旧文档中“未引入 SVG/Canvas”的描述失效。
- 当前实现通过机器检查并具有浏览器证据，但用户已指出整体实现仍偏离预期；该 ADR 不代表视觉 Gate 关闭。

## 证据

- `web/src/lib/visualization/global-flow-model.ts`
- `web/src/lib/visualization/flow-geometry.ts`
- `web/src/lib/visualization/particle-projection.ts`
- `web/src/lib/components/GlobalFlow.svelte`
- `web/src/lib/components/global-flow/FlowRibbons.svelte`
- `web/src/lib/components/global-flow/ParticleField.svelte`
- `docs/audits/2026-07-14-desktop-particle-global-flow/AUDIT.md`
