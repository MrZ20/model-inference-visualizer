# 模型推理可视化项目方案

> 状态：P0 方案草案，等待确认
> 日期：2026-07-09
> 目标模型：`Eco-Tech/Qwen3.5-35B-A3B-w8a8-mtp`
> 目标运行时：vLLM + vLLM Ascend，TP=2，Ascend NPU

## 1. 背景与问题

现有 `qwen3_5_35b_a3b` 教程已经覆盖调用链、模型配置、真实 token、关键 tensor 形状、MoE、W8A8、prefill/decode 和采样，但主要载体是长篇 Markdown。它适合作为证据和深度参考，不适合作为第一次接触推理流程时的主要入口。

新项目要把“阅读一系列文档”改造成“沿真实时间线观看并操作一次推理”：读者可以播放、暂停、单步、回退和放大某一步，看到数据从哪里来、形状为什么改变、运行时为什么做 padding、权重如何映射到设备、模型如何选出下一个 token。

## 2. 对初步流程的调整

原始设想是：先定方案，再运行推理收集数据，再做架构，最后搭网站。整体方向正确，但需要补一个关键步骤：**真实推理前必须先冻结最小轨迹协议和采集点清单**。否则完成一次昂贵推理后才发现缺少初始化事件、tensor 统计或 rank 信息，必须重复运行。

推荐顺序：

```text
方案确认
  -> 最小轨迹协议与采集点设计
  -> SSH/容器只读核查
  -> 采集器实现与轻量验证
  -> 一次正式推理采集
  -> 数据校验与裁剪
  -> 完整架构冻结
  -> 视觉方向确认
  -> 网站 MVP
  -> 深化交互与发布
```

## 3. 产品目标

### 3.1 北极星目标

让一个不熟悉 vLLM Ascend 的读者，在 10–15 分钟内建立下面这条完整心智模型：

```text
配置/权重初始化
  -> 请求进入 engine
  -> token 与运行时元数据
  -> embedding
  -> 40 层混合注意力与 MoE
  -> logits
  -> greedy token
  -> KV Cache 驱动的下一次 decode
  -> 最终文本
```

### 3.2 目标读者

- 第一层：第一次学习大模型推理、不了解 tensor 形状的读者。
- 第二层：希望定位 vLLM/vLLM Ascend 源码和运行证据的工程师。

因此网页提供两种同步视图：

- **故事模式**：解释“发生了什么、为什么”。
- **探索模式**：显示 shape、dtype、rank、来源函数、时间戳、统计值和源码位置。

### 3.3 成功标准

- 可以从“进程尚未启动”完整播放到生成 5 个 token。
- 每一步都能回答：输入、输出、形状变化、所在设备、对应源码、数据是否真实采集。
- 初始化与用户请求明确分开；dummy forward/graph capture 不被误认为 prompt 推理。
- 支持暂停、前进、后退、速度调整和阶段跳转。
- 无远端连接、无 NPU、无后端服务时也能完整运行网页。
- 默认首屏只加载摘要，深层矩阵按需加载；普通开发电脑交互无明显卡顿。

## 4. 已确认的真实基础

来自既有教程与动态追踪的事实将作为第一版数据基线：

| 类别 | 已确认事实 |
|---|---|
| Prompt | `Hello, my name is` |
| Prompt token IDs | `[9419, 11, 821, 803, 369]` |
| 生成 token IDs | `[498, 7525, 3855, 1089, 321]` |
| 输出 | `Hello, my name is [Your Name], and` |
| 模型 | 35B 总参数、A3B 激活、40 层、hidden size 2048 |
| Attention | 16 Q heads、2 KV heads、head dim 256 |
| 混合层 | 30 层 linear attention、10 层 full attention |
| MoE | 256 experts，每个 token top-k=8 |
| 量化 | `W8A8_DYNAMIC`，但 attention/lm_head 存在 FLOAT 条目 |
| 运行时 | TP=2、EP=false、multiprocessing、prefill 5 token padding 到 8 |
| 输出空间 | logits 形状 `[1, 248320]` |

