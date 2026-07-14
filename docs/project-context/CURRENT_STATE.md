# 当前项目状态

> 快照日期：2026-07-14。每个大步骤结束时更新；上下文恢复后必须先与真实 Git 状态核对。

## 1. 仓库现实

- 路径：`/Users/user/work/MrZ20_1/model-inference-visualizer`
- 分支：`main`
- HEAD：`3ffdb16 v1`
- 远端：`origin git@github.com:MrZ20/model-inference-visualizer.git`
- 分支关系：`main == origin/main`
- 暂存区：空；本轮实现、测试、方案、审计和连续性文档均为 unstaged/untracked 工作树修改。
- 禁止操作：未经用户明确授权，不 commit、不 push、不 deploy，不 reset/checkout/clean，也不重新连接 SSH 或采集 NPU 数据。
- 当前生产预览：`http://127.0.0.1:4177/?lang=en`。

## 2. 当前阶段与验收

| 项目 | 状态 |
|---|---|
| P0–P4.2 数据、采集与投影 | 已完成 |
| 既有 P5/P6 长页面与 Focus Scene | 已实现；旧 P5 图只保留为历史上下文 |
| P6.5–P6.9 Viewing/Cursor、滚动与自然文档流 | 已实现并保留 |
| P6.10 桌面粒子 Global Flow 核心 | 已形成可运行版本 |
| 自动化 | 11 files / 78 tests；Svelte check 与 static build 通过 |
| 用户产品/视觉验收 | **未通过** |
| 当前 Gate | 用户指出实现偏离方案，要求停止非核心修补并先收尾 |
| P7 / 移动端 / 发布 | 未开始，不允许继续 |

测试通过只证明接口和已编码行为成立，不能覆盖用户对视觉方向的否决。

## 3. 当前权威来源

按顺序读取：

1. `model-inference-visualizer-desktop-particle-flow-agent-plan.md`：本轮桌面 Global Flow 方案；
2. `docs/project-context/CONTEXT_MANIFEST.md` 列出的全部上下文；
3. `docs/decisions/0009-deterministic-desktop-global-flow.md`：当前 DOM/SVG/Canvas 与确定性粒子分层；
4. `docs/audits/2026-07-14-desktop-particle-global-flow/AUDIT.md`：已完成证据、诚实缺口和失败的用户 Gate。

`docs/assets/p5-fused-long-scroll-direction.png` 仍用于理解长页面与下游 Focus Scene，但不再约束桌面 Global Flow 的具体视觉。当前 UI 也不能反向成为需求来源。

## 4. 冻结的真实数据

- Run ID：`qwen35-a3b-w8a8-20260710-p4r4`
- prompt：`Hello, my name is`
- prompt IDs：`[9419, 11, 821, 803, 369]`
- generated IDs：`[498, 7525, 3855, 1089, 321]`
- final text：`Hello, my name is [Your Name], and`
- 模型：hidden 2048、40 层、30 linear attention / 10 full attention、vocab 248320。
- 并行：TP=2、EP=false；MoE 256 experts、每 Token top-8。
- Embedding：Rank 0 BF16 `[5, 2048]`，保留 64-value PREFIX 摘要；5×20 可见网格是示意。
- Attention：16 Q heads、2 KV heads、head size 256；概率矩阵为真实 Q/K/V 的 `DERIVED` 结果，并以融合输出验证。
- 五个输出不是五次 decode forward：第一枚来自 prefill logits，后四枚来自 decode pass，只有后四次复用 KV Cache。
- top logits 为保留的 top-20 摘要，不是 probability；last hidden 未采集，hidden→logits 只作 Structural 表达。
- 10 个 checkpoint shard 的名称、字节数和约 37.0 GiB 总 checkpoint bytes 为真实文件事实；2.5D 厚度、飞行方向和 TP bank 几何为示意，不表示 NPU 内存占用。

## 5. 当前核心实现

### 数据与投影

- `scene-model.ts` 扩展 Embedding 摘要、generation provenance 与 logits/selection fidelity。
- `global-flow-model.ts` 通过一个小 Interface 构造并验证 weights、tokens、embedding、transformer、generation；关键数据缺失时失败，不回退到页面硬编码。
- `projectGlobalFlow()` 将同一 progress 纯函数映射为六阶段、40 层、五个生成决策和独立的 decode-loop progress。
- pending Transformer layer 和 generation decision 使用 `null`，不会在 progress 0 提前显示 active。

### 渲染

- `GlobalFlow.svelte` 是 orchestrator；六个阶段都是可点击语义按钮，点击只浏览章节，不移动 inference cursor。
- 10 shards、TP banks、5 Token/ID、Embedding plane、40 layer plates、真实 top logits 和 generation track 均从 model 渲染。
- `FlowRibbons.svelte` 使用 `flow-geometry.ts` 测量的 DOM anchors 绘制 5 条前向流和 1 条 KV return loop。
- `ParticleField.svelte` 只绘制 `aria-hidden` Canvas 粒子；稳定 seed、DPR≤2、总量 140、无自主时间源。
- `ResizeObserver` 只在布局变化时重测；locale 与 resize 可更新几何，播放帧不读 DOMRect。
- reduced motion 返回静态 marker/状态，不运行连续旅行粒子。

### 播放与页面

- `PlaybackEngine` 仍是唯一时间源；Global Flow 接收 `sceneProgress('overview')` 与 `playback.motion`。
- 完整六次 Overview single-step 已有页面回归。
- Viewing 与 Cursor、三种起点×两种模式、滚动不中断、自然文档流、双语和 Focus Scene 均保留。
- 深层 Decode 只做事实纠偏：第一项显示 Prefill selection，后四项显示 Decode 1–4，KV cache 只有四个 decode slot。

## 6. 当前验证

### 自动化

```text
npm test -- --run   11 files / 78 tests passed
npm run check       0 errors / 0 warnings
npm run build       adapter-static succeeded
```

### 浏览器

- 1280×720、1440×900、1920×1080 viewport 的 DOM/overflow/geometry 已测；全局无横向溢出。
- Pause 800ms 时 progress、active layer、particle checksum 冻结；恢复后继续。
- 运行中滚动时 `scrollY` 与正文进度继续增加，transport 不暂停。
- 1280→1600→1280 resize 后 progress、layer、checksum 与 path viewBox 保持。
- English / 中文切换保留 progress、active layer 与 checksum；console warning/error 为空。
- Weights、Tokens、Transformer、Completion 的真实 pointer center 命中阶段按钮。

截图限制、未完成性能审计和早期截图语义边界见本轮 `AUDIT.md`，不能扩写为已通过证据。

## 7. 已知缺口与用户最新决定

1. 用户明确指出当前整体实现已经偏离方案；视觉/产品 Gate 失败，不能以 78 条测试覆盖该判断。
2. 没有可信的 1920×1080 原生 raster，也没有真实 reduced-motion 浏览器截图。
3. 没有完成 10 秒 Performance/Long Task/Canvas frame/listener 增长审计，不能宣称稳定 60fps。
4. Hover 流带联动、Token capsule 独立 focus，以及部分 fidelity/a11y/i18n 文案仍可完善；用户已要求这些非核心问题先不修。
5. 本轮不做移动端新设计，不重写 Attention/MoE/TP Focus Scene，不进入 P7。

## 8. 下一步

停止实现并等待用户对“偏离方案”的具体指正。下一轮开始前再次完整读取新方案、manifest 全部文件、本状态和本轮审计；只按用户新的明确纠偏范围行动。
