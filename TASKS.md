# 任务清单

任务按依赖顺序排列。`Gate` 未通过时，不开始下一阶段的写操作或重型运行。

## P0：方案评审

- [x] 核对 `MrZ20_1` 与既有教程位置。
- [x] 检查 Transformer Explainer 的主要交互与项目定位。
- [x] 提取既有教程中的真实模型、token、shape、MoE、量化和运行时事实。
- [x] 写项目方案、架构草案和 memory。
- [x] 用户确认按默认假设执行。
- [x] 将确认的初始选择记录到 `MEMORY.md`。

**Gate P0**：用户明确同意进入远端环境核查。

## P1：远端环境与基线

- [x] 确认 SSH 路径、容器、工作目录和允许的写入范围。
- [x] 记录 vLLM、vLLM Ascend、PyTorch、torch-npu、CANN、模型配置版本/hash。
- [x] 检查远端工作树，保护用户已有改动。
- [x] 检查模型缓存、权重分片与 NPU 空闲状态。
- [x] 运行并复核无插桩 baseline。
- [x] 更新 `MEMORY.md` 的真实环境事实。

**Gate P1**：已满足——基线可复现，远端安全边界明确；等待用户验收。

## P2：轨迹协议与采集器

- [x] 定义并评审 trace schema v1。
- [x] 定义 initialization/inference 事件词表。
- [x] 实现有界 NDJSON `TraceWriter` 和临时目录集成测试。
- [x] 实现 tensor summary/sample/top-k policy。
- [x] 实现动态 rank、logical step 和 provenance 字段。
- [x] 实现字节数、stage 数量、缺失 stage 和错误限制。
- [x] 在仓库本地虚拟环境运行测试。
- [x] 在远端正式路径验证 hook 与进程清理。

**Gate P2**：采集器不会无限输出，schema 校验通过，开销可接受。

## P3：正式推理采集

- [x] 固定 prompt、sampling 参数和随机性设置。
- [x] 运行无深度采集的 baseline。
- [x] 运行初始化 + prefill + 生成 5 tokens 的正式采集。
- [x] 收集 rank 0/1 事件、小切片、统计和 manifest。
- [x] 记录命令、退出码、耗时、NPU 和精确输出。
- [x] 对比 baseline，记录 eager 可观察模式与图执行模式的差异。
- [x] 备份 raw bundle 到受控本地目录。

**Gate P3**：输出正确，关键采集点齐全，原始证据可复查。

## P4：数据清洗与投影

- [x] 通过 rank、单调时间和 logical step 归属多进程事件。
- [x] 自动校验 token、shape、MoE top-k、logits/greedy 和 TP rank 不变量。
- [x] 脱敏主机、路径和 IP，并执行发布数据扫描。
- [x] 生成 EXACT/SUMMARY/STRUCTURAL 标记；SCHEMATIC 留给前端教学层。
- [x] 生成 curated bundle 和 validation report。
- [x] 生成 init/warmup/prefill/decode 分章节 web bundle。
- [x] 测量 raw、curated 和 web bundle 体积。

**Gate P4**：网页所需节点都有受控数据，发布包无敏感项。

## P5：架构与视觉冻结

- [ ] 根据真实数据更新 `docs/ARCHITECTURE.md`。
- [ ] 冻结 PlaybackEngine、TraceRepository 和 view model 接口。
- [ ] 确定 SVG/Canvas 分界与性能预算。
- [ ] 产出三个视觉方向。
- [ ] 用户选择一个视觉方向。
- [ ] 确认桌面首屏、初始化、模型层放大、MoE/W8A8、decode 状态。
- [ ] 写正式 ADR 并更新 memory。

**Gate P5**：技术接口与视觉目标都已确认，可开始 scaffold。

## P6：网站 MVP

- [ ] 创建前端工程、lint、test 和本地开发脚本。
- [ ] 实现 manifest/chapter/artifact 加载。
- [ ] 实现播放状态机与时间线。
- [ ] 实现初始化主视图。
- [ ] 实现 tokenization/scheduler/embedding 视图。
- [ ] 实现 40 层总览。
- [ ] 实现 full attention 代表层。
- [ ] 实现 linear attention 代表层。
- [ ] 实现 MoE/W8A8 视图。
- [ ] 实现 logits/sampling/decode 视图。
- [ ] 实现 tensor inspector、证据面板和术语表。
- [ ] 实现错误态、加载态、reduced motion 和键盘控制。

**Gate P6**：可从初始化播放到最终文本，关键交互均可用。

## P7：QA 与交付

- [ ] 数据事实复核。
- [ ] 视觉对照与布局检查。
- [ ] 性能与资源体积检查。
- [ ] 可访问性检查。
- [ ] 关键浏览器检查。
- [ ] 许可与脱敏终检。
- [ ] 完善 README、运行文档和数据生成说明。
- [ ] 决定并执行本地交付或静态部署。

**Gate P7**：用户验收完成，memory 记录最终范围、已知限制和后续 backlog。
