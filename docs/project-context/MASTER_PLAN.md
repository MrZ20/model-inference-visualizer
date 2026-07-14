# 模型推理可视化总方案

> 这是压缩后用于恢复项目初衷的主方案。详细采集点和模块接口仍以 `docs/PROJECT_PLAN.md`、`docs/ARCHITECTURE.md` 和 ADR 为补充。
>
> 当前状态：P0–P5 数据、架构与视觉方向已完成；P6 三个纠偏切片、readiness、完成性审计、P6.5 页面/游标解耦、P6.6 滚动不中断、P6.7 Decode 浅色一致性和 P6.8/P6.9 全章节连续滚动已实现并通过机器/浏览器复验，等待用户实际操作验收。用户接受前不进入 P7。

## 1. 北极星

做一个基于真实 Qwen3.5-35B-A3B W8A8 / vLLM Ascend 轨迹的动态教学网页。读者应能看到一次推理从“进程和模型尚未 ready”开始，经过权重加载、Token、矩阵、40 层、Attention、MoE、Tensor Parallel、logits 和 5 次 Decode，最终得到文本。

网页不是模型在线运行器，而是可重复播放、可暂停、可单步、可点击深入的真实轨迹解释器。每个关键画面都能回答：

- 数据从哪里来；
- 输入和输出是什么；
- shape / dtype / device / rank 如何变化；
- 这是直接采集、统计、离线推导、配置结构还是教学示意；
- 对应哪次 run、哪个产物和哪段源码语义。

## 2. 目标体验

### 2.1 一条连续故事

```text
Config / processes / TP ranks
  → checkpoint shards and parameter mapping
  → quantization / NPU memory / KV cache / warmup
  → prompt text
  → tokens and IDs
  → embedding [5, 2048]
  → 40 mixed-attention + MoE layers
  → logits [1, 248320]
  → greedy next token
  → decode × 5
  → final text
```

用户既可以滚动浏览，也可以点击播放、暂停、前后页面与单步；这些入口由同一个引擎协调，但“当前看到的页面”和“推理已经执行到的步骤”必须分开。连续播放默认让镜头与正文跟随推理游标；手动滚动或浏览章节时只接管镜头，推理与正文动画继续运行，且不能把旧页面补完。

### 2.2 点击深入而不是切换图片

点击 Weight loading、Tokenization、Attention、MoE/W8A8、TP、Logits 或 Decode，应在同一页面和同一视觉语境中连续展开内部步骤。退出时回到原章节与原时间点。

例如 Attention 必须形成可理解的连续过程：

```text
input token rows
  → captured Q / K / V
  → QKᵀ scores
  → scale + causal mask
  → softmax probabilities
  → probabilities × V
  → fused output comparison
```

这不是“点一下出现一段隐藏文字”，也不是静态截图轮播。

### 2.3 长而宽的教学画布

- 整体是纵向长页面，不把全局流程、矩阵、双 rank 和全部解释塞进一个 A4 式视图。
- 可视化主画布接近全宽；解释文字才限制阅读行宽。
- 章节通过滚动和画布变形衔接，允许页面自然拉长。
- 超宽屏扩展间距与并行轨道；小屏只保证摘要，不强行缩小完整矩阵。

## 3. 读者与信息层级

第一层服务初次理解推理的人：默认只说明发生了什么、为什么和下一步去哪里。

第二层服务工程师：通过 Evidence / Tensor Inspector 查看 run ID、shape、dtype、rank、stage、统计、真实性和 provenance。

两层使用同一播放状态，不维护两套彼此偏离的页面。任一时刻只保留一个主要视觉焦点。

## 4. 页面章节

1. **Opening / Run Overview**：明确这是一条真实 Qwen3.5 Ascend recorded trace。
2. **Model Initialization**：配置、40 层骨架、量化描述、TP ranks、10 个权重分片、参数映射、NPU memory、KV Cache、warmup/graph capture、READY。
3. **Text to Tokens**：prompt 字符片段、Token 字符串、IDs、scheduler、真实长度和 padding、embedding 行。
4. **Prefill through 40 Layers**：展示 40 层真实结构、30 linear attention / 10 full attention，并进入代表层。
5. **Attention under the Microscope**：真实 Q/K/V 驱动的 16-head DERIVED attention 剧场。
6. **MoE + W8A8**：router、top-8、256 experts、dispatch、per-token scale、GMM1/SwiGLU、GMM2、combine。
7. **Tensor Parallelism**：TP=2 两条 rank 轨道、本地权重/激活、并行 span、collective 和合并结果。
8. **Logits and Decode**：hidden → logits → top candidates → greedy token；KV reuse 与 5 次 Decode。
9. **Evidence and Method**：真实性、数据来源、run provenance、限制与术语。

