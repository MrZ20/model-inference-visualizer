# 交互与视觉规范（P6.10 当前状态）

> 状态：桌面 Global Flow 以根目录粒子方案为当前权威；核心实现已有机器证据，但用户指出视觉结果偏离方案，当前 Gate 未通过
> 默认语言：English；支持 `EN / 中文` 即时切换
> 参考：Transformer Explainer 的连续数据流、点击展开和长页面叙事；不复制其 GPT-2 信息结构

## 1. 一句话体验

用户沿着一次真实的 Qwen3.5 推理向下滚动；首屏用一条宽屏 2.5D 管线展示数据从权重、Token、Embedding、40 层和 logits 流向输出。所有正文章节处于自然文档流；点击阶段只浏览对应章节，再由原位 Focus Scene 展开内部计算。

网站不是图片轮播。底层轨迹由离散事件组成，但画面通过几何插值、颜色过渡和路径动画连续播放；不能直接采集的融合内核内部步骤只使用经过验证的 `DERIVED` 数据或明确的 `SCHEMATIC` 教学表达。

## 2. 页面不是一张“大卡片”

页面采用长页面 scrollytelling，而不是把所有信息塞入 1440×1024 的单屏：

1. `Opening / Run Overview`
2. `Model Initialization`
3. `Text to Tokens`
4. `Prefill through 40 Layers`
5. `Attention under the Microscope`
6. `MoE + W8A8`
7. `Tensor Parallelism`
8. `Logits and Decode`
9. `Evidence and Method`

每个核心章节按真实内容自然展开，主画布随文档连续移动，不再用固定的 160–240vh sticky 跑道。进入下一章节时仍保持同页连续叙事，不整页闪切。

### 宽度策略

- 可视化区域使用 `100vw`，不使用文章式窄 `max-width`。
- 1280px 以上提供完整体验；1920px/2K/4K 显示器使用额外宽度扩展间距和并行轨道。
- 超宽流程通过缩放与局部平移查看，不要求用户进行无边界横向滚动。
- 1100px 以下进入摘要布局；移动端不承诺完整矩阵探索。
- 长文解释单独限制在约 60–68 个字符的舒适行宽，不能反向限制主画布。

## 3. 连续播放与点击展开

### 3.1 全局播放

滚动、播放按钮和时间线由同一个 `PlaybackEngine` 协调，但可视页面和推理游标是两个正交状态：

- 滚动：只浏览故事；wheel、touch、滚动条或章节导航接管时关闭自动镜头跟随，但连续推理与正文动画不暂停，也不篡改推理进度。
- `Previous / Next`：只切换相邻页面，推理游标保持原位。
- 开始位置：从头开始、从当前页面 0% 开始、从当前推理步骤继续。
- 执行方式：连续模式可跨章节；单步模式只推进当前场景的一个语义阶段。
- 连续播放：镜头自动跟随推理游标；手动滚动后镜头不再抢回控制权。
- 时间线：在初始化、Prefill、Decode 和最终输出之间定位。
- `0.5× / 1× / 2×`：只改变动画速度，不改变真实耗时标签。

顶栏同时显示 `Viewing` 和 `Cursor`。仅浏览另一页面不得把旧页面补到完成态；点击具体层、Focus stage 或显式开始策略才可以改变推理游标。

### 3.2 Focus Scene

可展开节点使用统一状态：

    overview -> expanding -> detail -> collapsing -> overview

展开时保留来源和去向，非相关内容降低对比度，不直接卸载整个画面。退出详情后回到同一章节、同一播放位置。

### 3.3 各章节展开内容

| 节点 | 点击后连续展开 |
|---|---|
| Weight loading | checkpoint shards → parameter names → TP shard assignment → NPU memory |
| Tokenization | text spans → token strings → IDs → embedding rows |
| 40 layers | 40 层总览 → Layer 0 Gated DeltaNet / Layer 3 Full Attention → MoE 内部 |
| Linear Attention | captured `[5, 2048]` input → QKVZBA projection → Causal Conv1D → Gated Delta recurrence → gated norm/out projection → captured output |
| Attention | Q/K/V → QKᵀ → scale/mask → softmax → weighted sum |
| MoE | router logits → top-8 experts → dispatch → GMM1/SwiGLU → GMM2 → combine |
| W8A8 | BF16 activation → per-token scale → INT8 matrix input → BF16 output |
| TP=2 | replicated/sharded weights → Rank 0/1 local work → collective → merged result |
| Logits | hidden state → vocabulary logits → top candidates → greedy token |
| Decode | prefill logits selection ×1 → KV reuse decode ×4 → growing final text |

## 4. 信息层级

默认只显示当前问题所需的信息：

- 主画布：当前数据在哪里、正在发生什么、下一步去哪里。
- 叙事轨：一到三句解释。
- 详情触发：点击、hover 或键盘 focus 后再出现 shape、dtype、rank、统计和来源。
- Evidence drawer：默认折叠，只在工程师需要时显示 run ID、stage、源码与 fidelity。

不同时展示全局流程、完整双 rank、完整矩阵、全部统计和全部解释。详情视图替换当前视觉重心，而不是继续向页面两侧堆面板。

## 5. 视觉语言

- 基础表面：暖白色，保留大量留白。
- 主色：indigo / violet；Q、K、V 与两个 rank 使用有限的 cyan、mint、coral。
- 连接：柔和的流带与细线，动画只强调当前数据路径。
- 形状：矩阵、向量、分片和合并点，不使用装饰性图表。
- 分隔：优先使用留白、对齐和细分隔线，阴影只用于临时浮层。
- 字体：最多两套；正文基准 14–16px。
- 默认 UI 文案为英文。

## 6. 中英文切换

- 初次打开使用 English。
- 顶栏提供 `EN / 中文`，切换后保留当前章节、播放位置和展开状态。
- 用户选择写入本地存储；URL 可用 `?lang=en` 或 `?lang=zh-CN` 覆盖。
- 轨迹 JSON 只保存稳定语义 ID，不保存界面句子。
- 术语、说明、图例、无障碍标签和错误提示全部进入语言目录。
- shape、dtype、token ID、run ID 和数值不翻译。
- 中英文布局分别做截图测试，不能假设字符串等宽。

## 7. Fidelity 视觉规则

| 等级 | 显示 |
|---|---|
| `EXACT` | 实线 + `Captured` |
| `SUMMARY` | 实线 + `Summary` |
| `DERIVED` | 虚线 + `Derived from captured tensors` |
| `STRUCTURAL` | 点线 + `From config/source` |
| `SCHEMATIC` | 中性色 + `Teaching schematic` |

颜色不是唯一提示，线型和文本标签必须同时存在。

## 8. 融合后的视觉方向

- 原方向 1 的全局长卷用于 Overview 与章节过渡。
- 原方向 3 的矩阵剧场用于 Attention 等局部 Focus Scene。
- 原方向 2 的双轨实验室只在 Tensor Parallelism 与 MoE/W8A8 章节出现。

它们是同一个页面的不同缩放层级，不是三个互相切换的页面，也不是三套独立 UI。

## 9. 视觉验收条件

- 首屏在 5 秒内说清“这是一次真实 Qwen3.5 Ascend 推理回放”。
- 用户能点击节点并看到连续展开/收起的内部步骤。
- 任一时刻只有一个视觉焦点。
- 页面可以纵向滚动，宽屏画布不呈现 A4/仪表盘式拥挤。
- English 默认且语言切换不会重置进度。
- 真实采集、离线推导和教学示意可以在不阅读长文时区分。
- `prefers-reduced-motion` 下仍可通过分步状态理解流程。