这些数据足以做纸面原型，但不足以支撑“初始化全过程”和“层内矩阵动态变化”。正式网站前仍需补采集。

## 5. 产品范围

### 5.1 第一版必须包含

1. **初始化时间线**
   - 环境与版本快照。
   - 主进程、engine、TP rank 0/1 的建立。
   - 配置解析与模型骨架创建。
   - 量化描述加载与模块量化方法映射。
   - 权重分片发现、读取、参数映射和 rank 分配。
   - NPU 内存 profiling、KV Cache 分配。
   - dummy forward、图捕获/预热与 ready 状态。

2. **一次完整生成**
   - prompt 文本到 token/ID。
   - request、scheduler、prefill、padding 和 attention metadata。
   - embedding 与位置编码/位置元数据。
   - 40 层结构总览。
   - 代表性 full attention 层放大。
   - 代表性 linear attention 层放大。
   - MoE router、top-8 experts、dispatch、expert MLP、combine。
   - W8A8 动态激活量化与量化矩阵乘的教学视图。
   - LM head、top logits、greedy 选择。
   - 5 个 decode step 与 KV Cache 增长。

3. **证据与解释**
   - 每个阶段的“真实/统计/示意”徽标。
   - tensor 详情面板。
   - 源码与旧教程的证据链接。
   - 中英文术语对照。

### 5.2 暂不包含

- 在浏览器中运行 Qwen3.5-35B-A3B。
- 网站直接 SSH 到远端或实时控制 NPU。
- 训练、反向传播、优化器或权重更新。
- 全量 35B 权重或完整中间张量的公开下载。
- 多请求并发、复杂调度策略和性能 benchmark 的完整可视化。
- 第一版同时适配多个模型。
- 移动端上的完整矩阵探索；移动端先提供摘要浏览。

## 6. 核心叙事与交互

### 6.1 页面结构

建议采用单页、分层缩放的结构，视觉语言参考 Transformer Explainer 的“矩阵块 + 流程连线 + 局部放大 + 教科书解释”，但不复制其 GPT-2 结构或页面布局。

页面包含：

- 顶部：prompt、运行信息、播放/暂停、单步、速度、阶段选择。
- 中部：当前阶段的主动画和数据流。
- 底部：从初始化到第 5 个 decode token 的全局时间线。
- 右侧：解释、tensor 检查器、真实证据和源码位置。
- 全局：故事模式/探索模式切换。

### 6.2 初始化故事

```text
读取 config
  -> 构造 40 层骨架
  -> 读取 quant description
  -> 标记 W8A8/FLOAT 模块
  -> 建立 TP rank
  -> 发现 10 个权重分片
  -> 分片读取与参数映射
  -> 参数进入 NPU/对应 rank
  -> KV Cache 预算与分配
  -> dummy forward / graph capture
  -> READY
```

权重加载不展示完整权重值。默认展示分片、模块名、shape、dtype、量化类型、目标 rank、加载进度和内存变化；只有经过许可审查的小切片才可能用于教学矩阵。

### 6.3 推理故事

```text
文本
  -> token 片段
  -> token ID
  -> scheduler/prefill
  -> embedding [5, 2048]
  -> padding execution [8, 2048]
  -> 40 层处理
  -> 最后一个有效 token hidden state [1, 2048]
  -> logits [1, 248320]
  -> greedy token
  -> decode × 5
  -> 文本
```

40 层不逐层播放全部细节。总览显示所有层的类型、耗时和状态；深度视图只进入自动选出的代表性 full attention 层、linear attention 层和 MoE 路径。这样既忠于真实模型，也避免 40 次重复动画。

### 6.4 矩阵表达规则