## 5. 已冻结的真实数据

当前发布 run：`qwen35-a3b-w8a8-20260710-p4r4`。

| 项目 | 事实 |
|---|---|
| Prompt | `Hello, my name is` |
| Prompt IDs | `[9419, 11, 821, 803, 369]` |
| Generated IDs | `[498, 7525, 3855, 1089, 321]` |
| Final text | `Hello, my name is [Your Name], and` |
| 模型 | hidden 2048、40 层、vocab 248320 |
| 混合层 | 30 linear attention、10 full attention |
| Attention | 16 Q heads、2 KV heads、head size 256、GQA 8:1 |
| MoE | 256 experts、每 Token top-8 |
| 并行 | TP=2、EP=false |
| 量化 | W8A8_DYNAMIC；不能声称所有模块都是 INT8 |
| Prefill | 真实 5 Token；执行 padding 在对应运行证据中说明 |
| Decode | 5 个输出 Token；每步 logits `[1, 248320]` |

Attention 的完整概率矩阵不是 CANN 内核原生 dump。它由真实 Q/K/V 按真实布局、scale、GQA 和 causal mask 离线计算，并用融合输出验证；两 rank 余弦相似度均高于 0.9999988。

## 6. 真实性契约

所有可视元素必须携带以下一种 fidelity，不能含糊使用“真实”：

| Fidelity | 含义 | 例子 |
|---|---|---|
| `EXACT` / Captured | 本次真实运行直接采集的小数据 | token IDs、top-8 experts、选中 token |
| `SUMMARY` | 真实大 Tensor 的统计或受控抽样 | min/max/mean、样本、duration 摘要 |
| `DERIVED` | 真实输入经确定公式得到并校验 | attention scores、mask、softmax、平均热力图 |
| `STRUCTURAL` | 来自 config / source 的确定结构 | 40 层、256 experts、TP 拓扑、shape |
| `SCHEMATIC` | 教学动画，不代表采集数值 | 权重流动、内核内部概念步骤 |

不得把 eager trace 的时间当成 graph 性能，不得把 TP group 复用解释成 EP=2，不得伪造融合内核未返回的 workspace 或原生 softmax buffer。

## 7. 技术架构

```text
Remote vLLM / vLLM Ascend / NPU
  → bounded collector
  → raw private bundle
  → validation + redaction + projection
  → curated bundle
  → web bundle
  → static Svelte application
  → repository / playback / projection / locale
  → continuous DOM / SVG / CSS / Canvas scenes
```

### 7.1 运行方式

- 离线采集、静态回放；网站无 SSH、NPU 或 Python 后端。
- raw 数据不提交；网页只使用脱敏、校验后的 Web Bundle。
- 当前数据源固定为 `p4r4`，除非新的采集任务得到用户授权。

### 7.2 前端职责

- `TraceRepository`：加载 manifest、chapter 和 artifact，隐藏路径、缓存和错误。
- `PlaybackEngine`：唯一推理时间源，分别维护 view chapter、inference cursor 和各场景真实进度，处理三种开始起点、单步/连续、focus 与 reduced motion；页面层单独协调可恢复的自动镜头跟随和不中断 transport 的 scroll takeover。
- `SceneProjector` / `buildTraceExperience`：把真实轨迹变成稳定场景模型，不允许页面重新硬编码模型事实。
- `LocaleCatalog`：English / 中文文案完整对应，切换不重置播放和 focus。
- Scene components：只渲染场景并发出语义命令，不各自创建脱离播放状态的动画。

### 7.3 动态的判定

动态不是“CSS 在页面加载时动一下”，也不是“计数器或进度条在变”。客观成立至少要求：

- 两个时间点的当前场景内容几何、透明度、矩阵阶段或路径状态发生可见变化；
- 章节变化时镜头默认跟随；用户滚轮/触控可接管镜头而不暂停自动播放；
- 只浏览章节不得改写推理游标或把旧章节补到 100%；
- 点击控件的真实 pointer hit-test 命中控件；
- 展开内容与当前 viewport 相交；
- 展开内容展示真实数据并按语义顺序运动。

## 8. 远端与数据安全边界

- SSH 入口仍为 `a3-node1`；实际容器已核验为 `zsl_m2m_0612_1`。
- 远端源码不做生产修改；采集使用外部受控 hook。
- 默认 NPU 4、5；运行前重新核验占用，不能沿用旧状态猜测。
- 单个远端采集输出约 2G 硬上限；SCP 前 `du` 和列文件。
- 待 SCP 数据超过 10G 必须停止并征得用户确认。
- 不发布模型权重、凭据、hostname、IP、绝对远端路径或可恢复权重切片。
- 当前任务不需要再次 SSH 或采集；除非新的页面需求确实缺数据并得到阶段授权。

