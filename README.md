# 模型推理可视化

这是一个面向学习与源码理解的交互式网页项目。它将基于一次真实的
Qwen3.5-35B-A3B W8A8 / vLLM Ascend 推理轨迹，动态展示：

1. 推理前模型配置、进程、权重、量化、KV Cache 与执行图如何初始化；
2. prompt 如何变成 token、张量、隐藏状态、logits 和最终输出；
3. TP、混合注意力、MoE、W8A8 与 prefill/decode 在真实运行中如何协作。

项目不在浏览器中运行 35B 模型，也不要求网站现场计算。网页播放经过校验、裁剪和脱敏的真实轨迹数据；教学示意与真实数据会明确标注。

## 当前状态

当前已完成 **P6 网站 MVP**，等待用户验收后进入 P7 交付终检。

最新 `p4r4` web 数据约 4 MB，包含精确输出、TP rank、W8A8 per-token scale、完整 MoE 路径、关键 tensor、16-head DERIVED attention 和融合输出校验。前端已经实现全宽长页面、共享连续播放器、Attention/MoE/TP 点击展开、English 默认与中英文切换、证据抽屉和张量检查器。

## 本地运行

```bash
cd web
npm install
npm run dev
```

`predev` 会自动把受控的 `p4r4` web bundle 同步到静态目录。生产验证使用 `npm run check && npm test && npm run build`。

## 文档入口

- [项目方案](docs/PROJECT_PLAN.md)：目标、范围、交互、采集计划、阶段门与验收标准。
- [架构冻结](docs/ARCHITECTURE.md)：Deep Module、Interface、连续播放器、渲染分界和性能预算。
- [交互与视觉规范](docs/INTERACTION_DESIGN.md)：长页面、全宽画布、点击展开、双语和融合视觉方向。
- [项目 Memory](MEMORY.md)：当前共识、固定事实、决策、假设、开放问题与偏离记录。
- [任务清单](TASKS.md)：按依赖排序的可执行任务与阶段验收门。
- [P6 设计验收](design-qa.md)：目标视觉对照、浏览器交互、控制台和构建结果。
- [P1 环境核查报告](docs/reports/2026-07-10-p1-environment-audit.md)：远端容器、版本、NPU、模型缓存和磁盘结论。
- [P1 baseline 报告](docs/reports/2026-07-10-p1-baseline.md)：测试结果、耗时、警告和运行后状态。
- [P2–P4 采集报告](docs/reports/2026-07-10-p2-p4-trace-collection.md)：采集实现、正式运行、数据内容、校验结果和已知边界。
- [轨迹运行决策](docs/decisions/0001-recorded-trace-and-eager-observability.md)：为什么优化 baseline 与 eager 深层采集分开。
- [长页面播放器决策](docs/decisions/0004-long-form-interactive-player.md)：为什么使用连续插值、点击展开和 English 默认双语界面。

## 已生成数据

- 原始私有数据：`data/raw/qwen35-a3b-w8a8-20260710-p4r4`（Git 忽略）。
- 校验数据：`data/curated/qwen35-a3b-w8a8-20260710-p4r4`。
- 网页数据：`data/web/qwen35-a3b-w8a8-20260710-p4r4`。
- Attention 投影：`data/web/qwen35-a3b-w8a8-20260710-p4r4/attention-derived.json`。
- TP 投影：`data/web/qwen35-a3b-w8a8-20260710-p4r4/parallel-summary.json`。
- W8A8/MoE 投影：`data/web/qwen35-a3b-w8a8-20260710-p4r4/moe-quantization.json`。

## 参考与已有资产

- 交互参考：[Transformer Explainer](https://poloclub.github.io/transformer-explainer/)
- 参考源码：[poloclub/transformer-explainer](https://github.com/poloclub/transformer-explainer)
- 既有教程：`/Users/user/work/MrZ20_1/vllm-ascend/qwen3_5_35b_a3b`

## 工作原则

- 真实证据优先，所有关键动画可追溯到轨迹事件或源码位置。
- 数据协议先于前端，避免网页直接依赖 vLLM 内部 Python 对象。
- 原始数据、发布数据分离；不提交模型权重、密钥、远端主机信息或大体积原始张量。
- 每个阶段都需要验收，未通过阶段门不进入下一阶段。
- 任何范围、事实或架构变化都更新 `MEMORY.md`，防止长期任务偏离。
