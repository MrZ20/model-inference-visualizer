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
- [x] 生成 EXACT/SUMMARY/DERIVED/STRUCTURAL 标记；SCHEMATIC 留给前端教学层。
- [x] 生成 curated bundle 和 validation report。
- [x] 生成 init/warmup/prefill/decode 分章节 web bundle。
- [x] 测量 raw、curated 和 web bundle 体积。

**Gate P4**：网页所需节点都有受控数据，发布包无敏感项。

### P4.1：融合边界与 TP2 补采

- [x] 采集 layer 3 MoE 完整 top-k、专家 Token count 和 W8A8 per-token scale。
- [x] 采集 dispatch、GMM1+SwiGLU、GMM2 的量化输入输出。
- [x] 采集 rank 0/1 的模块分片和并行 start/end span。
- [x] 严格校验两 rank、prefill/decode、完整 scale 和配对 span。
- [x] 生成 `parallel-summary.json` 和 `moe-quantization.json`。
- [x] 记录 TP group 与 EP=false 的解释边界。

**Gate P4.1**：已满足——量化与并行补采完整，等待用户验收后进入 P5。

### P4.2：离线 Attention 重建

- [x] 完整采集 layer 3 prefill 的 Q/K/V 和融合 attention 输出。
- [x] 按 TP、TND、GQA、scale 和 causal mask 离线计算 scores/softmax。
- [x] 生成 16 heads 明细与平均 5×5 attention 热力图。
- [x] 使用 `softmax @ V` 对比融合输出并设置相似度门槛。
- [x] 新增 `DERIVED` fidelity、投影和校验报告。
- [x] 完成数据脱敏、体积和远端清理检查。

**Gate P4.2**：已满足——attention 热力图流程经过真实融合输出验证，等待用户验收后进入 P5。


## P5：架构与视觉冻结

- [x] 根据真实数据更新 `docs/ARCHITECTURE.md`。
- [x] 冻结 PlaybackEngine、TraceRepository、SceneProjector 和 LocaleCatalog Interface。
- [x] 确定 DOM/SVG/Canvas 分界与性能预算。
- [x] 产出三个视觉方向。
- [x] 检查 Transformer Explainer 源码中的连续时间线与 Attention 点击展开。
- [x] 用户确认融合方向：全局长卷 + 矩阵剧场 + TP 双轨章节。
- [x] 确认长页面、全宽画布、初始化、层内放大、MoE/W8A8、TP 和 decode 状态。
- [x] 确认 English 默认与 `EN / 中文` 切换。
- [x] 写正式 ADR、交互规范并更新 memory。
- [x] 用户验收融合后的长页面视觉稿，并授权进入 P6。

**Gate P5**：已满足——技术接口与融合视觉稿均已冻结并验收。

## P6：网站 MVP

- [x] 创建前端工程、lint、test 和本地开发脚本。
- [x] 实现 manifest/chapter/artifact 加载。
- [x] 实现播放状态机与时间线。
- [x] 实现 scroll-driven 章节与节点连续展开/收起。
- [x] 实现 English 默认与 `EN / 中文` 切换，切换时保留播放状态。
- [x] 实现初始化主视图。
- [x] 实现 tokenization/scheduler/embedding 视图。
- [x] 实现 40 层总览。
- [x] 实现 full attention 代表层。
- [x] 实现 linear attention 代表层。
- [x] 实现 MoE/W8A8 视图。
- [x] 实现 logits/sampling/decode 视图。
- [x] 实现 tensor inspector、证据面板和术语表。
- [x] 实现错误态、加载态、reduced motion 和键盘控制。
- [x] 增加 Attention/MoE/TP 页面级点击与展开/收起回归测试。
- [x] 增加 `p4r4` 40 层、线性/全注意力和 Decode 场景模型 UT。
- [x] 用完整 256 专家视图替换 32 个示意节点，并校验真实 top-8。
- [x] 修复开始播放、末尾重播、章节自动镜头与手动滚动接管。
- [x] 让权重加载、token/embedding、QKV、MoE、TP 和 Decode 由共享播放进度驱动。
- [x] 增加正文运动进度断言，并用真实浏览器验证按钮 hit-test 与详情 viewport 相交。