## 9. 分阶段流程与验收门

| 阶段 | 内容 | 当前状态 | Gate |
|---|---|---|---|
| P0 | 方案、范围、初始 memory | 已完成 | 用户同意默认方案 |
| P1 | 远端环境与 baseline | 已完成 | baseline 通过、边界明确 |
| P2 | schema 与有界采集器 | 已完成 | 本地行为测试通过 |
| P3 | 正式推理采集 | 已完成 | 输出正确、证据完整 |
| P4 | 校验、脱敏、Web 投影 | 已完成 | 错误 0、发布包受控 |
| P4.1 | W8A8 / MoE / TP 补采 | 已完成 | 量化链与双 rank 齐全 |
| P4.2 | DERIVED Attention | 已完成 | 与融合输出验证通过 |
| P5 | 架构与融合视觉稿 | 已完成 | 用户确认长卷 + 矩阵剧场 + TP 双轨 |
| P6 | 网站 MVP | **等待用户最终验收** | 三个纠偏 Slice、Linear/Full Attention、P6.5 播放策略、P6.6 滚动不中断、P6.7 Decode 浅色一致性和 P6.8/P6.9 全章节连续滚动已通过机器/浏览器检查；仍需用户亲自接受 |
| P7 | 发布 QA | 未开始 | 只有 P6 用户验收后才能进入 |

每个大步骤结束后停下等待用户验收。用户曾特批 P2/P3/P4 合并，这不代表后续默认也可跨 Gate。

## 10. P6 已执行的恢复路线

上下文档案获得用户验收后，没有直接宣布 P7，而是按以下路线完成了 P6 纠偏：

1. 对照选定视觉稿和本契约，对当前页面做可截图、可操作的差异审计；
2. 把差异分成构图、动态连续性、Focus Scene、数据真实性、双语和响应式；
3. 明确一轮要修到什么可见结果，并建立对应组件/E2E 验收；
4. 实现后同时提供真实浏览器操作证据与视觉对照；
5. 停下由用户验收 P6，未验收不得进入 P7。当前正处于此 Gate。

## 11. 验收标准

### 产品与视觉

- 首屏 5 秒内说明这是“一次真实 Qwen3.5 Ascend 推理回放”。
- 页面整体构图可清楚追溯到选定视觉稿，而非通用 landing page 或卡片 dashboard。
- 长页面、全宽流程、Attention 矩阵剧场和 TP 双轨均真实存在。
- 任一时刻只有一个主要视觉焦点，信息随章节/点击按需出现。

### 交互

- Start 提供从头、当前页面、当前步骤三种起点，以及单步/连续两种模式。
- play/pause、previous/next、chapter、scroll 由一个引擎协调；页面位置与推理游标可独立验证。
- 正文而非只有进度条连续变化；镜头跟随且允许手动接管。
- Attention、MoE、TP 的真实点击能在当前视口展开动态图，并可收起返回原位置。
- English 默认；中文切换覆盖所有 UI 且不重置状态。

### 数据

- 40 层结构、linear/full attention、256 experts、top-8、TP spans、5 次 Decode 来自 `p4r4` 投影或明确结构数据。
- 缺少证据时测试失败，不退回静默硬编码。
- Captured / Derived / Structural / Schematic 能被用户直接区分。

### 工程

- 单元测试覆盖纯状态和数据投影；组件测试点击真实控件；浏览器测试覆盖 hit-test、viewport 与内容运动。
- `npm run check`、`npm test`、`npm run build` 通过。
- 视觉对照与用户操作验收是独立 Gate，不能被 UT 数量替代。

## 12. 明确排除

- 浏览器运行 35B 模型或网站直连 SSH/NPU。
- 训练、反向传播、第一版多模型适配。
- 全量权重、完整 vocab、完整大 Tensor 的 DOM 网格或公开发布。
- 静态图片轮播、A4 单屏仪表盘、每章节独立页面。
- 只靠“我看起来可以”或 DOM 存在判断交互成功。
- 未经用户确认扩大采集到 10G 以上或修改远端生产源码。

## 13. 当前只允许的下一步

请用户实际操作 `http://127.0.0.1:4175/?lang=en`，重点复验所有章节是否随滚轮连续移动，并同时确认 Decode 浅色一致性、页面切换不补完、三种开始起点、单步/连续以及运行中滚动不停。只有用户接受整体产品/视觉效果后，才能关闭 P6 Gate 并决定是否进入 P7；当前不重新采集、不连接 SSH、不 commit 或 push。