- 大矩阵用形状和抽样热力图表示，不在 DOM 中画出数百万格。
- hover/选中显示 shape、dtype、device、统计值和采样策略。
- 形状改变使用连续动画；真实数值变化使用色带/小切片；纯概念关系使用线框示意。
- 颜色不能单独承载含义，同时使用标签、纹理或图标。
- 支持 reduced motion 和键盘控制。

## 7. 真实性分级

网站必须给每个可视元素标明数据级别：

| 等级 | 含义 | 例子 |
|---|---|---|
| `EXACT` | 本次真实运行直接采集 | token IDs、top-k expert IDs、top logits、选中 token |
| `SUMMARY` | 真实 tensor 的统计/采样 | min/max/mean、直方图、固定索引切片 |
| `STRUCTURAL` | 由配置/源码确定 | 40 层、256 experts、TP 拓扑、shape 推导 |
| `SCHEMATIC` | 教学示意，不代表真实数值 | 权重流动动画、KV block 简化布局 |

这项规则是验收硬条件：未标级的数据不得进入发布包。

## 8. 数据采集方案

### 8.1 采集原则

- 使用独立教学采集器或受控 hook，不长期污染生产热路径。
- 采集开关默认关闭，只在专用推理运行启用。
- 避免在热路径逐元素 `.item()`；统计尽量在设备上批量完成，再一次性同步。
- rank 0/1 分别记录事件，后处理时按单调时钟和逻辑 step 对齐。
- 对相同事件设置数量与体积上限，防止日志爆炸。
- 采集失败不能悄悄降级；缺失字段必须在 manifest 中显式标记。

### 8.2 初始化采集点

| 阶段 | 必采字段 | 默认不采 |
|---|---|---|
| 环境 | vLLM/vLLM Ascend/PyTorch/CANN 版本、模型 ID、关键非敏感配置 | SSH 凭据、token、完整环境变量 |
| 进程 | pid 的匿名 ID、role、rank、device、启动/ready 时间 | 主机名、用户目录 |
| 配置 | 模型结构、layer types、量化类型、并行配置 | 无关配置全文 |
| 权重分片 | 分片序号、大小、模块映射、加载耗时 | 完整权重内容 |
| 参数 | 参数名、shape、dtype、quant type、目标 rank、字节数 | 大块原始参数值 |
| 内存 | 关键阶段已分配/保留/可用量 | 连续高频采样 |
| KV Cache | block 数、block size、dtype、预计容量 | 完整 cache 内容 |
| 预热/图捕获 | capture size、模式、次数、耗时 | dummy tensor 全值 |

### 8.3 推理采集点

| 阶段 | 必采内容 |
|---|---|
| Tokenizer | token 文本、ID、字符区间 |
| Request/Scheduler | request ID（匿名化）、step 类型、真实 token 数、padding 数 |
| Input | input IDs/embedding shape、positions、关键 attention metadata shape |
| Layer overview | 40 层的类型、开始/结束、输入/输出 shape、耗时 |
| Full attention exemplar | Q/K/V shape、选定 head 的分数/概率小切片、mask 摘要 |
| Linear attention exemplar | 状态输入输出 shape、代表性统计与源码阶段 |
| MoE exemplar | router logits 摘要、top-8 IDs/weights、dispatch 计数、combine 摘要 |
| W8A8 exemplar | float 输入摘要、动态 scale、int8 范围、输出摘要 |
| LM head | 采样位置 hidden state 摘要、logits shape、top-N logits |
| Sampler | greedy 分支、选中 token ID、token 文本 |
| Decode | step 序号、新 token、KV 长度/占用变化、停止原因 |

### 8.4 数据裁剪策略

按三层保存：

1. **Raw 私有包**：完整日志、NDJSON 事件、必要 `.npy` 小切片，仅保存在受控本地目录，不提交 Git。
2. **Curated 校验包**：清洗后的事件、固定抽样、统计、源码映射，可用于测试。
3. **Web 发布包**：浏览器友好的 JSON/压缩二进制，只包含页面需要的数据。

