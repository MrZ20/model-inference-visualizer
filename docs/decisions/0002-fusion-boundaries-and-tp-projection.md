# ADR-0002：融合边界采集与 TP 并行投影

## 状态

已接受，2026-07-10。

## 背景

初次深层 trace 已覆盖 Q/K/V、MoE router 和专家输入输出，但没有接入 W8A8 融合路径的动态 scale，也不足以直观展示两个 TP rank 的局部矩阵和并行时间线。

## 决策

1. 不修改远端 vLLM/vLLM Ascend 源码，通过外部 monkey patch 包裹现有 Python 接口。
2. 仅在 layer 3 MoE 的真实 prefill/decode 作用域采集 dispatch、GMM1+SwiGLU 和 GMM2 边界。
3. 小型路由、scale 和专家计数完整保存；大激活只保存 shape/dtype、全量统计和有界前缀。
4. 每个 TP rank 分别记录模块本地参数形状和 start/end span。
5. 编译阶段生成 `parallel-summary.json` 与 `moe-quantization.json`，避免前端重复解析底层事件。
6. EP=false 时，即使底层 MoE 通信 group 的 world size 为 2，也必须解释为复用 TP group，不呈现为独立 EP2。

## 后果

- W8A8 per-token scale 可以作为真实数据展示。
- 前端可以画出两个 rank 的矩阵分片、并行轨道和局部量化差异。
- trace duration 含 eager 和采集同步开销，只用于事件播放，不用于性能结论。
- 融合 attention 未返回的概率矩阵和 CANN 内核临时 workspace 仍只能教学示意。