**Gate P6**：**未满足用户最终验收**——上下文恢复、视觉差异审计、三个纠偏 Slice、响应式/a11y 补强、自动化和真实浏览器验证均已完成，但机器证据不能替代用户亲自操作后的产品/视觉接受；不得把当前状态写成最终完成。

### P6.1：上下文与视觉重新对齐

- [x] 建立可审计的用户需求/对话时间线。
- [x] 建立完整总方案和视觉交互实现契约。
- [x] 建立压缩后的强制恢复协议和根级 `AGENTS.md`。
- [x] 将 `MEMORY.md` 降级为快速摘要，修正 P6 验收状态。
- [x] 用户验收上下文档案。
- [x] 对当前页面与选定视觉稿做截图化差异审计。
- [x] 按审计结果修复构图、连续动态和 Focus Scene 体验。
- [x] 通过自动化与真实浏览器验收。
- [ ] 通过用户实际操作验收。

审计证据：`docs/audits/2026-07-13-p6-visual-realignment/AUDIT.md`。

### P6.2：分片实现顺序

- [x] Slice 1：Shell + Global Flow + Playback。
- [x] Slice 2：Initialization + Attention Focus Scene。
- [x] Slice 3：MoE/W8A8 + TP + Decode + bilingual/a11y。

用户已授权三个 Slice 连续实施。本轮已经完成参考图同屏对照、页面级测试和真实浏览器检查；只有最终用户产品/视觉 Gate 仍保持打开。

### P6.3：验收前 readiness 补强

- [x] 390px 使用摘要式布局，Attention/MoE/TP 展开入口保持在章节落点视口内。
- [x] Focus 宽矩阵只在自身 labelled region 横向滚动，不产生全局页面溢出。
- [x] Evidence 使用 modal dialog 语义、打开聚焦 Close、Escape 关闭并恢复触发器焦点。
- [x] 中文 Evidence provenance/fidelity 说明完整本地化。
- [x] 显式 URL locale 优先于保存的语言偏好。
- [x] 增加页面级键盘、dialog、双语与 locale 优先级回归测试。
- [x] 在 1280×720 和 390×844 真实浏览器验证，固化当前轮截图。

补充证据：`docs/audits/2026-07-13-p7-readiness/AUDIT.md`。这一步只修复已有体验的验收缺口，不代表 P7 正式交付已开始。

### P6.4：原始要求完成性审计

- [x] 逐项把原始要求映射到页面、真实数据、测试与浏览器证据。
- [x] 纠正“只有 30/10 类型计数即视为完成 Linear Attention 代表层”的弱证据。
- [x] 使用 p4r4 Layer 0 真实输入/输出的受控样本与统计构建 Gated DeltaNet 六阶段 Focus Scene。
- [x] 将 QKVZBA projection、Causal Conv1D、Gated Delta recurrence、gated norm/out projection 标记为 Structural，把内部状态运动标记为 Schematic。
- [x] 桌面与 390px 均同时展示 Linear/Full Attention 入口，局部宽画布不造成全局溢出。
- [x] 补充页面点击、阶段跳转、focus exclusivity 与引擎 DetailId 回归测试。
- [x] 修复 Attention 默认热力图缺失 `--blue` token 的视觉退化。
- [x] 将 Linear 边界摘要与完整 Captured 值分开标记，并补齐 Evidence 中的 Summary 定义。
- [x] 修复 Focus Scene 关闭动画中快速重新打开会再次被关闭的竞态，并增加页面回归。
- [x] 固化 7 files / 29 tests、4.6 MB 静态构建和真实浏览器截图。

完成性证据：`docs/audits/2026-07-13-p8-completion/AUDIT.md`。工程要求已有逐项直接证据，但用户产品/视觉 Gate 仍保持打开。

### P6.5：播放起点、页面/步骤解耦与滚动控制

