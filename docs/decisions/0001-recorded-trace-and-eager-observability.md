# ADR-0001：预录轨迹与 eager 可观察模式

## 状态

已接受，2026-07-10。

## 背景

网站不需要现场计算，但需要同时解释优化后的 vLLM Ascend 初始化流程和模型层内真实 tensor。ACL Graph replay 不会稳定触发普通 Python module hook；强行在 graph capture 内同步 tensor 也可能改变时序或导致捕获失败。

## 决策

采用两条真实证据轨：

1. 无插桩 baseline：保留生产参数、权重加载、KV Cache、graph capture、耗时和通过结果。
2. eager 深层 trace：同一模型、prompt、TP 和采样参数，使用 `enforce_eager=True`，采集 embedding、Q/K/V、linear attention、MoE 和 logits。

前端通过 run provenance 区分两条证据，不把它们的耗时或内部执行方式混合。

## 后果

- 可以稳定采集层内 tensor，而不修改生产源码。
- eager trace 的数值是真实运行数据，但耗时不能代表 graph 模式性能。
- baseline 的 graph capture 是真实优化路径，但不提供层内 hook 数值。
- 融合算子的 Python 可见输入输出边界可以采集真实值；未返回的内核内部临时值必须标记为 STRUCTURAL/SCHEMATIC，不得伪造 EXACT。
- 真实输入经过确定性公式重建且通过真实输出校验的产物标记为 DERIVED，不声称是内核内部 dump。