建议发布包初始压缩体积控制在 5–10 MB；代表性矩阵按需加载。完整 logits 只保留 shape、分布摘要与 top-N，不发布 248320 个全量值。

### 8.5 数据安全与许可

- `.gitignore` 排除 raw/private 数据、模型权重、密钥和远端日志。
- 公开包前运行自动脱敏检查：主机名、用户名、绝对路径、IP、token、环境变量值。
- 默认不发布可恢复模型参数的权重切片。
- 如果项目最终公开部署，需要单独确认模型许可、轨迹数据许可和参考项目素材许可。

## 9. 推荐技术方案

### 9.1 总体形态

采用 **离线采集 + 静态网页回放**：

```text
SSH/NPU 环境
  -> Python 采集器
  -> Raw Trace Bundle
  -> 校验/脱敏/投影
  -> Web Trace Bundle
  -> 静态交互网页
```

网站运行时不需要 Python 服务或远端连接，适合本地演示和 GitHub Pages 等静态部署。

### 9.2 前端建议

- React + TypeScript + Vite：页面、状态与构建。
- D3：只负责比例尺、颜色、布局和数据转换，不让 D3 接管整个 DOM。
- SVG：流程连线、小规模矩阵和标注。
- Canvas：较密集的 heatmap/粒子动画；只有数据量证明需要时再引入 WebGL。
- 纯状态机/Reducer：控制播放、暂停、单步、跳转，保证确定性和可测试性。
- 静态资源分包：主时间线先加载，深度矩阵懒加载。

技术版本在正式 scaffold 时依据当时稳定版本锁定，不在方案阶段写死。

### 9.3 为什么不做实时网站

实时方案会把 SSH 凭据、模型服务、NPU 占用、超时和多进程采集暴露给前端，还会让教学结果不可复现。它可作为未来受控实验模式，但不是第一版架构。

## 10. 分阶段执行计划

### P0：方案与约束确认（当前）

产物：本方案、架构草案、任务清单、项目 memory。

验收门：用户确认目标、范围、默认假设和阶段顺序。

### P1：远端环境与现有资产核查

动作：

- 只读检查 SSH 路径、容器、两个源码仓版本、模型缓存和可用 NPU。
- 复现旧 trace 的最小命令，不立即做重型深度采集。
- 记录版本锁、源码 SHA、模型配置 hash、量化描述 hash。

验收门：环境可复现，且不会覆盖用户远端改动。

### P2：轨迹协议与采集器

动作：

- 冻结 `trace-schema v1`。
- 实现事件 writer、tensor summarizer、rank 对齐字段和体积限制。
- 先用小 tensor/已有日志验证，不直接跑完整 35B 深采集。
- 为每个 hook 定义卸载/回滚方式。

验收门：schema 校验通过，采集开销与输出体积在预算内。

### P3：一次正式推理与数据采集

动作：

- 记录初始化全过程。
- 运行固定 prompt、greedy、5 tokens 的正式流程。
- 采集 TP 两个 rank 的事件。
- 保存原始包、命令、退出状态、警告和 checksum。

验收门：输出与既有基线一致或差异得到解释；关键采集点完整。

### P4：清洗、校验与数据投影

动作：

- 对齐 rank 事件和逻辑 step。
- 校验 shape 链、token 链、top-k expert 和 sampling 因果关系。
- 脱敏、裁剪、生成 Web Bundle。
- 用 JSON Schema/类型生成器建立前后端契约。

验收门：每个页面故事节点都有数据或明确的 schematic 标记。

### P5：架构冻结与视觉方向

动作：

- 根据真实数据大小选择 SVG/Canvas 分界。
- 完成信息架构、播放状态机和模块接口。
- 先提供 3 个视觉方向，确认一个后再搭建页面。
- 产出桌面首屏、初始化态、层内放大态和 decode 态设计。

验收门：视觉方向、交互密度和技术架构经用户确认。

### P6：网站 MVP

动作：