- [x] 用页面回归证明切换可视章节不会把旧章节进度补到 100%。
- [x] 将当前可视章节与推理播放游标拆成两个状态。
- [x] 开始入口支持从头开始、从当前页面开始、从当前步骤继续。
- [x] 支持单步与连续两种执行方式。
- [x] wheel/touch/非程序化滚动时自动暂停连续播放。
- [x] 复核用户第 1 点所指的轻微切换异常，不编造被截断的现象；已修复可复现的进度补完与状态/滚动竞争，具体残余现象等待用户补充。
- [x] 通过页面级测试、7 files / 41 tests、完整构建和 1280×720 真实浏览器复验。

**Gate P6.5**：机器与浏览器证据已满足；页面和步骤状态可独立变化，开始策略可预测，滚动接管有效。用户再次验收前仍不关闭 P6 产品 Gate。

### P6.6：播放期间自由滚动

- [x] 先用引擎和页面回归复现：手动浏览会暂停 transport，播放帧会覆盖手动选择的页面。
- [x] 连续播放开始时保持自动镜头跟随。
- [x] wheel、touch、滚动条和章节浏览只接管镜头，不暂停推理游标或正文动画。
- [x] 手动接管后不被后续播放帧拉回；显式开始可重新启用自动跟随。
- [x] 用真实浏览器证明 `scrollY` 变化期间 transport 仍在 playing，scene progress 持续增加。
- [x] 更新 ADR、交互契约、memory 和 P6.6 验收报告。

**Gate P6.6**：机器与真实浏览器证据已满足；用户最新要求已取代 P6.5 的滚动自动暂停决定。P6 总 Gate 仍需用户实际操作验收。

### P6.7：Decode 视觉一致性

- [x] 建立回归，禁止 Decode 整章使用与前文相反的深色主题。
- [x] 统一 Decode 章节、logits、sampling、KV cache 和五步卡片的浅色背景、边框与文字层级。
- [x] 保持精确 token、logits、KV cache、最终文本和播放动画不变。
- [x] 运行完整测试、Svelte 检查和静态构建。
- [x] 用新构建真实浏览器对比 Decode 与前一章节的计算样式。
- [x] 更新上下文、memory 与 P6.7 验收报告。

**Gate P6.7**：机器与真实浏览器证据已满足；Decode 已恢复全站浅色编辑语言。P6 总 Gate 仍需用户实际视觉验收。

### P6.8：Initialize/Tokenize 连续滚动

- [x] 用真实浏览器区分文档滚动、动态内容撑高和 sticky 画面停留。
- [x] 建立短章节布局回归，并在修复前得到 1 failed / 20 passed。
- [x] 仅取消 Initialize/Tokenize 的 `145vh` 高度下限和 sticky 定位。
- [x] 保留 Prefill、Attention、MoE、TP、Decode 的长章节聚焦行为。
- [x] 通过 7 files / 45 tests、Svelte check 和静态构建。
- [x] 用最新 4175 构建证明两章 `scrollDelta 260 / visualDelta -260`，播放不中断且 Viewing 可继续进入 Prefill。
- [x] 更新上下文、memory 与 P6.8 验收报告。

**Gate P6.8**：机器与真实浏览器证据已满足；Initialize/Tokenize 不再产生可见 sticky 停滞。P6 总 Gate 仍需用户实际滚动验收。

### P6.9：全章节连续滚动

- [x] 客观确认剩余章节仍继承公共 `145vh + sticky` 规则。
- [x] 将页面回归提升为所有正文章节的自然文档流契约，并在修复前得到 1 failed / 20 passed。
- [x] 公共章节改为自然高度、公共主画布改为 relative；删除 P6.8 临时例外。
- [x] 保持 Focus 展开、播放、camera takeover、正文动画与真实数据不变。
- [x] 通过 7 files / 45 tests、Svelte check 和静态构建。
- [x] 在最新 4175 构建确认所有章节为 relative，Attention/TP/Decode 均 `scrollDelta 180 / visualDelta -180`。
- [x] 更新 ADR-0008、上下文、memory 与 P6.9 验收报告。

**Gate P6.9**：机器与真实浏览器证据已满足；所有章节均随文档连续移动。P6 总 Gate 仍需用户实际滚动验收。

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
