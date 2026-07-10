# 交互与视觉规范（P5）

> 状态：融合方向已确认，等待视觉稿最终验收
> 默认语言：English；支持 `EN / 中文` 即时切换
> 参考：Transformer Explainer 的连续数据流、点击展开和长页面叙事；不复制其 GPT-2 信息结构

## 1. 一句话体验

用户沿着一次真实的 Qwen3.5 推理向下滚动；主画布保持在视口中，数据连续地从权重、Token、矩阵和两张 NPU 卡流向下一个输出 Token。点击任一流程节点，镜头在同一画布内平滑放大到该节点的内部计算，再平滑返回全局流程。

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

每个核心章节占约 160–240vh，内部包含一个接近 100vh 的 sticky 主画布和一条简短叙事轨。进入下一章节时，画布连续变形而不是整页闪切。

### 宽度策略

- 可视化区域使用 `100vw`，不使用文章式窄 `max-width`。
- 1280px 以上提供完整体验；1920px/2K/4K 显示器使用额外宽度扩展间距和并行轨道。
- 超宽流程通过缩放与局部平移查看，不要求用户进行无边界横向滚动。
- 1100px 以下进入摘要布局；移动端不承诺完整矩阵探索。
- 长文解释单独限制在约 60–68 个字符的舒适行宽，不能反向限制主画布。

## 3. 连续播放与点击展开

### 3.1 全局播放

滚动、播放按钮和时间线操作同一份播放状态：

- 滚动：浏览故事并控制章节内进度。
- `Play / Pause`：自动沿当前章节播放。
- `Previous / Next`：跳到相邻语义事件，而不是跳到下一张图片。
- 时间线：在初始化、Prefill、Decode 和最终输出之间定位。
- `0.5× / 1× / 2×`：只改变动画速度，不改变真实耗时标签。

### 3.2 Focus Scene

可展开节点使用统一状态：

    overview -> expanding -> detail -> collapsing -> overview

展开时保留来源和去向，非相关内容降低对比度，不直接卸载整个画面。退出详情后回到同一章节、同一播放位置。

### 3.3 各章节展开内容

| 节点 | 点击后连续展开 |
|---|---|
| Weight loading | checkpoint shards → parameter names → TP shard assignment → NPU memory |
| Tokenization | text spans → token strings → IDs → embedding rows |
| 40 layers | 40 层总览 → 代表层 3 → Attention/MoE 内部 |
| Attention | Q/K/V → QKᵀ → scale/mask → softmax → weighted sum |
| MoE | router logits → top-8 experts → dispatch → GMM1/SwiGLU → GMM2 → combine |
| W8A8 | BF16 activation → per-token scale → INT8 matrix input → BF16 output |
| TP=2 | replicated/sharded weights → Rank 0/1 local work → collective → merged result |
| Logits | hidden state → vocabulary logits → top candidates → greedy token |
| Decode | KV Cache reuse → one-token step ×5 → growing final text |

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