- 搭建静态应用与数据加载。
- 完成初始化时间线、主推理时间线、播放控制和证据面板。
- 完成代表性 full attention、linear attention、MoE/W8A8 放大视图。
- 添加基础响应式、键盘和 reduced-motion 支持。

验收门：从空白状态可完整播放到最终文本，刷新后结果一致。

### P7：深化、QA 与发布

动作：

- 性能、可访问性、跨浏览器和视觉对照测试。
- 校验所有数值、术语、源码链接和真实度徽标。
- 优化首屏、懒加载、错误态和数据缺失态。
- 决定本地交付或静态部署目标。

验收门：达到下节的产品、数据和工程标准。

## 11. 验收标准

### 11.1 数据正确性

- token IDs 与文本可双向核对。
- prefill/decode、真实 token/padding、rank/device 不混淆。
- tensor 的输入输出 shape 链连续。
- MoE top-k IDs/weights 与 dispatch 汇总一致。
- 选中 token 与 logits top-N/greedy 规则一致。
- 任何缺失/推导/示意数据有显式标记。

### 11.2 交互与教学

- 播放、暂停、前进、后退、阶段跳转均可用。
- 每个阶段都有一句话解释和可展开的工程细节。
- 用户可从总览进入代表性层，再返回原时间点。
- 不把 dummy forward 当成用户请求，不把 logits 当概率，不把所有权重说成 int8。

### 11.3 工程质量

- 数据协议有 schema 与 fixture 测试。
- 播放逻辑是确定性的纯状态转换，可单元测试。
- 首屏与深层数据分包，缺失/损坏数据有错误提示。
- 采集和前端测试均在各自本地虚拟环境/依赖环境中执行。
- 未提交 raw trace、模型权重或敏感信息。

## 12. 风险与应对

| 风险 | 后果 | 应对 |
|---|---|---|
| 深度 hook 改变时序或同步 NPU | 数据不可信、性能异常 | 批量统计、限量采集、基线运行对照 |
| 多进程事件顺序不稳定 | 时间线错乱 | 同时记录单调时钟、rank 内序号和逻辑 step |
| 完整矩阵太大 | 浏览器卡顿、仓库膨胀 | 摘要、固定抽样、top-N、按需加载 |
| 模型版本变化 | 旧数据与源码不匹配 | 记录 commit/config/hash，bundle 带 provenance |
| 解释过度简化 | 误导读者 | 真实度分级、证据面板、专家复核 |
| 参考站点相似度过高 | 缺少项目独特性/许可风险 | 只借鉴交互语法，视觉与信息架构围绕 Ascend/Qwen 重做 |
| 远端信息泄露 | 安全问题 | raw/private 分层、自动脱敏、发布前扫描 |

## 13. 默认假设与待确认项

为避免阻塞，方案先采用以下默认值：

| 项目 | 默认值 |
|---|---|
| 仓库名 | `model-inference-visualizer` |
| 第一目标模型 | Qwen3.5-35B-A3B W8A8 MTP |
| 网站语言 | 中文为主，关键术语中英双语 |
| 用户 | 初学者主路径 + 工程师探索层 |
| 运行方式 | 预录真实轨迹，静态回放 |
| 第一版 prompt | `Hello, my name is`，greedy，5 tokens |
| 设备视图 | TP=2 为主，EP=false |
| 发布 | 先本地，验收后再决定 GitHub Pages/其他静态托管 |
| 屏幕 | 桌面优先，移动端提供摘要 |

正式进入 P1 前，需要用户确认或修改这些默认值，特别是：项目是否计划公开、是否允许保存小规模权重/激活采样、是否保留当前 prompt、以及视觉内容是更偏科普还是更偏源码调试。

## 14. 本轮不执行的动作

- 不连接 SSH。
- 不运行 NPU 推理。
- 不修改 vLLM 或 vLLM Ascend 源码。
- 不安装前端依赖。
- 不创建网站页面。

这些动作都要在本方案确认后按阶段门执行。
