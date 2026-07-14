# 网站架构（P5 冻结方向 + P6/P8 实际实现）

> 状态：P5 技术架构与融合视觉稿已确认；P6 产品/视觉尚未通过用户验收。当前恢复入口见 `docs/project-context/README.md`
> 日期：2026-07-10
> 发布运行：`qwen35-a3b-w8a8-20260710-p4r4`
> 核心原则：静态网站只读取稳定轨迹，不依赖 vLLM Python 对象，不把静态图片轮播伪装成推理动画

## 0. 已验证基础

- 无插桩 baseline 证明真实部署初始化、KV Cache、图捕获和优化路径。
- eager 观测运行提供同一模型、prompt 和 sampling 下的层内真实 tensor。
- P4.1 提供 W8A8 per-token scale、MoE 路径和 TP=2 双 rank span。
- P4.2 提供 layer 3 prefill 的完整 Q/K/V 与融合 attention 输出。
- `softmax @ V` 对融合输出的余弦相似度在两个 rank 上均大于 0.9999988。
- 最新 web bundle 约 4 MB，包含 init/warmup/prefill/decode 章节和前端专用投影。

网站使用“双证据轨”：

1. baseline 说明真实优化运行和初始化；
2. eager trace 说明层内数据和形状。

网页不得把 eager 耗时当作 graph 模式性能，也不得把离散事件之间的动画插值描述为额外采集到的 NPU 状态。

## 1. 产品与技术约束

- 一次真实推理从进程初始化播放到 5 个输出 token。
- 底层是离散语义事件，视觉通过插值形成连续动画。
- 点击节点在同一画布内展开内部步骤，不切换为静态图片。
- 页面采用纵向 scrollytelling + 全宽自然文档流，不做单屏仪表盘；顶部播放控制保持固定。
- UI 默认 English，完整支持 `EN / 中文` 切换。
- 所有视觉数据保留 `EXACT / SUMMARY / DERIVED / STRUCTURAL / SCHEMATIC`。
- 无 SSH、NPU、后端或模型权重时仍可完整运行。

## 2. 技术栈

| 层 | 选择 | 用途 |
|---|---|---|
| 应用 | Svelte 5 + SvelteKit static adapter + TypeScript | 静态站、响应式状态和章节组合 |
| 流程与矩阵 | 语义 DOM + CSS Grid + Tabler icons | 当前数据规模下保留按钮、region、矩阵和 rank lane 的可访问性 |
| 动画 | `PlaybackEngine` + `requestAnimationFrame` + CSS interpolation | 连续章节进度、内容 stage、镜头和展开/收起 |
| 密集数据 | 有界 DOM 切片/聚合 | 当前最大教学矩阵很小，不引入 Canvas；完整 tensor 不映射到 DOM |
| 样式 | CSS variables + Svelte scoped CSS | 双语、响应式、fidelity 和视觉 token |
| 测试 | Vitest + Testing Library + 真实应用内浏览器 | Module Interface、页面点击、视口、内容动态和视觉证据 |

不引入 ONNX Runtime Web：Qwen3.5 不在浏览器中计算，网站只回放已验证轨迹。

参考项目 Transformer Explainer 使用 Svelte、D3、GSAP 和点击展开的矩阵时间线。我们借鉴其交互语法，但使用独立的数据模型、Ascend/Qwen 叙事和视觉结构。其源码采用 MIT License；若后续直接复制代码片段，必须记录来源并保留许可。

## 3. 系统数据流

    Remote vLLM + vLLM Ascend + NPU
        -> TraceWriter
        -> Raw trace bundle
        -> TraceCompiler
        -> Curated trace
        -> Web bundle
        -> TraceRepository
        -> PlaybackEngine
        -> SceneProjector
        -> semantic DOM / CSS data views

采集和编译已经在 P2–P4.2 完成。P6 不回到远端重新解释事件；前端只消费 `data/web/<run-id>`。

## 4. Deep Module 与 Seam

本节使用以下固定术语：Module、Interface、Implementation、Seam、Adapter、Depth、Leverage、Locality。

### 4.1 TraceRepository Module

Interface：

```ts
export interface TraceRepository {
  open(runId: string): Promise<TraceSession>;
}

export interface TraceSession {
  readonly manifest: TraceManifest;
  chapter(id: ChapterId): Promise<TraceChapter>;
  artifact(ref: ArtifactRef): Promise<TraceArtifact>;
}
```

Implementation 隐藏 URL、分包、缓存、schema 版本、checksum、懒加载、错误归一化和重复请求合并。调用方不拼接 JSON 路径。

这是一个真实 Seam，因为存在两个 Adapter：

