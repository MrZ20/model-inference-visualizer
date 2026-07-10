# 架构草案

> 状态：概念架构，等待真实数据验证后冻结
> 核心原则：网页只依赖稳定的轨迹接口，不依赖 vLLM 内部 Python 对象

## 0. P2–P4 实现状态

第一份可用轨迹已经生成：

- Run ID：`qwen35-a3b-w8a8-20260710-p3r2`。
- 采集模式：`enforce_eager=True`，用于层内真实 tensor hook。
- 优化路径证据：无插桩 baseline，包含权重加载、KV Cache、图捕获与优化运行。
- web bundle：454 个事件，拆分为 init/warmup/prefill/decode。
- 必需 stage 缺失 0，schema/内容错误 0。
- rank 0/1 各 129 个可归属事件。

架构因此冻结为“双证据轨”：

1. baseline 说明真实部署初始化和 graph 路径；
2. eager trace 说明同一模型、prompt 和采样参数下的层内数据。

网页不得把 eager 耗时当作 graph 模式性能，也不得把融合内核没有暴露的
W8A8 per-token scale 或完整 attention 概率标成 EXACT。

## 1. 架构目标

该架构要同时满足：

- 采集过程可以深入 vLLM/vLLM Ascend，但采集代码与网页解耦。
- 网站离线运行，数据可复现、可测试、可发布。
- 第一版专注 Qwen3.5，但轨迹格式不把模型名写死在核心字段中。
- 原始大数据和发布小数据分离。
- 所有动画都能追溯到事件、配置、统计或明确的教学示意。

## 2. 系统数据流

```text
┌──────────────────────────────┐
│ Remote Inference Environment │
│ vLLM + vLLM Ascend + NPU     │
└──────────────┬───────────────┘
               │ TraceWriter interface
               ▼
┌──────────────────────────────┐
│ Raw Trace Bundle             │
│ events / logs / small arrays │
└──────────────┬───────────────┘
               │ validate + sanitize + project
               ▼
┌──────────────────────────────┐
│ Curated Trace Model          │
│ normalized semantic events   │
└──────────────┬───────────────┘
               │ build web bundle
               ▼
┌──────────────────────────────┐
│ Static Web Player            │
│ timeline / views / evidence  │
└──────────────────────────────┘
```

## 3. 关键 seam 与深模块

### 3.1 TraceWriter seam

采集代码只学习一个小接口：

```python
writer.emit(event)
writer.capture_tensor(ref, tensor, policy)
writer.close(run_summary)
```

它隐藏多进程序号、时间戳、裁剪、批量 device-to-host 同步、落盘、失败记录和体积上限。调用点不直接拼 JSON 或操作文件。

第一版预计有两个 adapter：

- `NdjsonTraceWriter`：远端正式采集。
- `InMemoryTraceWriter`：本地测试与小 tensor 验证。

存在两个真实 adapter 后，这个 seam 才有实际价值。

### 3.2 TraceCompiler seam

```python
compile_trace(raw_bundle, policy) -> curated_bundle
```

内部完成 schema 校验、rank 对齐、逻辑 step 合并、脱敏、真实性分级、数据裁剪、源码映射和 web bundle 分片。网页不需要理解 raw trace。

### 3.3 TraceRepository seam

前端只通过下面的概念接口读数据：

```ts
loadManifest(): Promise<TraceManifest>
loadChapter(chapterId: string): Promise<TraceChapter>
loadArtifact(artifactId: string): Promise<TraceArtifact>
```

第一版 adapter 是静态文件；未来若做本地实时模式，可以增加 HTTP/WebSocket adapter，而无需改播放器。

### 3.4 PlaybackEngine seam

```ts
reducePlayback(state, command) -> nextState
selectFrame(trace, state) -> RenderFrame
```

它隐藏自动播放、速度、单步、回退、跳章、深度视图进入/退出和 decode 循环。视图只渲染 `RenderFrame`，不自己推进时间。

## 4. 轨迹数据模型 v1（草案）

### 4.1 Event

```json
{
  "schemaVersion": "1.0",
  "eventId": "rank0-000184",
  "runId": "qwen35-a3b-w8a8-20260709",
  "phase": "inference",
  "stage": "moe.route",
  "logicalStep": { "kind": "prefill", "index": 0 },
  "rank": 0,
  "processRole": "worker",
  "timestampNs": 0,
  "durationNs": 0,
  "source": {
    "repository": "vllm-ascend",
    "commit": "<sha>",
    "symbol": "<python symbol>",
    "file": "<repo-relative path>",
    "line": 0
  },
  "inputs": ["tensor-ref"],
  "outputs": ["tensor-ref"],
  "payload": {},
  "fidelity": "EXACT"
}
```

`timestampNs` 只能保证 rank 内顺序；跨 rank 展示优先使用 `logicalStep` 和显式同步事件，不假设两个进程时钟完全一致。

### 4.2 TensorRef

```json
{
  "id": "prefill.layer3.q",
  "name": "query",
  "shape": [5, 16, 256],
  "executionShape": [8, 16, 256],
  "dtype": "bfloat16",
  "device": "npu:0",
  "rank": 0,
  "numBytes": 0,
  "summary": {
    "min": 0,
    "max": 0,
    "mean": 0,
    "std": 0,
    "histogram": []
  },
  "sample": {
    "strategy": "fixed-window",
    "indices": [],
    "values": []
  },
  "fidelity": "SUMMARY"
}
```

