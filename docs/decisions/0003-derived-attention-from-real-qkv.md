# ADR-0003：由真实 Q/K/V 重建 Attention

## 状态

已接受，2026-07-10。

## 背景

Ascend fused attention 返回最终输出，但不返回内核内部 softmax 概率矩阵。完全不展示热力图会削弱教学效果；把示意矩阵冒充真实结果则违反项目真实性要求。

## 决策

1. 只完整采集 layer 3 的一次 prefill Q/K/V 和融合 attention 输出。
2. 使用运行时 head 数、KV head 数、head size、scale、TND layout、GQA 映射和 causal mask 离线重建。
3. 用 `softmax @ V` 与融合输出的余弦相似度验证公式和布局；低于 0.99 时拒绝发布。
4. 新增 `DERIVED` fidelity，用于真实输入经过确定性公式得到的产物。
5. 前端默认展示 16 heads 平均矩阵，同时允许切换 TP rank 和具体 head。
6. UI 明确说明它不是内核内部 dump。

## 后果

- attention 教学可以使用真实运行驱动的热力图，而非任意示意数据。
- 数据量保持很小，不需要修改 CANN 内核或关闭融合。
- BF16 与融合归约顺序会造成小误差，但不会改变因果 mask 和概率解释。
- 内核 workspace 与原生 softmax buffer 仍不属于可观测数据。