- `StaticTraceRepository`：生产环境读取静态 web bundle。
- `MemoryTraceRepository`：测试使用内存 fixture，覆盖损坏、缺失和旧 schema。

该 Module 的 Depth 来自“一个 `open`”隐藏整个发布数据布局，为视图提供 Leverage，并把缓存与错误处理集中到一处形成 Locality。

### 4.2 PlaybackEngine Module

Interface：

```ts
export interface PlaybackEngine {
  snapshot(): PlaybackSnapshot;
  dispatch(command: PlaybackCommand): void;
  subscribe(listener: (snapshot: PlaybackSnapshot) => void): () => void;
}
```

Implementation 隐藏：

- play/pause、速度、seek、语义单步和连续播放；
- `viewChapter`（正在浏览的页面）与 `chapter/progress`（推理游标）的正交状态；
- `progressByChapter` 中各场景真实执行进度，页面跳转不能反向补完；
- 从头、从当前页面、从当前步骤三种显式 `START` 策略；
- wheel、touch、滚动条与自动镜头的优先级解决；
- 离散事件到连续 `0..1` progress 的插值；
- `overview -> expanding -> detail -> collapsing`；
- reduced motion；
- Decode 循环与完成态；
- 离开详情后恢复同一播放位置。

时钟是内部 Seam：

- `BrowserAnimationClock` 使用 `requestAnimationFrame`。
- `ManualAnimationClock` 由测试精确推进。

视图只能发送语义命令，不能自行修改时间或创建 GSAP 全局时间线。

### 4.3 SceneProjector Module

Interface：

```ts
export interface SceneProjector {
  project(input: {
    trace: TraceSnapshot;
    playback: PlaybackSnapshot;
    locale: Locale;
    viewport: ViewportClass;
  }): SceneModel;
}
```

这是纯 in-process Module，不制造 Adapter。Implementation 负责：

- 从事件选择当前节点、路径、矩阵切片和解释；
- 将 fidelity 映射为线型、标签和辅助说明；
- 在 overview、focus scene、双 rank 和摘要布局之间投影；
- 生成语言无关的稳定 element ID。

`SceneModel` 是渲染 Module 的唯一输入，也是 Interface 测试的主要断言对象。

### 4.4 LocaleCatalog Module

Interface：

```ts
export interface LocaleCatalog {
  translate(key: MessageKey, params?: MessageParams): string;
}
```

两个 Adapter 是 `EnglishCatalog` 和 `ChineseCatalog`。trace 只保存 `stageId`、`fidelity`、shape 和数值，不保存界面句子。

### 4.5 不创建统一 Renderer Seam

DOM、SVG 和 Canvas 承担不同职责，并不是可互换 Adapter。为它们强行建立 `Renderer` Interface 只会增加浅层转发。各视图直接消费 `SceneModel`，共享色阶、格式化与交互原语。

## 5. 页面与播放状态

### 5.1 长页面章节

    opening
      -> initialization
      -> tokenization
      -> prefill overview
      -> attention focus
      -> moe + w8a8
      -> tensor parallelism
      -> logits + decode
      -> evidence

章节高度由实际内容决定，主画布随文档自然移动，不再用 sticky 跑道制造停留。手动滚动只改变 `viewChapter` 并关闭自动镜头跟随，不修改或暂停推理游标；连续播放和正文动画保持运行。再次显式开始时镜头恢复跟随推理游标。各场景进度仍由同一个 `PlaybackEngine` 维护，组件不能拥有自己的全局时间线。

### 5.2 正交状态

```text
transport: loading | ready | playing | paused | completed | error
view:      overview | init | tokenization | prefill | attention | moe | tp | decode
cursor:    overview | init | tokenization | prefill | attention | moe | tp | decode
origin:    beginning | page | step
run:       continuous | single
focus:     overview | expanding | detail | collapsing
mode:      story | explore
locale:    en | zh-CN
motion:    full | reduced
```

`single` 不是固定毫秒 seek，而是推进当前场景的一个语义阶段；例如 Attention 为六阶段、TP 为七阶段、Decode 为五阶段。详见 ADR-0006。

### 5.3 连续性的真实含义

- 真实数据点是离散的，不声称连续采集了内核每个微步骤。
- 位置、大小、透明度、路径颜色和矩阵出现顺序可以连续插值。
- 真实耗时以时间标尺显示；动画时长是教学节奏，两者不能混写。
- DERIVED attention 从真实 Q/K/V 计算并经融合输出验证。
- SCHEMATIC 只解释无法直接观测的概念关系。

## 6. 渲染分界

### DOM

- 顶栏、语言切换、播放控制、叙事文字、证据 drawer。
- 可访问性、键盘焦点和语义按钮。

### 当前未引入 SVG/Canvas

