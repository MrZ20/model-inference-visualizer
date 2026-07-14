# 模型推理可视化

这是一个面向学习与源码理解的交互式网页项目。它将基于一次真实的
Qwen3.5-35B-A3B W8A8 / vLLM Ascend 推理轨迹，动态展示：

1. 推理前模型配置、进程、权重、量化、KV Cache 与执行图如何初始化；
2. prompt 如何变成 token、张量、隐藏状态、logits 和最终输出；
3. TP、混合注意力、MoE、W8A8 与 prefill/decode 在真实运行中如何协作。

项目不在浏览器中运行 35B 模型，也不要求网站现场计算。网页播放经过校验、裁剪和脱敏的真实轨迹数据；教学示意与真实数据会明确标注。

## 当前状态

当前 **P6 的视觉纠偏、readiness 与原始要求完成性审计已经实现，并通过自动化、真实浏览器和设计对照，等待用户产品/视觉验收**。首屏全局流、初始化链、Linear/Full Attention、MoE/TP 连续展开、Decode 决策状态、固定播放控件和完整双语均已按选定稿重建；用户接受前仍不得进入 P7 正式交付。

最新 `p4r4` web 数据约 4 MB，包含精确输出、TP rank、W8A8 per-token scale、完整 MoE 路径、关键 tensor、16-head DERIVED attention 和融合输出校验。前端实现约 7900 px 的全宽长页面、正文与镜头同步的连续播放器、独立的 Viewing/Inference Cursor、3 种开始起点 × 单步/连续、运行中自由滚动且推理不停、所有章节自然连续滚动、Linear/Full Attention、MoE/TP 视口内逐步动态图、统一浅色风格的五次 Decode、English 默认与中英文切换、可访问的证据对话框和张量检查器；390px 下提供摘要式布局。当前验证为 7 个测试文件、45 个测试、0 条 Svelte 诊断和成功的 4.6 MB 静态构建。

## 本地运行

```bash
cd web
npm install
npm run dev
```

`predev` 会自动把受控的 `p4r4` web bundle 同步到静态目录。生产验证使用 `npm run check && npm test && npm run build`。

## 文档入口

- [项目连续性档案](docs/project-context/README.md)：压缩后的强制恢复入口，包含用户原话时间线、总方案、视觉交互契约、当前状态和恢复协议。
- [项目方案](docs/PROJECT_PLAN.md)：目标、范围、交互、采集计划、阶段门与验收标准。
- [架构冻结](docs/ARCHITECTURE.md)：Deep Module、Interface、连续播放器、渲染分界和性能预算。
- [交互与视觉规范](docs/INTERACTION_DESIGN.md)：长页面、全宽画布、点击展开、双语和融合视觉方向。
- [项目 Memory](MEMORY.md)：快速摘要；不能替代完整项目连续性档案。
- [任务清单](TASKS.md)：按依赖排序的可执行任务与阶段验收门。
- [P6 设计验收](design-qa.md)：目标视觉对照、浏览器交互、控制台和构建结果。
- [P6 交互回归报告](docs/reports/2026-07-12-p6-interaction-regression.md)：问题复现、红绿测试、根因和最终机器断言。
- [P6 动态播放回归报告](docs/reports/2026-07-13-p6-dynamic-playback-regression.md)：为什么原页面只有进度条在动，以及正文动画、自动镜头和真实点击验收的修复证据。
- [P6.5 页面/游标回归报告](docs/reports/2026-07-13-p6.5-playback-navigation-regression.md)：页面切换不补完、3×2 播放策略与滚动接管的红绿证据。
- [P6.8 短章节滚动报告](docs/reports/2026-07-13-p6.8-short-chapter-scroll-regression.md)：Initialize/Tokenize 取消可见 sticky 停滞的红绿与浏览器证据。
- [P6.9 全章节滚动报告](docs/reports/2026-07-13-p6.9-all-chapter-scroll-regression.md)：自然文档流推广到所有章节的红绿与浏览器证据。
- [P6 视觉重新对齐审计](docs/audits/2026-07-13-p6-visual-realignment/AUDIT.md)：真实浏览器截图、与选定视觉稿的结构差异、可访问性风险和三个实现切片。
- [P6 重建验收](docs/audits/2026-07-13-p6-rebuild/AUDIT.md)：三个切片后的真实交互数值、同屏视觉对照、浏览器截图和剩余边界。
- [验收前 readiness 审计](docs/audits/2026-07-13-p7-readiness/AUDIT.md)：390px、键盘、Evidence dialog、本地化和 URL locale 的证据。
- [原始要求完成性审计](docs/audits/2026-07-13-p8-completion/AUDIT.md)：逐项证明原始要求，并记录 Linear Attention 代表层纠偏。
- [P1 环境核查报告](docs/reports/2026-07-10-p1-environment-audit.md)：远端容器、版本、NPU、模型缓存和磁盘结论。
- [P1 baseline 报告](docs/reports/2026-07-10-p1-baseline.md)：测试结果、耗时、警告和运行后状态。
- [P2–P4 采集报告](docs/reports/2026-07-10-p2-p4-trace-collection.md)：采集实现、正式运行、数据内容、校验结果和已知边界。
- [轨迹运行决策](docs/decisions/0001-recorded-trace-and-eager-observability.md)：为什么优化 baseline 与 eager 深层采集分开。
- [长页面播放器决策](docs/decisions/0004-long-form-interactive-player.md)：为什么使用连续插值、点击展开和 English 默认双语界面。
- [页面与推理游标决策](docs/decisions/0006-separate-view-and-inference-cursor.md)：为什么浏览位置与推理步骤必须独立。

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
