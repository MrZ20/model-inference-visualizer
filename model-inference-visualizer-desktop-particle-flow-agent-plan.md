# Model Inference Visualizer
# 桌面端 2.5D 粒子推理流重构：Agent 完整执行方案

> 文档用途：交给新的 coding agent / Codex 直接执行  
> 目标仓库：`https://github.com/MrZ20/model-inference-visualizer`  
> 当前公开仓库基线（仅作核对线索）：`3ffdb16221bdee600dd29203bcad12787ba2ea70`，提交信息 `v1`  
> 目标页面：桌面端 Web，重点重构首屏 `GlobalFlow`  
> 本轮范围：**只做桌面端，不做移动端视觉设计与验收**  
> 交互参考：[Transformer Explainer](https://poloclub.github.io/transformer-explainer/)  
> 参考源码：[poloclub/transformer-explainer](https://github.com/poloclub/transformer-explainer)  
> 生成日期：2026-07-14

---

## 0. 一句话任务定义

把当前首屏中六个彼此独立的流程卡片：

```text
Load weights → Tokens → Embedding → 40 layers → Logits → Completion
```

重构成一个连续、宽屏、可播放、可暂停、可 Seek、可单步的 **2.5D 张量管线 + 粒子数据流**。用户应在不阅读长段说明的情况下，直接看到：

1. 十个 checkpoint shard 如何汇入模型；
2. Prompt 如何分成五个 Token 和 Token ID；
3. Token 如何展开成 `[5, 2048]` 张量；
4. 数据如何穿过 40 个混合 Attention + MoE 层；
5. 最终隐藏状态如何投影成 `[1, 248320]` logits；
6. top-1 Token 如何被选中，并通过 KV Cache 复用形成五次 Decode 循环。

这不是做一个“更漂亮的六卡片 UI”，而是把首屏从**步骤清单**变成**连续计算过程**。

---

## 1. Agent 开工前的强制协议

### 1.1 必须先恢复上下文

在仓库根目录执行并完整阅读：

```text
AGENTS.md
docs/project-context/CONTEXT_MANIFEST.md
```

然后严格按 `CONTEXT_MANIFEST.md` 顺序读取全部文件，至少包括：

```text
docs/project-context/README.md
docs/project-context/CHAT_TIMELINE.md
docs/project-context/MASTER_PLAN.md
docs/project-context/VISUAL_INTERACTION_CONTRACT.md
docs/project-context/CURRENT_STATE.md
docs/project-context/COMPACTION_RECOVERY.md
MEMORY.md
TASKS.md
docs/decisions/0001-*.md ～ 0008-*.md
web/AGENTS.md
```

必须实际查看：

```text
docs/assets/p5-fused-long-scroll-direction.png
```

不能只读本方案、`MEMORY.md` 或当前代码后直接实现。

### 1.2 必须先核对真实 Git 状态

```bash
git status --short --branch
git diff --cached --stat
git diff --stat
git log --oneline --decorate -5
```

规则：

- 公开仓库的远端 HEAD 只是参考，本地工作树才是实施时的事实。
- 不得 reset、checkout、clean、stash 或覆盖用户已有修改。
- 未经用户明确授权，不得 commit、push、部署。
- 不得重跑 SSH、NPU 采集或更改远端 vLLM / vLLM Ascend。
- 本轮只修改前端和相应测试、文档。

### 1.3 开工前必须向用户复述四点

用四句话说明：

1. 北极星：基于真实 `p4r4` 轨迹的连续推理解释器；
2. 视觉方向：桌面端 2.5D 张量管线与粒子流，不是卡片 Dashboard；
3. 数据边界：事实来自 TraceExperience，粒子数量和几何是 Schematic；
4. 本轮唯一大步骤：只重构桌面端首屏 Global Flow，完成后停下等待视觉验收。

---

## 2. 当前实现审计

### 2.1 当前代码位置

主要相关文件：

```text
web/src/lib/components/GlobalFlow.svelte
web/src/app.css
web/src/routes/+page.svelte
web/src/lib/experience/scene-model.ts
web/src/lib/playback/engine.ts
web/src/lib/projection/projector.ts
web/src/lib/i18n/catalog.ts
web/src/routes/page.test.ts
```

### 2.2 当前 GlobalFlow 的结构问题

当前 `GlobalFlow.svelte` 的核心是：

- 六个等权重 `<button class="flow-node">`；
- 五个独立箭头；
- 一条横向进度线；
- 每个按钮内部放一个小图标和缩略图；
- 依靠 `stageProgress(progress, index, 6)` 改变边框、透明度和底部进度条。

这能回答“有哪六步”，但不能回答：

- 数据当前在哪里；
- 数据在不同阶段是什么形态；
- 为什么 Token 会成为矩阵；
- 40 层是怎样连续处理数据的；
- logits 如何产生并选出 Token；
- Decode 为什么是循环，而不是一次性完成。

### 2.3 当前实现中必须修正的硬编码

当前首屏存在以下页面级硬编码：

```text
const tokens = ['Hello', ',', 'my', 'name', 'is'];
[5, 2048]
30 linear · 10 full
[1, 248320]
```

即使这些值对当前 run 正确，也不应继续由 `GlobalFlow.svelte` 自己持有。目标实现中：

- Token 文本、Token ID；
- Embedding shape；
- 层数和层类型；
- Logits shape；
- Decode 次数、selected token、completion；

都必须从 `TraceExperience` 或专门的 Global Flow view model 中读取。

### 2.4 当前必须保持不回归的能力

重构首屏时，以下行为不可破坏：

- `PlaybackEngine` 是唯一推理时间源；
- `viewChapter` 与 inference cursor 独立；
- 用户滚动只接管镜头，不暂停 transport；
- EN / 中文切换不重置播放状态；
- 从头、当前页面、当前步骤三种起点；
- Continuous / Single 两种运行模式；
- Reduced Motion；
- 自然文档流；
- Focus Scene 的可逆展开；
- 现有 Initialization、Linear/Full Attention、MoE、TP、Decode 深入场景；
- Evidence dialog 和 fidelity 说明；
- 静态 SvelteKit 构建。

---

## 3. 本轮范围

### 3.1 In Scope

本轮实施：

1. 桌面端 `GlobalFlow` 的完整视觉与交互重构；
2. 基于现有 `PlaybackEngine` 的确定性粒子流；
3. 基于真实数据的六阶段视图模型；
4. SVG 流带、Canvas 粒子、CSS 2.5D 张量与层堆栈；
5. 桌面端 1280×720、1440×900、1920×1080 验收；
6. 新增必要的单元测试、组件测试、页面测试和浏览器证据；
7. 更新项目连续性文档。

### 3.2 Explicitly Out of Scope

本轮不做：

- 移动端布局重构；
- 390px 视觉验收；
- Touch 专用交互；
- 重写 Attention、MoE、TP、Decode 的深层 Focus Scene；
- Three.js、WebGL、自由旋转相机；
- 浏览器内模型推理；
- 新采集数据；
- 后端或实时服务；
- 部署和发布；
- P7 正式 QA。

### 3.3 移动端处理原则

“本轮不做移动端”不等于允许引入运行时崩溃。

要求：

- 只为 `>= 1180px` 桌面视口定义新的完整构图和验收标准；
- 不主动重写现有移动端 CSS；
- 小于桌面阈值时只保证页面不抛异常、语义内容仍存在；
- 不投入时间做移动端粒子密度、排版和视觉优化；
- 不把移动端结果写入本轮 Definition of Done。

---

## 4. 参考项目研究结论

## 4.1 应借鉴的交互语法

Transformer Explainer 的关键价值不是其 GPT-2 模型，而是以下交互组织方式。

### A. 一个连续画布，而不是若干孤立卡片

其页面把 Embedding、QKV、Attention、MLP、后续 Blocks 和输出放在同一横向计算语境中。用户能沿着连接路径理解数据变化。

### B. 语义 DOM 与 SVG 流带分层

其 `Sankey.svelte`：

- 使用 DOM 元素作为路径锚点；
- 读取 `getBoundingClientRect()`；
- 用 SVG path 连接实际组件；
- 使用渐变表达 Q/K/V 和输出流；
- 使用 `ResizeObserver` 在尺寸变化时重算几何。

本项目应采用同样的“组件是事实、连接层是覆盖层”思想，但可以用原生 TypeScript 实现，不必引入 D3。

### C. 原位展开，而不是跳页或弹出截图

其 `Embedding.svelte` 使用 FLIP 思路，让同一个组件在概览与详情之间连续变形。这个原则与本项目现有 Focus Scene 契约一致。

本轮不重写 Focus Scene，但 Global Flow 的视觉语言必须与后续原位展开兼容。

### D. 2.5D 层叠表达多头和多层

其 `HeadStack.svelte` 通过：

```text
translate + scale + z-index + opacity
```

让多个 Attention Head 形成有深度的卡片堆栈。

本项目可将同样的深度语言用于：

- 10 个 checkpoint shard；
- Embedding tensor plane；
- 40 层 Transformer tunnel；
- Logits candidate field。

### E. 流动由显式状态驱动

其动画使用 GSAP timeline、SVG gradient stop 和 stroke dashoffset，使数据沿连接路径按阶段出现。

本项目不能直接复制其时间线架构，因为本项目已有唯一 `PlaybackEngine`。应借鉴“路径随阶段推进”的表达，但所有位置必须由现有 `progress` 纯函数计算。

## 4.2 不应复制的部分

不得照搬：

- GPT-2 的 12 层、12 heads、768 hidden size；
- GPT-2 live browser inference；
- Temperature / Top-k / Top-p 实验控件；
- Transformer Explainer 的品牌、Logo、文案和视觉资产；
- 与 `PlaybackEngine` 并行的 GSAP 自主时间线；
- 对页面 DOM 进行不可预测的直接重排；
- 源项目中的移动端策略。

## 4.3 依赖策略

本轮默认：

- **不新增 D3**；
- **不新增 GSAP**；
- **不新增 Three.js**；
- 使用 Svelte + 原生 SVG + Canvas 2D + CSS transform；
- 只有在原生实现无法满足经过测试的需求时，才提出依赖变更并先获得用户同意。

参考源码为 MIT License。原则上只借鉴交互模式，不直接复制大段代码。若确需迁移非平凡代码，应增加第三方归属说明并保留许可证要求。

---

## 5. 产品目标与成功判定

### 5.1 静态状态也必须可理解

即使页面暂停在 `progress = 0`、`0.5` 或 `1`，用户也应能从画面看懂：

```text
Shards → Tokens → Tensor → 40 Layers → Logits → Generated Tokens
```

不能依赖“播放起来才勉强看懂”。

### 5.2 动态必须表达计算语义

粒子不是背景装饰。它必须表示：

- shard 数据汇入；
- Token 单元移动；
- Tensor lane 扩展；
- 层间数据传播；
- logits 候选展开；
- selected token 回到 Decode 循环。

### 5.3 事实与示意必须区分

用户必须明确知道：

- 数字和 Shape 来自真实轨迹；
- 粒子数量不是完整 Tensor 元素数；
- 2.5D 深度不是实际内存布局；
- 粒子速度不是真实性能时间。

### 5.4 与现有长页面保持一致

首屏不能成为一个独立的游戏化 3D 场景。它仍然属于：

- 暖白编辑表面；
- indigo / violet 主色；
- cyan / mint / coral 有限辅助色；
- 细分隔线；
- 自然滚动；
- 全站统一字体与 fidelity 标签。

---

## 6. 最终视觉构图

## 6.1 桌面画布尺寸

目标视口：

```text
Primary:   1280 × 720
Secondary: 1440 × 900
Wide:      1920 × 1080
```

完整 Global Flow 的建议尺寸：

```css
.global-flow-experience {
  position: relative;
  min-width: 1020px;
  height: clamp(460px, 37vw, 560px);
}
```

注意：

- 不能使用六个等宽卡片；
- Transformer Tunnel 应占总宽度约 28%～32%；
- 其他五个阶段分配剩余空间；
- 文本标签保持水平，不对文字做 3D 旋转；
- 3D 只用于 Tensor、Shard、Layer、Logit field。

## 6.2 建议横向空间比例

```text
Weights       12%
Tokens        12%
Embedding     15%
Transformer   31%
Logits        14%
Completion    16%
```

连接流带位于所有阶段后方，粒子 Canvas 位于流带上方、语义 DOM 下方或与其合理分层。

## 6.3 画布分层

从底到顶：

```text
Layer 0  背景网格 / 轻量深度参考线
Layer 1  SVG 宽流带与连接路径
Layer 2  Canvas 粒子
Layer 3  2.5D 视觉实体
Layer 4  HTML 标签、Shape、Fidelity、按钮
Layer 5  Hover / Focus ring / Tooltip
```

建议 z-index：

```text
background: 0
ribbons:    1
particles:  2
objects:    3
labels:     4
interaction:5
```

Canvas 必须：

```html
<canvas aria-hidden="true"></canvas>
```

SVG 纯装饰部分也必须 `aria-hidden="true"`。

---

## 7. 固定视觉语义

| 视觉元素 | 固定含义 |
|---|---|
| 小圆粒子 | Token 或 Tensor 抽样元素 |
| 宽流带 | 高维 Tensor / 批量数据 |
| 半透明厚片 | Transformer Layer |
| 蓝色 | Query 或主要输入路径 |
| Coral | Key 或 Rank 1 |
| Mint | Value / KV reuse |
| Cyan | Linear Attention layer |
| Violet / Indigo | Full Attention、Residual、selected result |
| 两条并行细轨 | TP rank 0 / rank 1 |
| 粒子分叉 | 数据进入多个计算支路 |
| 粒子合流 | Residual add、collective、combine |
| 点亮边框 | 当前 Playback cursor 的局部阶段 |
| 实线边框 | Captured / Exact |
| 虚线边框 | Derived |
| 双线 / 特殊线型 | Structural |
| 点线 | Schematic |

颜色不能成为唯一信息来源。类型、标签和线型必须同步出现。

---

## 8. 六阶段详细设计

## 8.1 Stage 01 — Load Weights

### 视觉目标

把当前十个底部小矩形改成十个有厚度的 checkpoint shard slab。它们从左上和左下两个方向汇入中央模型内存体。

### 结构

```text
10 shard slabs
      \  |  /
   ┌───────────┐
   │ model mem │
   │ TP0 | TP1 │
   └───────────┘
```

### 必须显示的事实

来自 `TraceExperience.initialization`：

```text
weightShards.length
totalWeightBytes
quantization.type
run.tensorParallelSize
run.expertParallel
```

显示示例：

```text
10 checkpoint shards
37.0 GiB
W8A8_DYNAMIC
TP=2 · EP=false
```

不得把 W8A8 描述成“所有模块均 INT8”。

### 动画

局部进度 `p0 = stageProgress(progress, 0, 6)`：

```text
0.00–0.12  显示空内存体轮廓
0.12–0.78  十个 shard 依次飞入，按真实 shard 数分段
0.78–0.92  两个 TP bank 被填充
0.92–1.00  输出流带开始点亮
```

每个 shard 的局部状态：

```ts
const shardProgress = stageProgress(p0, shardIndex, shardCount);
```

### 真实性

- shard 数、大小、总字节：Exact / Captured；
- shard 的飞行方向、厚度、位置：Schematic；
- TP bank 图形：Structural；
- 不展示权重值。

### 交互

整个阶段是一个语义按钮：

```text
aria-label="Open model initialization"
```

点击只调用：

```ts
onNavigate('init')
```

不能移动 inference cursor。

---

## 8.2 Stage 02 — Tokenize

### 视觉目标

让 Prompt 以字符流进入 Tokenizer，再聚合为五个 Token capsule，每个 capsule 同时显示文本和 ID。

### 结构

```text
"Hello, my name is"
          ↓
[Hello] [,] [my] [name] [is]
  9419   11  821   803   369
```

### 数据要求

不得继续在 `GlobalFlow.svelte` 中写：

```ts
const tokens = [...]
```

应从 Global Flow view model 获取：

```ts
tokens: Array<{
  index: number;
  text: string;
  id: number;
}>
```

如果当前 Web Bundle 没有直接保存 exact token text：

1. 先检查已有 event / artifact 是否包含 tokenizer output；
2. 若有，扩展 `buildTraceExperience`；
3. 若确实没有，本轮可使用 `promptPieces` 与 ID 配对，但必须在数据投影层完成；
4. 不允许把当前 run 的 Token 文本重新写死在组件中；
5. 在注释和 fidelity 中诚实说明来源。

### 动画

局部进度 `p1 = stageProgress(progress, 1, 6)`：

```text
0.00–0.18  Prompt 字符流进入 tokenizer aperture
0.18–0.82  五个 capsule 依次聚合
0.82–1.00  ID 出现并对齐到 Embedding 输入 lane
```

每个 Token：

```ts
tokenProgress = stageProgress(p1, tokenIndex, tokenCount)
```

### 粒子语义

- 字符流使用少量小粒子；
- capsule 形成后，粒子不消失，而是收敛到对应 Token lane；
- 五条 lane 与 Embedding 的五行一一对应。

### 交互

点击：

```ts
onNavigate('tokens')
```

Hover / keyboard focus：

- 当前 capsule 亮起；
- 对应 Embedding row 轻微高亮；
- 不暂停播放；
- 不改变 progress。

---

## 8.3 Stage 03 — Embedding Tensor

### 视觉目标

五个 Token capsule 进入后，各自展开为一行高维向量，形成一个倾斜的 2.5D Tensor plane。

### 结构

```text
Token 0  ● ● ● ● ● ● ● ● …
Token 1  ● ● ● ● ● ● ● ● …
Token 2  ● ● ● ● ● ● ● ● …
Token 3  ● ● ● ● ● ● ● ● …
Token 4  ● ● ● ● ● ● ● ● …
             [5, 2048]
```

### 数据要求

扩展 `TraceExperience` 或 Global Flow view model：

```ts
embedding: {
  shape: number[];
  dtype?: string;
  sample?: number[];
  stats?: ...
}
```

Shape 应来自 `qwen-validation-report.json` 的 `embeddingShape`，不能写死。

如果使用 layer-0 输入的 retained sample：

- 标记为 Summary；
- 不把它称为完整 embedding dump；
- 展示的 cell 数量由视觉预算决定，不暗示 2048 个通道都在屏幕上。

### 2.5D 表达

建议：

```css
.embedding-plane {
  perspective: 900px;
}

.embedding-grid {
  transform: rotateX(58deg) rotateZ(-2deg);
  transform-origin: center;
}
```

文字标签放在未旋转的 overlay 中。

### 采样网格

桌面端建议：

```text
5 rows × 20～24 visible cells
```

每行末尾使用渐隐或省略标记：

```text
2048 channels · sampled visualization
```

### 动画

局部进度 `p2 = stageProgress(progress, 2, 6)`：

```text
0.00–0.20  五个 Token lane 对齐
0.20–0.72  每个 Token 横向展开为向量 row
0.72–0.90  五行合成 Tensor plane
0.90–1.00  宽流带从 Tensor plane 进入 Transformer Tunnel
```

### 真实性

- Shape、dtype：Exact / Structural；
- retained sample / stats：Summary；
- 可见 cell 数、深度、倾角：Schematic。

---

## 8.4 Stage 04 — 40-Layer Transformer Tunnel

### 视觉目标

这是首屏主视觉。40 层必须全部可见，并形成一个具有纵深的连续隧道，而不是 40 个微小方块放在卡片里。

### 结构

```text
Input tensor
   ↓
L0  L1  L2  L3  ...  L39
│   │   │   │         │
cyan / violet plates
│   │   │   │         │
particle lanes travel through all layers
```

### 层数据

全部来自：

```ts
experience.layers
```

每层至少包含：

```ts
{
  index: number;
  type: 'linear_attention' | 'full_attention';
}
```

计数通过数组派生：

```ts
linearCount = layers.filter(...).length
fullCount = layers.filter(...).length
```

组件中不得再写死 `30` 和 `10`。

### 视觉结构

建议每层使用一个半透明 plate：

```text
宽度：8～12px
高度：180～240px
深度偏移：随 index 递增
```

使用 CSS 变量：

```css
.layer-plate {
  transform:
    translate3d(
      calc(var(--i) * var(--layer-gap)),
      calc(var(--i) * -0.7px),
      calc(var(--i) * -3px)
    )
    skewY(-4deg);
}
```

也可使用 SVG polygon，但必须保证：

- 40 层可数；
- 当前层可辨；
- full attention 层与 linear attention 层可辨；
- 文字不被 3D 变换影响。

### 当前层

局部进度：

```ts
p3 = stageProgress(progress, 3, 6)
activeLayer = Math.min(layerCount - 1, Math.floor(p3 * layerCount))
```

状态：

```text
index < activeLayer   complete
index = activeLayer   active
index > activeLayer   pending
```

### 粒子路径

五条主 Token lane 穿过隧道。

在当前层内部，以很轻的支路表达：

```text
main lane
 ├─ attention branch
 ├─ residual bypass
 └─ MoE / MLP branch
       ↓
     merge
```

注意：

- 首屏只表达“存在这些支路”；
- 不在首屏展开完整 Q/K/V、top-8 experts 或 collective；
- 深层细节仍由现有章节和 Focus Scene 承担。

### Layer 类型反馈

- Linear Attention：cyan plate + 轻量连续波；
- Full Attention：violet plate + 短促 fan-out；
- 当前 Full Attention 层经过时，可以出现一次 Q/K/V 三色分叉，但不能伪装成完整 attention dump。

### 标签

```text
40 layers
30 Linear Attention
10 Full Attention
Current: Layer 17 / 40
```

全部数字由 view model 派生。

### 交互

阶段主体点击：

```ts
onNavigate('prefill')
```

单个 Layer plate 可以支持 Hover / Focus 显示：

```text
Layer 3 · full_attention
```

但点击 Layer plate本轮只允许浏览到 `prefill`，不能偷偷 Seek inference cursor。

---

## 8.5 Stage 05 — Logits Field

### 视觉目标

把最终 hidden band 压缩为最后一个位置的表示，然后展开成一个大型词表候选场。

### 结构

```text
final hidden
      ●
     /|\
    / | \       top candidates
  ┃  ┃  ┃  ┃  ┃
          ↑
      top-1 selected
```

### 数据

使用 `experience.decode.steps` 中当前或第一步的：

```ts
logitsShape
topCandidates
tokenId
```

Global Flow view model 中应提供：

```ts
logits: {
  shape: number[];
  topCandidates: Array<{ tokenId: number; logit: number }>;
  selectedTokenId: number;
}
```

### 重要术语约束

当前数据是 logits，不是已经归一化的 probability。

因此首屏应写：

```text
Top logits
Greedy top-1
```

不能写：

```text
Probability 54.67%
```

除非实际执行了可验证的 softmax 投影并在数据层标记 Derived。

### 柱形或光束

显示前 6～10 个真实 top candidate：

- 高度由真实 logit 归一化；
- top-1 使用 indigo；
- 其他使用低饱和 violet；
- 标注 Token ID；
- shape 显示 `[1, 248320]`，来自数据。

### 动画

局部进度 `p4 = stageProgress(progress, 4, 6)`：

```text
0.00–0.20  Transformer 输出收束到 last-token hidden
0.20–0.68  候选光束展开
0.68–0.88  top-1 柱被选中
0.88–1.00  selected particle 飞向 Completion / Decode
```

---

## 8.6 Stage 06 — Completion + Decode Loop

### 视觉目标

明确生成是逐 Token 循环，不是一次性得到完整句子。

### 结构

```text
selected token
      ↓
append to text
      ↓
reuse KV cache
      └──────────→ Transformer
```

### 数据

来自：

```ts
experience.decode.steps
experience.decode.prompt
experience.decode.completion
experience.decode.finalText
```

### 微步骤

虽然 Overview 有六个语义 stage，但 Completion stage 内部要细分五个 Decode micro-step：

```ts
completedDecodeSteps =
  Math.min(
    decode.steps.length,
    Math.floor(localCompletionProgress * decode.steps.length + epsilon)
  );
```

每个 micro-step：

1. 从 Logits field 取出 selected token；
2. Token ID 进入输出轨道；
3. Completion 文本增加；
4. KV Cache loop 点亮一次；
5. 下一轮进入 Transformer。

### Partial text 真实性

如果当前数据层不能精确获得每个 Token 对应的字符串，不要伪造逐 Token 字符边界。

允许采用现有 DecodeScene 的策略：

- 中间文本增长标记为 Schematic Reveal；
- 完成态显示 Exact final string；
- selected Token ID 始终是 Exact。

### 完成态

在 `progress = 1` 时必须显示：

```text
Hello, my name is [Your Name], and
5 generated tokens
[498, 7525, 3855, 1089, 321]
```

### KV Cache loop

Loop 只表示结构性复用：

- mint / violet 细流带；
- 每次 Decode 点亮一次；
- 不能将 loop 周期解释为实际延迟；
- 标签写 `KV reuse`；
- fidelity 标记 Structural / Schematic。

### 交互

点击：

```ts
onNavigate('decode')
```

不打开新 modal，不在本轮重写 DecodeScene。

---

## 9. Overview 时间映射

现有：

```ts
SCENE_STEP_COUNTS.overview = 6
CHAPTER_DURATION_MS = 18_000
```

保留该语义，不新建第二时间轴。

| Global progress | Stage | 局部进度 |
|---:|---|---:|
| `0/6 → 1/6` | Weight loading | `p0` |
| `1/6 → 2/6` | Tokenization | `p1` |
| `2/6 → 3/6` | Embedding | `p2` |
| `3/6 → 4/6` | 40 layers | `p3` |
| `4/6 → 5/6` | Logits | `p4` |
| `5/6 → 1` | Completion / Decode | `p5` |

所有动画函数应是纯函数：

```ts
visualState = projectGlobalFlow(experience, progress, motionMode)
```

同一份 `experience + progress + motionMode` 必须得到同一画面。

禁止：

```css
animation: particle-flow 4s linear infinite;
```

禁止：

```ts
setInterval(...)
Date.now()
performance.now()
```

在 Global Flow 内自行驱动数据位置。

允许：

- `PlaybackEngine` 自身的 `requestAnimationFrame`；
- Canvas 在 Svelte 接收到新 progress 后重绘；
- `ResizeObserver` 用于几何更新；
- 一次性的 `requestAnimationFrame` 用于 DOM 测量排队。

---

## 10. 技术架构

## 10.1 分层架构

```text
TraceExperience
    ↓
buildGlobalFlowModel()
    ↓
projectGlobalFlow(progress)
    ↓
Semantic DOM objects
SVG ribbons
Canvas particles
CSS 2.5D transforms
```

### 数据层

负责：

- 真实事实；
- Shape；
- Token ID；
- Layer 类型；
- Logits 候选；
- Decode Steps；
- Fidelity。

### 投影层

负责：

- 当前 active stage；
- 当前 active layer；
- 当前 completed decode steps；
- 每个 shard / token / row / layer 的局部进度；
- Particle 路径和可见性；
- Reduced Motion 状态。

### 渲染层

负责：

- DOM；
- SVG；
- Canvas；
- CSS；
- 交互事件。

渲染组件不得重新推导业务事实或写死 run 数据。

---

## 10.2 建议新增文件

```text
web/src/lib/components/global-flow/
├── GlobalFlowStage.svelte
├── FlowRibbons.svelte
├── ParticleField.svelte
├── WeightShardVolume.svelte
├── TokenStream.svelte
├── EmbeddingTensor.svelte
├── TransformerTunnel.svelte
├── LogitsField.svelte
└── DecodeLoop.svelte

web/src/lib/visualization/
├── global-flow-model.ts
├── flow-geometry.ts
└── particle-projection.ts
```

建议测试：

```text
web/src/lib/visualization/global-flow-model.test.ts
web/src/lib/visualization/particle-projection.test.ts
web/src/lib/components/GlobalFlow.test.ts
```

### 控制文件数量

不要为了“架构漂亮”机械拆分。

建议规则：

- 单组件超过约 220～280 行并存在独立责任时再拆；
- 纯视觉小片段可保留在 `GlobalFlow.svelte`；
- `global-flow-model.ts` 和 `particle-projection.ts` 必须独立，便于纯函数测试；
- 不把简单 CSS 拆成动态 runtime style system。

---

## 10.3 现有文件的预期修改

### `web/src/lib/components/GlobalFlow.svelte`

重写为 orchestrator：

```svelte
<script>
  // 接收 experience / progress / locale / motion / onNavigate
  // 创建 view model
  // 测量 stage anchors
  // 组合 SVG、Canvas 和语义阶段组件
</script>
```

它不应继续包含：

- 当前 run 的 Token 文本常量；
- Shape 常量；
- 30 / 10；
- 18 根伪造 bar；
- 与数据无关的随机值。

### `web/src/lib/experience/scene-model.ts`

扩展 `TraceExperience`，建议增加：

```ts
run: {
  id?: string;
  prompt: string;
  promptPieces: string[];
  promptTokenIds: number[];
  embeddingShape: number[];
  ...
}

overview: {
  logitsShape: number[];
}
```

也可以不增加 `overview`，而在 `global-flow-model.ts` 中从已有数据安全派生。

最低要求：

- Embedding shape 不再由页面写死；
- Logits shape 不再由页面写死；
- Token text / ID 配对不再由页面写死。

### `web/src/routes/+page.svelte`

只做最小集成修改，例如：

```svelte
<GlobalFlow
  {experience}
  progress={sceneProgress('overview')}
  locale={playback.locale}
  motion={playback.motion}
  transport={playback.transport}
  onNavigate={setViewChapter}
/>
```

注意：Particle 是否运动只依赖 progress。`transport` 可仅用于视觉状态或测试，不得成为第二时间源。

### `web/src/app.css`

删除或替换旧的：

```text
.global-flow
.flow-track
.flow-node
.flow-arrow
.shard-mini
.token-mini
.matrix-mini
.layers-mini
.bars-mini
```

新的样式只针对桌面完整体验。

不要改写全站设计 token，除非确有缺失。

### `web/src/lib/i18n/catalog.ts`

补齐所有新增文案，English / 中文 key 完全一致。

### `web/src/routes/page.test.ts`

保留既有测试；新增页面级集成断言，不删除旧回归来“让测试通过”。

---

## 11. Global Flow View Model

建议定义：

```ts
export interface GlobalFlowModel {
  weights: {
    shardCount: number;
    shards: Array<{
      index: number;
      name: string;
      bytes: number;
      normalizedSize: number;
    }>;
    totalBytes: number;
    quantizationType: string;
    tensorParallelSize: number;
    expertParallel: boolean;
  };

  tokens: Array<{
    index: number;
    text: string;
    id: number;
  }>;

  embedding: {
    shape: number[];
    dtype?: string;
    sample?: number[];
    fidelity: 'EXACT' | 'SUMMARY' | 'STRUCTURAL';
  };

  transformer: {
    layerCount: number;
    linearCount: number;
    fullCount: number;
    layers: Array<{
      index: number;
      type: 'linear_attention' | 'full_attention';
    }>;
  };

  logits: {
    shape: number[];
    topCandidates: Array<{
      tokenId: number;
      logit: number;
    }>;
    selectedTokenId: number;
  };

  decode: {
    stepCount: number;
    generatedTokenIds: number[];
    prompt: string;
    completion: string;
    finalText: string;
  };
}
```

构造函数：

```ts
export function buildGlobalFlowModel(
  experience: TraceExperience
): GlobalFlowModel
```

必须执行不变量检查：

```text
tokens.length === promptTokenIds.length
embedding.shape.length === 2
layers.length === initialization.model.layerCount
linearCount + fullCount === layerCount
decode.steps.length > 0
logits.shape.length === 2
selectedTokenId === topCandidates[0].tokenId
```

若缺少关键数据：

- 抛出可定位错误；
- 不回退到页面硬编码；
- 不静默伪造。

---

## 12. SVG 流带实现

## 12.1 Anchor 机制

每个阶段暴露锚点：

```html
<div data-flow-anchor="weights-out"></div>
<div data-flow-anchor="tokens-in"></div>
```

Global Flow 根元素通过 `ResizeObserver` 测量。

相对坐标：

```ts
function relativeRect(
  child: DOMRect,
  root: DOMRect
): Rect {
  return {
    x: child.left - root.left,
    y: child.top - root.top,
    width: child.width,
    height: child.height
  };
}
```

### 需要的连接

```text
weights-out      → tokens-in
tokens-out       → embedding-in
embedding-out    → transformer-in
transformer-out  → logits-in
logits-selected  → decode-in
decode-loop-out  → transformer-loop-in
```

### 路径生成

原生 cubic Bézier：

```ts
function cubicPath(source: Point, target: Point): string {
  const dx = Math.max(48, (target.x - source.x) * 0.42);
  return `M ${source.x} ${source.y}
          C ${source.x + dx} ${source.y},
            ${target.x - dx} ${target.y},
            ${target.x} ${target.y}`;
}
```

宽流带可使用上下两条曲线闭合：

```text
sourceTop → targetTop
targetBottom → sourceBottom
Z
```

### 更新时机

几何重算：

- 初次 mount；
- 字体加载后；
- 容器 Resize；
- locale 切换后；
- DOM stage 尺寸变化后。

不要在每个 Playback frame 重新读取全部 DOMRect。几何只在布局版本变化时重算。

---

## 13. Canvas 粒子实现

## 13.1 Canvas 职责

Canvas 只绘制：

- 点；
- 短尾迹；
- 轻量 glow；
- 当前 stage 的 packet。

Canvas 不绘制：

- 文字；
- Shape；
- Token ID；
- 按钮；
- Fidelity；
- 唯一的状态信息。

## 13.2 DPR

```ts
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = cssWidth * dpr;
canvas.height = cssHeight * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
```

限制 DPR 为 2，避免宽屏 Retina 产生不必要像素成本。

## 13.3 确定性 Seed

禁止 `Math.random()` 在 render 中生成粒子位置。

建议：

```ts
seed = hash([
  ...promptTokenIds,
  layerCount,
  ...generatedTokenIds
]);
```

PRNG 可用小型 `xorshift32` 或 `mulberry32`。

每个粒子固定：

```ts
{
  pathId,
  offset,
  radius,
  laneOffset,
  alpha,
  tailLength
}
```

相同 seed 下永远一致。

## 13.4 位置函数

```ts
phase = fract(localProgress * travelCycles + particle.offset);
point = sampleBezier(path, phase);
```

注意：

- `localProgress` 来自 PlaybackEngine；
- Pause 时 progress 不变，粒子完全静止；
- Seek 到相同 progress，粒子回到相同位置；
- 语言切换不改变 seed；
- 浏览章节不改变 seed。

## 13.5 Stage 生命周期

每条 path 具有：

```ts
startProgress
endProgress
fadeIn
fadeOut
```

仅 active stage 显示明显运动。

已完成阶段：

- 保留淡色已完成流带；
- 粒子不继续无限循环。

未开始阶段：

- 显示空路径或极低透明度；
- 不提前出现 active 粒子。

## 13.6 粒子预算

桌面建议上限：

| 区域 | 粒子数量 |
|---|---:|
| Weight shard flow | 20～30 |
| Token flow | 10～20 |
| Embedding lanes | 30～50 |
| Transformer tunnel | 40～70 |
| Logits expansion | 20～35 |
| Decode loop | 8～15 |
| 同屏总量 | 尽量不超过 140 |

不要通过上千粒子制造“高维感”。

---

## 14. Reduced Motion

虽然本轮不做移动端，但桌面可访问性仍然是既有项目契约。

当：

```text
playback.motion === 'reduced'
```

必须：

- 不显示持续位移的粒子；
- 不使用大幅 3D 飞入；
- 当前 stage 直接显示为清晰静态状态；
- 依然展示 active layer、completed decode steps；
- 使用 opacity、border、fill 的离散变化；
- 单步和 Seek 仍然完整可理解。

Reduced Motion 不是“关闭所有内容”，而是从运动叙事降级为状态叙事。

---

## 15. 交互规范

## 15.1 Stage 点击

所有六个主要阶段都是可键盘访问的按钮。

映射：

```ts
weights     → init
tokens      → tokens
embedding   → tokens
transformer → prefill
logits      → decode
completion  → decode
```

点击只改变 `viewChapter`，不得改变 inference cursor。

## 15.2 Hover / Keyboard Focus

Hover 和 `:focus-visible`：

- 当前 stage 轮廓增强；
- 入流和出流带增强；
- 其他 stage 降低到约 0.65～0.8；
- 显示一个短 Tooltip；
- 不暂停；
- 不 Seek；
- 不改变完成状态。

## 15.3 当前 Cursor

Global Flow 当前 stage 的判断只来自：

```ts
Math.min(5, Math.floor(progress * 6))
```

不能根据鼠标 Hover 冒充当前计算阶段。

## 15.4 Tooltip

Tooltip 只展示简短事实：

```text
Embedding
5 tokens × 2048 hidden channels
Shape is trace-grounded; visible cells are sampled.
```

不放长篇教程。

## 15.5 Deep Focus

本轮不允许在 Global Flow 中新建第二套 Attention / MoE / TP 展开。

用户点击 Transformer 后进入现有 Prefill 章节，再通过现有入口打开 Focus Scene。

---

## 16. Fidelity 呈现

首屏底部或右上角固定显示：

English:

```text
Particle density and 2.5D geometry are schematic.
Shapes, tokens, layer types and selected outputs come from the recorded trace.
```

中文：

```text
粒子密度与 2.5D 几何为教学示意；
Shape、Token、层类型和选中结果来自本次记录轨迹。
```

每个阶段建议：

| Stage | 事实 Fidelity | 视觉 Fidelity |
|---|---|---|
| Weights | Exact / Structural | Schematic |
| Tokens | Exact | Schematic motion |
| Embedding | Shape Exact/Structural；sample Summary | Schematic geometry |
| Transformer | Structural / Exact layer list | Schematic internal pulse |
| Logits | Captured logits | Schematic fan geometry |
| Decode | Exact IDs / final text | Partial reveal Schematic；KV loop Structural |

不能用一句“real data”覆盖所有层级。

---

## 17. i18n

新增所有文案必须进入：

```text
web/src/lib/i18n/catalog.ts
```

建议新增 key：

```text
globalFlowSchematicNote
globalFlowExactNote
weightAssembly
modelMemory
tokenCapsule
tokenId
hiddenChannels
sampledChannels
transformerTunnel
currentLayer
layersTraversed
linearLayer
fullLayer
topLogits
selectedTopOne
decodeIteration
kvReuse
generatedTokenIds
openInitialization
openTokens
openPrefill
openDecode
```

要求：

- English / 中文 key 集合完全一致；
- URL locale 优先级不变；
- 切换语言后 progress、active layer、particle seed、hover selection 不变；
- 中文标签不允许破坏桌面路径对齐；
- 几何更新应在 locale 后重新测量。

---

## 18. CSS 设计规范

## 18.1 不再使用六张同形卡片

允许：

- 轻量无边框 stage area；
- 小型 caption plate；
- Tensor / Shard / Layer 自身作为主要视觉对象；
- 分隔线和 baseline。

不允许：

- 六个相同白色圆角矩形；
- 每个阶段一个大图标；
- 每个阶段一个独立 mini chart；
- Dashboard 式平均栅格。

## 18.2 深度

建议：

```text
perspective: 800px～1100px
最大 Z 深度：约 120px
最大 rotateX：约 62deg
最大 rotateY：约 18deg
```

避免：

- 极端透视；
- 文字倾斜；
- 需要用户旋转视角；
- 模糊阴影堆叠。

## 18.3 阴影

只给最前景 active object 非常轻的 shadow。

大多数深度通过：

- 线条；
- opacity；
- scale；
- offset；
- border contrast；

表达。

## 18.4 动态数值使用 CSS 变量

例如：

```svelte
style={`--stage-progress:${localProgress};--active-layer:${activeLayer}`}
```

避免为每个 frame 生成大量 class 字符串。

---

## 19. 性能预算

目标：

- 1280×720，Chrome / Chromium，Continuous 1× 时视觉接近 60fps；
- Canvas 每帧绘制尽量低于 6ms；
- 不在每帧执行 DOM 查询或 `getBoundingClientRect()`；
- Canvas DPR 上限 2；
- 同屏粒子不超过约 140；
- SVG path 数量保持在几十级；
- 40 layer DOM 节点是可接受的，不需要 Canvas 化；
- 不产生 layout thrashing；
- 不加载大图片或外部模型；
- 静态构建体积不因本轮增加大型依赖。

Agent 应在浏览器 Performance 面板抽查：

- 10 秒播放；
- 无持续 >50ms Long Task；
- 无不断增长的 listener、RAF 或 Canvas 对象；
- 离开页面后 observer 和 listener 被清理。

---

## 20. 详细实施顺序

## Phase 0 — 上下文与基线

1. 完成强制文档读取；
2. 核对 Git；
3. 启动本地站点；
4. 在 1280×720 截取当前首屏；
5. 记录当前 Global Flow DOM、尺寸和 progress 行为；
6. 运行现有测试作为 baseline：

```bash
cd web
npm test -- --run
npm run check
npm run build
```

若 baseline 失败，先记录，不得把已有失败归因于本轮。

## Phase 1 — 红灯测试与数据模型

先写失败测试：

1. Global Flow 数据不能依赖组件硬编码；
2. Embedding shape 来自 validation；
3. Logits shape 来自 decode step；
4. 40 层类型完整；
5. Token 数与 ID 数一致；
6. Selected token 与 top candidate 对齐；
7. 六个阶段都具有可访问名称。

然后实现：

```text
global-flow-model.ts
scene-model.ts 的最小扩展
```

此阶段不做视觉。

## Phase 2 — 静态桌面构图

先不画粒子，只完成：

- 六阶段非卡片构图；
- SVG 静态流带；
- 10 shard 体；
- Token capsules；
- 5×N Embedding plane；
- 40-layer tunnel；
- 真实 logits bars；
- completion / KV loop 静态结构；
- 所有标签、Shape、Fidelity。

在 `progress = 0, .5, 1` 三个状态下都应静态可读。

## Phase 3 — 几何测量与 SVG

实现：

```text
flow-geometry.ts
FlowRibbons.svelte
ResizeObserver
locale / resize 重算
```

验收：

- 1280、1440、1920 宽度下路径始终连接到正确锚点；
- 页面 resize 后不漂移；
- SVG 不阻挡点击。

## Phase 4 — 确定性 Particle Projection

先写纯函数测试：

```text
相同 seed + progress → 相同坐标
不同 progress → 坐标变化
progress clamp
pause 不需要特殊时间状态
reduced motion 输出静态 marker
```

然后实现 Canvas。

## Phase 5 — 六阶段动态

按顺序接入：

1. Weights；
2. Tokens；
3. Embedding；
4. Transformer；
5. Logits；
6. Decode loop。

每做完一个 stage，先在以下 progress 手动检查：

```text
0.00
0.08
0.16
0.24
0.40
0.58
0.72
0.88
1.00
```

## Phase 6 — 交互与 i18n

接入：

- Stage click；
- Hover / focus；
- Tooltip；
- English / 中文；
- Reduced Motion；
- stage accessible name；
- Canvas / SVG aria-hidden。

## Phase 7 — 页面集成

最小修改 `+page.svelte`。

验证：

- Start；
- Pause；
- Seek；
- Single Step；
- Chapter browse；
- Scroll takeover；
- language switch；
- replay from end。

## Phase 8 — QA 与文档

运行完整验证，保存桌面截图和录屏，更新连续性文档，然后停止等待用户验收。

---

## 21. 自动化测试计划

## 21.1 `global-flow-model.test.ts`

至少覆盖：

```text
✓ 10 shards 来自 experience
✓ total bytes 和 quant type 正确
✓ Token text / ID 数量一致
✓ embedding shape 来自 validation
✓ 40 layers 全部存在
✓ linear + full = 40
✓ logits shape 来自真实 decode step
✓ top-1 与 selected ID 一致
✓ 5 decode steps
✓ 缺少关键数据时抛出错误，不回退到硬编码
```

## 21.2 `particle-projection.test.ts`

至少覆盖：

```text
✓ 相同输入完全确定
✓ seed 改变时分布改变
✓ progress 0 / 1 边界稳定
✓ stage 之外粒子不可见或淡化
✓ active layer 投影正确
✓ decode 5 个 micro-step 正确
✓ reduced motion 不返回连续旅行粒子
```

浮点坐标使用合理精度比较，不测试 Canvas 像素级 anti-aliasing。

## 21.3 `GlobalFlow.test.ts`

至少覆盖：

```text
✓ 六个主要 stage 是 button
✓ Canvas aria-hidden
✓ SVG decorative layer aria-hidden
✓ Shape / token / layer count / logits 来自 props
✓ progress=0.60 时 active layer 合理
✓ progress=0.90 时 decode completed step 合理
✓ 点击 weights 导航 init
✓ 点击 transformer 导航 prefill
✓ 点击 completion 导航 decode
✓ 点击只触发 onNavigate，不触发 seek
✓ 中文文案可见
✓ reduced motion 状态可理解
```

## 21.4 `page.test.ts`

新增或加强：

```text
✓ Global Flow 单步按 1/6 前进
✓ Pause 后 data-motion-progress 不再增长
✓ 重新 Play 后继续
✓ 切换语言保留 progress 和 active layer
✓ 浏览到其他章节不补完 overview
✓ 运行中滚动后 overview 进度仍继续
✓ Stage 浏览不移动 Cursor
✓ 从 final replay 回到 initialization
```

## 21.5 源码防回归

可以增加轻量测试或审计脚本，确保：

```text
GlobalFlow.svelte 不包含 "[5, 2048]"
GlobalFlow.svelte 不包含 "[1, 248320]"
GlobalFlow.svelte 不包含硬编码 Token 数组
Global Flow CSS 不包含 infinite particle animation
```

不要写过度脆弱的全文件 snapshot。

---

## 22. 真实浏览器验收

## 22.1 必测尺寸

```text
1280 × 720
1440 × 900
1920 × 1080
```

本轮不提交 390px 验收。

## 22.2 首屏截图

至少保存：

```text
overview-idle.png
overview-weights.png
overview-tokens.png
overview-embedding.png
overview-transformer-linear.png
overview-transformer-full.png
overview-logits.png
overview-decode-loop.png
overview-complete.png
overview-zh-CN.png
overview-reduced-motion.png
```

## 22.3 真实交互

必须实际指针点击：

- Weights；
- Tokens；
- Transformer；
- Completion。

记录：

- 点击中心命中元素；
- 目标章节进入 viewport；
- inference cursor 未被浏览动作修改。

## 22.4 Pause / Seek / Single Step

Pause：

1. Play；
2. 记录 progress、active layer、某粒子位置投影；
3. Pause；
4. 等待 800ms；
5. 三者不变。

Seek：

1. Seek 到相同 progress 两次；
2. `data-active-stage`、`data-active-layer` 和 deterministic particle checksum 相同。

Single Step：

```text
Overview 0 → 1/6 → 2/6 → ... → 1
```

每次只完成一个语义阶段。

## 22.5 Resize

播放暂停时从 1280 改为 1600，再改回 1280：

- 路径重新连接；
- Canvas 清晰；
- Layer tunnel 不越界；
- Token / Embedding 对齐；
- 无 console error。

## 22.6 EN / 中文

在 Transformer stage 中间切换语言：

- progress 不变；
- active layer 不变；
- selected particle phase 不变；
- stage 宽度变化后 SVG 自动重算；
- 没有标签重叠到不可读。

## 22.7 Console

要求：

```text
0 uncaught errors
0 Svelte warnings
0 ResizeObserver loop errors
0 Canvas invalid state errors
```

---

## 23. 验收标准（Definition of Done）

全部满足才可申请用户验收：

### 产品

- [ ] 首屏不再呈现六个等形卡片；
- [ ] 静态画面能直接理解完整推理路径；
- [ ] 40 层是首屏主要视觉对象；
- [ ] 五次 Decode 循环可见；
- [ ] 粒子具有明确数据语义，不是背景装饰；
- [ ] 与后续 Attention / MoE / TP 视觉语言一致。

### 数据

- [ ] Global Flow 无 run 事实硬编码；
- [ ] 10 shards 来自数据；
- [ ] Token / IDs 来自数据投影；
- [ ] Embedding shape 来自 validation；
- [ ] 40 层与 30/10 计数由数组派生；
- [ ] Logits shape / candidate / selected token 来自真实 decode step；
- [ ] Final text 与 5 IDs 精确；
- [ ] 粒子与几何明确标记 Schematic。

### 播放

- [ ] `PlaybackEngine` 是唯一时间源；
- [ ] Pause 冻结；
- [ ] Seek 确定；
- [ ] Single Step 正确；
- [ ] 从末尾 Replay 正确；
- [ ] Scroll 不暂停；
- [ ] Chapter browse 不移动 cursor；
- [ ] Language switch 不重置状态。

### 工程

- [ ] 无新 D3 / GSAP / Three.js，除非已单独获批；
- [ ] Canvas DPR 有上限；
- [ ] DOMRect 不在每帧读取；
- [ ] observer / listener 正确清理；
- [ ] 现有测试不删除；
- [ ] 新测试通过；
- [ ] `npm run check` 通过；
- [ ] `npm test -- --run` 通过；
- [ ] `npm run build` 通过。

### 桌面浏览器

- [ ] 1280×720 通过；
- [ ] 1440×900 通过；
- [ ] 1920×1080 通过；
- [ ] 无桌面端全局横向溢出；
- [ ] 真实点击命中；
- [ ] 路径和 stage 对齐；
- [ ] Console 干净。

### Gate

- [ ] 更新项目文档；
- [ ] 提交截图 / 录屏证据；
- [ ] 停止并等待用户产品/视觉验收；
- [ ] 不进入移动端；
- [ ] 不进入 P7；
- [ ] 不 commit / push / deploy，除非用户另行授权。

---

## 24. 风险与规避

## 24.1 Canvas 与 DOM 漂移

风险：Canvas 粒子路径与 DOM stage 不对齐。

规避：

- 同一根容器坐标系；
- ResizeObserver；
- locale 后重算；
- Canvas 与 SVG 使用相同 geometry model；
- 浏览器 resize 测试。

## 24.2 双时间源

风险：CSS animation 或 GSAP 自己运行，Pause 后仍在动。

规避：

- 只使用 progress 纯函数；
- 禁止 infinite；
- 粒子 phase 由 progress 计算；
- Pause 浏览器测试。

## 24.3 粒子过多导致性能下降

规避：

- DPR ≤ 2；
- 总粒子约 140 内；
- 不绘制高斯大模糊；
- 缓存路径 sample；
- 不每帧测 DOM。

## 24.4 视觉炫技压过教学

规避：

- 每个视觉元素有固定语义；
- 文字标签始终清晰；
- 3D 不可旋转；
- 粒子数量注明 Schematic；
- Stage 完成态可静态理解。

## 24.5 误称概率

风险：把 logits 柱形写成概率。

规避：

- 文案统一 `Top logits`；
- 只有真实 softmax 才能写 probability；
- 测试检查关键文案。

## 24.6 再次硬编码当前 run

规避：

- 独立 view model；
- 缺数据抛错；
- 源码审计测试；
- 组件只消费 props。

## 24.7 破坏现有 Focus / Scroll 契约

规避：

- `+page.svelte` 最小修改；
- 不改 `openDetail`；
- 不改 camera follow；
- 运行完整 page regressions；
- 实际滚轮检查。

## 24.8 桌面改造意外删除移动端旧支持

本轮不验收移动端，但不要主动删除：

- 现有 media query；
- 390px Focus 保护；
- 页面可访问语义。

若新 Global Flow 在小屏需要简单 fallback，可以保留语义结构，但不要扩展为新的移动端设计任务。

---

## 25. 文档更新

完成实现后必须更新：

```text
docs/project-context/CHAT_TIMELINE.md
docs/project-context/CURRENT_STATE.md
TASKS.md
MEMORY.md
design-qa.md
```

如果 Global Flow 渲染边界、Playback 语义或架构原则发生变化，新增 ADR；仅组件内部重构不需要为了形式写 ADR。

建议新增审计目录：

```text
docs/audits/2026-07-14-desktop-particle-global-flow/
├── AUDIT.md
├── overview-idle.png
├── overview-transformer.png
├── overview-logits.png
├── overview-decode-loop.png
├── overview-complete.png
├── overview-zh-CN.png
└── overview-reduced-motion.png
```

`AUDIT.md` 至少记录：

- Git 基线；
- 修改文件；
- 测试结果；
- 浏览器尺寸；
- pointer hit；
- Pause / Seek / Single Step；
- Scroll 不暂停；
- EN / 中文保持；
- 已知边界；
- 用户验收状态。

---

## 26. 推荐的 Agent 执行提示词

下面内容可直接交给 coding agent：

```text
请接手 https://github.com/MrZ20/model-inference-visualizer 对应的本地仓库。

先完整读取根目录 AGENTS.md，再严格按
docs/project-context/CONTEXT_MANIFEST.md 恢复全部上下文。检查真实 Git
状态，保护 staged、unstaged 和 untracked 修改。未经授权不得 reset、
checkout、clean、commit、push、deploy，不得重新运行 SSH/NPU 采集。

本轮唯一大步骤：
只重构桌面端首屏 GlobalFlow。移动端不在本轮设计和验收范围内，不进入
P7，不重写后续 Linear/Full Attention、MoE、TP、Decode Focus Scene。

目标：
把当前六个等形流程卡片改造成连续的“2.5D 张量管线 + 粒子数据流”：
10 checkpoint shards
→ 5 tokens / IDs
→ embedding [5, 2048]
→ 40-layer mixed-attention tunnel
→ logits [1, 248320]
→ selected token
→ five-step decode / KV reuse loop。

交互参考：
https://poloclub.github.io/transformer-explainer/
源码参考：
https://github.com/poloclub/transformer-explainer

只借鉴其连续画布、DOM 锚点 + SVG 流带、2.5D 层叠和原位交互语法。
不要复制 GPT-2 结构、品牌、浏览器推理和独立 GSAP 时间线。

技术要求：
1. PlaybackEngine 是唯一时间源。
2. 不使用 CSS infinite particle animation、setInterval 或组件内自主时钟。
3. 相同 experience + progress 必须产生相同粒子位置。
4. 使用稳定 seed。
5. HTML 承载全部文字、Shape、按钮和 Fidelity。
6. SVG 承载流带。
7. Canvas 只承载 aria-hidden 的粒子。
8. 默认不新增 D3、GSAP、Three.js。
9. 不在每帧读取 DOMRect。
10. 1280×720、1440×900、1920×1080 验收。
11. 本轮不做 390px 视觉验收。
12. GlobalFlow 不得硬编码 Token、[5,2048]、30/10、[1,248320]。
13. 数据缺失时失败，不回退到伪造值。
14. Stage 点击只浏览章节，不移动 inference cursor。
15. Pause、Seek、Single Step、Scroll takeover、双语、Reduced Motion 不得回归。
16. 粒子密度、深度和路径标记为 Schematic；事实值来自 p4r4 trace。

按本文档的 Phase 0～8 执行。先写失败测试，再做数据模型，再做静态构图，
最后加入确定性粒子。运行：

cd web
npm test -- --run
npm run check
npm run build

保存真实浏览器截图和交互证据，更新 CHAT_TIMELINE、CURRENT_STATE、
TASKS、MEMORY 和 design-qa。完成后停止等待用户桌面端视觉验收；
不要 commit、push、deploy，不要继续移动端或 P7。
```

---

## 27. 最终原则

这次重构的优先级顺序是：

```text
可理解性
> 真实性
> 状态确定性
> 与现有交互契约一致
> 视觉表现力
> 技术炫技
```

最终画面应让用户产生的第一反应是：

> “我能看到数据真的沿着一次推理向前走。”

而不是：

> “这里有六个更漂亮的卡片。”