当前发布数据只需要 5×5 Attention、40 层带、256 专家点阵、有界 sample 和两条 TP lane。语义 DOM/CSS 已满足性能与可访问性要求，因此没有为了匹配早期技术设想而引入 D3、GSAP 或 Canvas。若未来单场景超过约 400–1,500 个需要高频更新的单元，再以真实性、可访问性和性能数据决定 SVG/Canvas seam。

原始矩阵很大时仍只展示 shape、统计、固定切片或聚合。完整 vocab 和完整权重永不映射为 DOM 节点。

## 7. 性能预算

- 当前 P6 静态构建约 4.6 MB，其中完整发布 trace 约 4.0 MB；页面主 JS 约 149 KB、gzip 约 45 KB。
- 当前实现启动时并行读取构建体验所需的 init/prefill/decode、validation、attention、MoE 和 TP 文件；尚未实现章节级懒加载，不得在报告中声称已经 lazy-load。
- P7 生产优化可把 Overview/manifest 与深层 artifact 拆成按章节预取；是否实施以真实网络瀑布和目标部署环境为准。
- 发布数据总量继续以当前约 4 MB 为基准，不无理由增加十倍。
- 常规动画目标 60 fps；密集章节不得长期低于 30 fps。
- 每帧 JS 主线程工作目标小于 12 ms；避免每帧触发布局测量。
- 动画优先修改 transform、opacity、SVG attributes 和 Canvas buffer。
- 同时只激活当前章节及相邻预加载章节。
- `prefers-reduced-motion` 下取消长路径 tween，保留可理解的分步状态。

## 8. 中英文与持久化

- 默认 `en`。
- 顶栏 `EN / 中文` 切换只更新 `locale`，不重置 transport、chapter、focus 或 progress。
- `?lang=en` / `?lang=zh-CN` 优先于本地保存值。
- 所有 MessageKey 在两种语言中必须完整存在。
- English 和 Chinese 分别做视觉回归；长字符串不得依赖硬编码宽度。

## 9. 视图 Module

```text
AppShell
  TraceRepository
  PlaybackEngine
  SceneProjector
  LocaleCatalog
  OverviewScene
  InitializationScene
  TokenizationScene
  LayerOverviewScene
  LinearAttentionScene
  AttentionFocusScene
  MoeQuantizationScene
  TensorParallelScene
  LogitsDecodeScene
  EvidenceDrawer
```

视图 Module 接收 `SceneModel` 并发出 `PlaybackCommand`。它们不读取文件、不推断 fidelity、不拥有全局时钟。

## 10. Interface 测试

- `TraceRepository`：成功加载、缺失章节、checksum 错误、旧 schema、缓存复用。
- `PlaybackEngine`：命令序列、scroll/play 冲突、seek、focus 展开/收起、Decode 完成、reduced motion。
- `SceneProjector`：同一 snapshot 在 en/zh、overview/detail、宽屏/摘要布局下的稳定输出。
- `LocaleCatalog`：两种语言 key 集合完全一致。
- 端到端：从 initialization 播放到最终文本；点击 Attention 展开后连续显示 QK、mask、softmax；切换语言不丢进度。

Interface 是测试表面。测试不读取 GSAP 内部 timeline，也不依赖 Svelte 私有状态。

## 11. P6 目录建议

```text
web/
  src/
    lib/
      trace/
      playback/
      projection/
      i18n/
      render/
      scenes/
    routes/
  static/
    traces/
  tests/
```

## 12. 已冻结决策

| 决策 | 选择 |
|---|---|
| 运行模式 | 预录真实轨迹 + 静态回放 |
| 动画 | 离散事件驱动的连续插值，不使用图片轮播 |
| 页面 | 纵向 scrollytelling + 全宽自然文档流；固定播放顶栏 |
| 详情 | 点击节点在同一画布连续展开/收起 |
| 视觉融合 | 全局长卷 + 矩阵剧场 + TP 双轨章节 |
| 默认语言 | English，完整支持中文切换 |
| 前端 | Svelte 5 / SvelteKit static / TypeScript |
| 渲染 | 当前实现为语义 DOM/CSS；`requestAnimationFrame` 驱动共享时间线 |
| 数据 | `qwen35-a3b-w8a8-20260710-p4r4` |
| 实时 NPU | 第一版排除 |

## 13. 明确拒绝

- 浏览器加载或推理 35B 模型。
- 网站运行时直连 SSH。
- 把每个步骤制作成静态截图后轮播。
- 在一个 1440×1024 画面同时堆满全局流程、双 rank、完整矩阵和所有说明。
- 为完整 vocab/权重创建 DOM 网格。
- 为只有一个 Implementation 的功能制造假 Seam。
- 将教学动画时长冒充真实算子耗时。