`shape` 表示语义上的真实 token；`executionShape` 表示 padding/graph 后的执行形状，避免把 5 和 8 混为一谈。

### 4.3 Manifest

Manifest 至少包含：

- 模型 ID、配置摘要与 hash。
- vLLM/vLLM Ascend commit。
- PyTorch/torch-npu/CANN 版本。
- 并行配置、设备匿名拓扑。
- prompt、sampling 参数、输出。
- 章节列表、artifact 索引、总大小、checksum。
- 缺失采集点与已知偏差。
- 脱敏版本与生成工具版本。

## 5. 轨迹包布局

```text
data/
  raw/                         # git ignored
    <run-id>/
      manifest.json
      events-rank0.ndjson
      events-rank1.ndjson
      arrays/
      logs/
  curated/
    <run-id>/
      manifest.json
      events.ndjson
      artifacts/
      validation-report.json
  web/
    <run-id>/
      manifest.json
      chapters/
        init.json
        prefill.json
        decode-1.json
      artifacts/
```

Raw/private 默认不进入 Git；curated 是否提交取决于体积和许可；web fixtures 可提交少量测试样本。

## 6. 前端模块

```text
app-shell
  ├─ trace-repository
  ├─ playback-engine
  ├─ stage-router
  ├─ views
  │   ├─ initialization
  │   ├─ tokenization
  │   ├─ scheduler
  │   ├─ model-overview
  │   ├─ full-attention
  │   ├─ linear-attention
  │   ├─ moe-w8a8
  │   └─ logits-sampling
  ├─ tensor-inspector
  ├─ evidence-panel
  └─ glossary
```

视图模块不直接读取网络，也不修改全局时间。它们接收 `RenderFrame` 并发出语义命令，例如 `OPEN_ARTIFACT`、`NEXT_STEP`、`EXIT_DETAIL`。

## 7. 播放状态机

顶层状态：

```text
loading -> ready -> playing -> paused -> completed
             └──────────────-> error
```

正交状态：

- `mode`: story / explore
- `chapter`: init / prefill / decode-1..5 / final
- `detail`: overview / selected artifact
- `speed`: 0.5x / 1x / 2x

所有状态转换由纯 reducer 管理，确保测试可以给定命令序列并断言最终 frame。

## 8. 数据与渲染分界

- 小于约几千单元且需要标签的图使用 SVG。
- 密集 heatmap 使用 Canvas，数据先转成像素 buffer。
- 不为完整 vocab 或完整权重创建 DOM 节点。
- 40 层总览使用聚合条带；只有代表层加载深层 artifact。
- 所有动画基于语义 frame，不直接重放远端毫秒级调用；真实耗时以标尺/标签展示。

具体阈值在 P4 获取真实发布包后通过性能原型确定。

## 9. 可测试性

### 9.1 采集端

- schema 单元测试。
- tensor summarizer 的 CPU/NPU 小 tensor 对照。
- 体积限制、异常和缺失字段测试。
- rank 内序号与 logical step 合并测试。

### 9.2 编译端

- 脱敏规则测试。
- shape/token/MoE/logits 不变量测试。
- deterministic bundle checksum。
- raw fixture 到 web fixture 的快照测试。

### 9.3 前端

- PlaybackEngine reducer 单元测试。
- TraceRepository 缺失/损坏/版本不兼容测试。
- 关键章节模块测试。
- 端到端：从 ready 播放到 final、回退、跳章、打开详情。
- 视觉与可访问性检查。

## 10. 建议仓库结构

```text
model-inference-visualizer/
  README.md
  MEMORY.md
  TASKS.md
  docs/
    PROJECT_PLAN.md
    ARCHITECTURE.md
    decisions/
  collector/
    pyproject.toml
    src/
    tests/
  compiler/
    src/
    tests/
  web/
    src/
    public/
    tests/
  schemas/
  data/
    raw/
    curated/
    web/
  scripts/
```

是否采用单个 Python package 或拆分 collector/compiler，在 P2 根据远端部署方式决定；不要在没有第二种部署需求前制造额外 seam。

## 11. 初始架构决策

| 决策 | 当前选择 | 状态 |
|---|---|---|
| 运行模式 | 预录真实轨迹 + 静态回放 | 建议确认 |
| 前后端契约 | versioned trace schema | 建议确认 |
| 数据分层 | raw / curated / web | 建议确认 |
| 前端播放器 | 确定性状态机 | 建议确认 |
| 深层矩阵 | 代表层 + 固定抽样 | 建议确认 |
| 实时 SSH/NPU | 第一版排除 | 建议确认 |
| 模型泛化 | 协议可扩展，UI 先做 Qwen3.5 | 建议确认 |

确认后将这些决策分别写入 `docs/decisions/`，并记录取舍与后果。

## 12. 被拒绝的初始方案

### 浏览器直接加载/推理 35B 模型

不可行且不符合“不需要现场计算”的目标；下载、内存、NPU 能力和浏览器安全都不合适。

### 网站运行时直连 SSH

会引入凭据、安全、排队、超时和可复现性问题，不适合作为教学网站的默认能力。

### 保存并展示所有中间 tensor

数据规模巨大，也可能带来模型许可和泄露风险。教学价值主要来自形状、摘要、固定切片与代表步骤。

### 先搭完整前端再决定采集格式

会把演示数据结构偶然固化成架构。先建立小而稳定的轨迹接口，前端才能长期维护。
