# 项目 Memory（快速摘要）

> 本文件只提供快速摘要，不能单独恢复完整需求。对话压缩、会话恢复或重大修改前，必须按 `docs/project-context/CONTEXT_MANIFEST.md` 重读完整时间线、总方案、视觉交互契约、当前状态与恢复协议。

## 1. 当前状态

- 日期：2026-07-13
- 当前阶段：P6.9 全章节连续滚动已实现，等待用户实际操作验收
- 当前状态：Shell/Global Flow、Initialization、Linear/Full Attention、MoE/TP/Decode、双语与 a11y 已按选定视觉契约重建；Viewing/Cursor 独立、3 种起点 × 2 种模式、transport/camera-follow 解耦、统一浅色 Decode 和全章节自然滚动已补齐；7 files / 45 tests、4.6 MB 静态构建和真实浏览器复验通过
- 下一阶段门：用户接受当前页面后关闭 P6 产品/视觉 Gate；此前不得进入 P7
- 当前仓库：`/Users/user/work/MrZ20_1/model-inference-visualizer`

## 2. 北极星

构建一个基于真实 Qwen3.5-35B-A3B W8A8 / vLLM Ascend 轨迹的动态教学网页，让读者能从模型初始化一直追到 5 个输出 token，并始终知道每一步的数据来源、形状、设备、源码位置和真实性等级。

## 3. 已确认事实

- 既有教程位于 `/Users/user/work/MrZ20_1/vllm-ascend/qwen3_5_35b_a3b`。
- 既有真实 prompt 为 `Hello, my name is`。
- prompt token IDs 为 `[9419, 11, 821, 803, 369]`。
- 既有输出 token IDs 为 `[498, 7525, 3855, 1089, 321]`。
- 既有输出文本为 `Hello, my name is [Your Name], and`。
- 模型 hidden size=2048、40 层、vocab size=248320。
- 模型有 30 层 linear attention、10 层 full attention。
- MoE 有 256 experts，每个 token 选择 8 个。
- 量化为 W8A8_DYNAMIC，但并非所有模块都使用 int8 路径。
- 既有流程 TP=2、EP=false；prefill 真实 5 token，执行 padding 到 8。
- 参考站点采用可交互文本输入、矩阵块、局部放大、参数控制和教科书式解释面板。
- 参考项目为 `poloclub/transformer-explainer`，MIT License；源码使用 Svelte、D3、GSAP，并在 `AttentionMatrix.svelte` 中通过点击连续展开 QK、Mask 和 Softmax。
- 参考项目的主流程动画由 GSAP timeline 驱动，不是静态图片轮播；页面结构是宽屏可视化首段加下方长文章。
- SSH 目标为 `a3-node1`，实际主机为 `liteserver-for-vllm-ascend-00002`。
- 用户给出的容器名 `zsl_m2m_0612` 不存在；唯一匹配且运行中的容器是 `zsl_m2m_0612_1`。
- 远端 vLLM Ascend 位于 `/vllm-workspace/vllm-ascend`，main 分支干净，commit 为 `81a8928d0b389751104b3c483f223a86afc04dd3`。
- 远端 vLLM 位于 `/vllm-workspace/vllm`，detached HEAD 且干净，commit 为 `1f486d96a17303ce8db8e02be39545b2be338446`。
- Python 为 3.12.13；PyTorch 为 2.10.0+cpu；torch-npu 为 2.10.0；Transformers 为 5.5.4；CANN 目录版本为 9.0.0。
- Python 实际从两个工作区源码加载；package version 字符串与当前 Git SHA 不一致，因此后续 provenance 以 Git SHA 为准。
- 模型缓存存在，共约 38G，包含 10 个 safetensors 分片。
- `config.json` SHA256 为 `5e4d7f74fec2f360eb9cfbfcd6ec0c4c76e684d3a11caaed259d9fd9bfbc7944`。
- `quant_model_description.json` SHA256 为 `614ebab4519e9b3299988950848d9bcc2f131732750ed45c4af4c9306ea42467`。
- NPU 1–7 无运行进程；NPU 0 有其他进程。下一次 baseline 默认使用可见设备 4、5。
- 容器文件系统只剩约 13G，使用率 98%；采集器远端输出应设置约 2G 的硬上限，不允许接近 10G。
- 2026-07-10 baseline 使用 `ASCEND_RT_VISIBLE_DEVICES=4,5` 运行目标 pytest，通过，退出码 0。
- baseline pytest 报告 `1 passed, 17 warnings in 228.21s`；总墙钟 `4m4.558s`。
- 10 个权重分片加载约 35 秒；mixed prefill/decode 图捕获约 4 秒，decode 图捕获约 8 秒。
- baseline 测试不打印生成文本，只通过断言证明输出非空；精确 token/text 留到正式采集时记录。
- baseline 后 NPU 4、5 均无残留进程，两个远端仓库仍干净，磁盘剩余仍约 13G。
- 最终 run ID 为 `qwen35-a3b-w8a8-20260710-p3r2`，使用 eager 可观察模式运行，退出码 0。
- 最终输出 token IDs 为 `[498, 7525, 3855, 1089, 321]`，与五个 rank 0 logits 的 top-1 完全一致。
- 最终文本为 `Hello, my name is [Your Name], and`。
- web bundle 共 454 个事件：init 216、warmup 8、prefill 46、decode 184。
- rank 0 和 rank 1 各有 129 个已归属事件；其余 196 个属于 main/初始化辅助进程。
- 真实 prefill embedding shape 为 `[5, 2048]`。
- layer 3 full attention 的 Q/K/V shape 为 `[5, 2048]`、`[5, 256]`、`[5, 256]`。
- layer 3 MoE router shape 为 `[5, 256]`，每个 prompt token 记录 8 个 top experts。
- 每次采样 logits shape 均为 `[1, 248320]`。
- rank 0 参数清单包含约 17.62B parameter elements，其中约 16.20B 为 int8；TP 两侧存在切分与复制，不能简单相加当作模型精确总参数量。
- 最终 raw 约 376K、curated 约 720K、web 约 720K；SCP 数据约 1.1M，远低于 10G。
- 脱敏扫描未发现远端 hostname、IP、`/root` 或 `/vllm-workspace` 绝对路径。
- P4.1 最终 run ID 为 `qwen35-a3b-w8a8-20260710-p4r3`，退出码 0；采集器内部耗时约 143.24 秒，墙钟约 164.27 秒。
- P4.1 仍生成相同的 5 个 token 和最终文本，logits top-1 再次与输出完全一致。
- P4.1 共 1722 个事件；rank 0/1 各 742 个，main/辅助进程 238 个；raw 约 1.5 MB，远端完整 run 约 4.2 MB。
- layer 3 prefill 的 MoE dispatch 在两个 rank 上均输出 `[40, 2048]` INT8 激活和完整 `[40]` per-token scale；5 token × top-8 experts 对应 40 行。
- dispatch scale 在两个 rank 上相同，范围约 `0.04035–0.06299`；GMM1+SwiGLU 后的 `[40]` scale 已分化，rank 0 约 `0.00078–0.00923`，rank 1 约 `0.00097–0.05730`。
- GMM1+SwiGLU 输出为每 rank `[40, 256]` INT8；GMM2 输出为每 rank `[40, 2048]` BF16。
- QKV projection 的逻辑输出为 9216，每个 rank 的 INT8 权重分片为 `[2048, 4608]`；O projection 每 rank 的本地权重为 `[2048, 2048]`。
- MoE experts 每 rank 的 W1 INT8 分片为 `[256, 2048, 512]`，W2 INT8 分片为 `[256, 256, 2048]`；router 的 `[256, 2048]` BF16 权重在两 rank 复制。
- P4.1 生成 50 个 layer 3 并行 span，覆盖 QKV、融合 attention、O projection、MoE router 和 experts 的 5 个推理步 × 2 ranks。
- 运行配置是 TP=2、EP=false；底层 `get_ep_group()` 的 world size 2 是 MoE 通信复用 TP group，不能解释为独立 EP2。
- `parallel-summary.json` 包含拓扑、模块分片和配对 span；`moe-quantization.json` 包含 10 个 rank × logical-step 的完整量化链。
- P4.1 严格校验确认必需 stage 缺失 0、错误 0、完整 scale 事件齐全，发布数据脱敏扫描通过。
- P4.2 最终 run ID 为 `qwen35-a3b-w8a8-20260710-p4r4`，退出码 0，采集器内部约 145.14 秒、墙钟约 166.03 秒；输出 token/text 与前两次正式 run 一致。
- P4.2 完整采集 layer 3 prefill 的两个 TP rank Q/K/V 和融合 attention 输出；decode 仍保留有界摘要。
- 每个 rank 有 8 个 Q heads、1 个 KV head、head size 256、scale 0.0625，GQA 为 8:1；两 rank 合计 16 Q heads、2 KV heads。
- Q/K 在采集点已经完成 QK RMSNorm 和 RoPE；离线重建使用 TND layout、真实 scale、GQA 映射和 causal mask。
- `softmax @ V` 与融合输出余弦相似度为 rank 0 `0.9999988916`、rank 1 `0.9999988315`；最大绝对误差约 `0.00990`、`0.00798`。
- softmax 最大行和误差不超过 `2.22e-16`，causal mask 区域最大概率为 0。
- 16 heads 平均 attention 的第 4 个 query Token 对 key 0–4 的概率约为 `[0.2276, 0.0969, 0.1329, 0.1644, 0.3781]`。
- P4.2 raw 约 2.0 MB、curated/web 各约 4.0 MB；attention、W8A8、TP、token/logits 和脱敏校验错误均为 0。
- `attention-derived.json` 提供平均矩阵、16 heads 详情、top key、熵和融合输出比较；fidelity 为 `DERIVED`。

## 4. 当前决策

| ID | 决策 | 状态 | 原因 |
|---|---|---|---|
| D-001 | 第一版使用预录真实轨迹，不现场推理 | 已确认 | 可复现、安全、无需网站后端 |
| D-002 | 真实推理前先冻结最小 schema 和采集点 | 已确认 | 避免昂贵运行后发现缺数据 |
| D-003 | raw/curated/web 三层数据包 | 已确认 | 隔离大数据、敏感信息和发布数据 |
| D-004 | 网页核心不依赖 vLLM Python 对象 | 已确认 | 降低版本耦合，便于测试和扩展 |
| D-005 | 第一版 UI 专注 Qwen3.5，协议保留扩展性 | 已确认 | 控制范围，同时避免完全写死 |
| D-006 | 全部可视元素标记 EXACT/SUMMARY/DERIVED/STRUCTURAL/SCHEMATIC | 已确认 | 区分直接证据、真实输入重建和教学示意 |
| D-007 | 40 层总览，代表层深挖，不逐层重复动画 | 已确认 | 保留真实结构并控制认知和性能成本 |
| D-008 | 单个远端采集包硬上限约 2G | 已确认 | 远端仅剩约 13G，必须留出运行安全空间 |
| D-009 | 任一待 SCP 数据超过 10G 时先征得用户确认 | 已确认 | 用户明确要求 |
| D-010 | 优化 baseline 与 eager 深层采集分开 | 已确认 | graph replay 不暴露层内 hook；eager 用于真实 tensor，baseline 用于优化路径和耗时 |
| D-011 | raw 数据 Git 忽略，只发布 curated/web | 已确认 | raw 含远端 provenance，发布数据必须脱敏 |
| D-012 | 不伪造融合内核内部数据 | 已确认 | Python 可见输入输出边界可采真实值；未返回的 attention 概率和内核 workspace 仍只做结构解释 |
| D-013 | W8A8 融合边界与 TP2 生成独立前端投影 | 已确认 | 让前端直接消费真实量化链和两 rank 时间线，避免重复解析底层事件 |
| D-014 | EP=false 时将 MoE 两 rank group 解释为复用 TP group | 已确认 | 避免把通信 group world size 误画成独立 EP2 |
| D-015 | 使用完整真实 Q/K/V 离线重建 attention 热力图 | 已确认 | 不修改 CANN 内核也能得到流程正确、由融合输出验证的教学数据 |
| D-016 | 离散轨迹事件通过语义插值形成连续动画 | 已确认 | 画面连贯，但不伪称采集了内核每个微步骤 |
| D-017 | 使用纵向 scrollytelling + 全宽 sticky 主画布 | 已被 D-032 部分取代 | 长页面和全宽方向保留；章节 sticky 被用户最新滚动要求取消 |
| D-018 | 点击节点在同一画布进入 Focus Scene 并连续展开/收起 | 已确认 | 支持从全局流程深入矩阵、MoE、W8A8 和 TP，而非图片切换 |
| D-019 | English 为默认 UI，完整支持 `EN / 中文` 切换 | 已确认 | 与源码术语一致，同时保留中文教学；切换不能重置播放状态 |
| D-020 | 前端采用 Svelte 5/SvelteKit static 与 TypeScript，P6 以 DOM/CSS/SVG 和 requestAnimationFrame 为主 | 已实现 | 当前矩阵规模很小，无需引入 Canvas；D3/GSAP 留到数据或编排复杂度确实需要时再添加 |
| D-021 | 三个视觉稿融合为全局长卷、局部矩阵剧场和 TP 双轨章节 | 已确认 | 三者是同一页面的不同缩放层级，不是三套页面 |
| D-022 | PlaybackEngine、TraceRepository、SceneProjector 与 LocaleCatalog 保持独立可测试模块 | 已实现 | 页面只消费稳定接口，轨迹读取、时间推进、投影和文案可分别验证 |
| D-023 | P6 动画由 requestAnimationFrame、CSS 插值和滚动观察器共同驱动 | 已实现 | 真实轨迹是离散事件，但界面可连续播放且不伪造新的采集值 |
| D-024 | 可点击 Focus Scene 必须有真实页面组件测试；trace 事实必须通过 `buildTraceExperience` | 已实现 | 防止底层 UT 全绿但页面不可见，缺失证据时直接失败而不是退回硬编码 |
| D-025 | 动态播放必须同时驱动正文画面和镜头；点击验收必须验证命中与视口相交 | 已实现 | 进度条变化、DOM 存在或程序化 click 成功都不能证明用户实际看到了动态内容 |
| D-026 | 使用 `docs/project-context/` 作为压缩后的完整恢复入口，`MEMORY.md` 仅作摘要 | 已确认 | 旧 memory 未保存视觉缘由、对话转折和强制恢复顺序，无法独立防止偏离 |
| D-027 | Decode 的 logits、selected token、KV cache 与步骤卡必须表示同一次生成决策 | 已实现 | 浏览器验收发现完成第 N 枚 token 时 logits 曾提前显示 N+1；语义一致性比动画提前预览更重要 |
| D-028 | 可视页面与推理游标必须分离，开始策略显式选择起点和单步/连续 | 已实现 | 章节浏览不应补完旧页，详见 ADR-0006 |
| D-029 | 连续推理 transport 与 camera follow 独立 | 已实现 | 用户最新要求运行中可滚动且不暂停；人工浏览只接管镜头，详见 ADR-0007 |
| D-030 | Decode 沿用全站浅色编辑表面，不使用独立黑色主题 | 已实现 | 用户指出最后一页与前文风格不一致；数据卡使用共享 paper/line/indigo/mint 变量 |
| D-031 | Initialize/Tokenize 不使用长章节 sticky 跑道 | 已被 D-032 扩展 | P6.8 先修复两章，随后用户要求推广到所有章节 |
| D-032 | 所有正文章节使用自然文档流，不使用 sticky 跑道 | 已实现 | 用户确认其他章节也有同类可见停滞；详见 ADR-0008 |

确认后的决策要转写为 `docs/decisions/` 中的 ADR；本表保留摘要。

## 5. 当前默认假设

- 仓库名为 `model-inference-visualizer`。
- English 为默认语言，所有界面、解释、图例和无障碍文本支持中文切换。
- 初学者使用故事模式，工程师使用探索模式。
- 第一版沿用固定 prompt、greedy 和 5 个输出 token。
- 桌面宽屏优先；主画布使用全宽长页面体验，移动端先做摘要体验。
- 第一版先本地验收，之后再决定公开部署。
- 默认不保存或发布可恢复的模型权重值。

## 6. 开放问题

1. 项目最终是公开网站、内部演示，还是仅本地使用？
2. 是否允许采集并保存极小的权重/激活数值切片，还是只保留统计和归一化热力图？
3. 第一版是否继续固定 `Hello, my name is`，还是改为更适合中文读者的 prompt？

## 7. 明确排除

- 浏览器内运行 35B 模型。
- 网站直连 SSH/NPU。
- 训练与反向传播。
- 第一版多模型适配。
- 全量权重或全量中间 tensor 发布。
- 未经确认修改 vLLM/vLLM Ascend 生产代码。

## 8. 防偏离规则

- 新需求先判断是否服务北极星；不服务则进入 backlog，不直接扩大当前阶段。
- 进入下一阶段前必须完成 `TASKS.md` 对应 Gate。
- 所有“真实值”必须有 run ID 和 source provenance。
- 任何推导或美化不能覆盖原始含义，必须保留 fidelity 标记。
- 前端需求不能反向要求采集无限数据；超过预算时优先改变表达方式。
- 发现旧教程事实与新运行不一致时，不覆盖旧事实：记录版本差异与解释。
- 每次用户确认后更新“当前状态、决策、开放问题和下一阶段门”。

## 9. 偏离记录

| 日期 | 原计划 | 变化 | 原因 | 用户是否确认 | 后果/后续 |
|---|---|---|---|---|---|
| 2026-07-09 | 先运行再做架构 | 增加“最小协议与采集点先行” | 避免一次重型运行后缺数据 | 已确认 | 完整架构仍在数据采集后冻结 |
| 2026-07-10 | 使用容器 `zsl_m2m_0612` | 改用实际存在的 `zsl_m2m_0612_1` | 指定容器不存在，且只有一个同名前缀容器 | 待验收 | 后续命令使用实际容器 |
| 2026-07-10 | 第一次正式采集作为最终数据 | 增加动态 rank 修正并用 `p3r2` 重跑 | worker 启动时环境变量未提供 rank，事件需在写入时读取分布式组 | 已处理 | 第一份 380K 数据仅作诊断，不下载为最终包 |
| 2026-07-10 | W8A8 scale 只能做结构示意 | 核对源码后确认 dispatch/GMM 边界可见，并完成 P4.1 补采 | 原结论把“内核内部临时值”和“Python 可见融合边界”混为一谈 | 已确认 | W8A8 scale 升级为真实数据；内核原生 attention buffer 仍不可见 |
| 2026-07-10 | P4.1 一次启动完成 | `p4r1` 计时工具不存在、`p4r2` 覆盖 CANN 路径，修正后 `p4r3` 成功 | 启动命令环境偏差，均在模型加载前失败 | 已处理 | 失败 run 不同步、不发布；最终数据只使用 `p4r3` |
| 2026-07-10 | attention 热力图只能做纯示意 | 完整采集 Q/K/V 并用 `softmax @ V` 对融合输出验证 | 用户接受离线计算，只要求流程正确 | 已确认 | 热力图升级为 DERIVED；仍不声称是内核原生 buffer |
| 2026-07-10 | 从三个 1440×1024 单屏方向中选择一个 | 融合为长页面 scrollytelling、点击连续展开、矩阵 Focus Scene 和 TP 双轨章节 | 用户指出单屏信息臃肿，并要求参考项目源码中的真实动态交互 | 已确认 | P5 增加交互规范与 ADR；视觉稿验收后再 scaffold |
| 2026-07-10 | 中文为主、术语双语 | 改为 English 默认并支持完整 `EN / 中文` 切换 | 用户明确要求网站整体先使用英文 | 已确认 | trace 保持语言无关，语言切换不重置播放状态 |
| 2026-07-12 | 视觉稿之后再决定页面是否能真正展开 | P6 已实现 Attention、MoE 和 TP 的同页连续展开，不使用图片轮播 | 用户明确要求像参考项目一样点击流程查看动态细节 | 已确认 | 共享播放状态同时驱动章节、进度与 Focus Scene |
| 2026-07-12 | 7 个底层 UT 加人工浏览器检查即可证明 P6 可用 | 用户复验发现多个功能不可用；补充真实页面点击测试、场景模型和严格浏览器断言 | 原验收缺少页面级红灯能力，且部分数据为页面硬编码 | 已修复，待用户复验 | 测试增至 17 条；完整记录见 `docs/reports/2026-07-12-p6-interaction-regression.md` |
| 2026-07-13 | 详情区域进入 DOM、进度条推进即可视为动态交互完成 | 用户复验指出正文无动画且点击无可见变化；改为播放驱动正文、自动镜头、真实 hit-test 和 viewport 断言 | 原实现的动画在页面加载时独立运行，播放状态未驱动镜头；无效 `fr` 计算把详情排到视口外 | 已修复，待用户复验 | 测试增至 19 条；完整记录见 `docs/reports/2026-07-13-p6-dynamic-playback-regression.md` |
| 2026-07-13 | 使用 `MEMORY.md` 即可在压缩后恢复方向，P6 功能修复后可等待进入 P7 | 用户指出实现仍脱离早先视觉稿与初衷；建立完整对话/方案/视觉/状态/恢复档案，并重新打开 P6 产品 Gate | memory 偏重事实清单，没有保存视觉选择原因、失败验收和强制重读顺序 | 已确认问题，档案待验收 | 新增 `docs/project-context/` 与根 `AGENTS.md`；下一步先视觉差异审计，不进入 P7 |
| 2026-07-13 | 完成上下文档案后直接整体重写 P6 | 先做带真实浏览器截图的差异审计，再拆成三个可验收实现切片 | 现有页面并非全部失效，必须区分可保留的数据/行为与需要重做的视觉骨架 | 审计待用户验收 | 审计确认首屏、初始化、Focus Scene、TP/Decode 和播放控件的结构性缺口 |
| 2026-07-13 | 三个纠偏切片按审计清单直接实现 | 浏览器验收额外修复 Decode 决策错位、Focus Scene 被章节栏遮挡，以及关闭中快速重开竞态 | 自动化通过后仍用真实操作与参考稿同屏对照发现了语义/构图/过渡问题 | 自动化与浏览器已通过，待用户验收 | 29 tests、静态构建、1280px/390px 截图和同屏对照已固化 |
| 2026-07-13 | 桌面通过即可申请验收，移动端只在 P7 再看 | 在不扩大产品范围的 readiness 审计中修复 390px 摘要布局、Evidence dialog、中文说明和 URL 语言优先级 | 桌面 min-width 会把三个展开入口推出移动视口；旧语言偏好会覆盖显式 URL | 已修复并回归，用户 Gate 仍打开 | 证据见 `docs/audits/2026-07-13-p7-readiness/` |
| 2026-07-13 | 40 层 30/10 类型图即可证明 Linear/Full Attention 都已实现 | 完成性审计确认只有 Full Attention 有可展开内部过程，因此补齐 p4r4 Layer 0 Gated DeltaNet 六阶段 Focus | “实现代表层”需要页面级可见/可点证据，不能只靠类型计数和文档勾选 | 已修复并回归，用户 Gate 仍打开 | 真实输入/输出的受控样本与统计为 Summary；内部源码路径为 Structural/Schematic；证据见 `docs/audits/2026-07-13-p8-completion/` |
| 2026-07-13 | 一个 `chapter` 同时代表可视页面和推理步骤 | 分离 `viewChapter`、推理 cursor 与 `progressByChapter`，加入 3 种起点 × 2 种模式 | 用户复验发现仅切换页面会把旧页补到完成，并要求页面/步骤独立 | 已实现并回归，待用户验收 | 7 files / 41 tests；真实浏览器证明 Prefill `0.234` 浏览后不变、单步语义正确、滚动自动暂停；见 ADR-0006 与 P6.5 报告 |
| 2026-07-13 | 人工滚动立即暂停连续播放 | 人工滚动/触控/章节浏览只关闭 camera follow，transport 与正文动画继续 | 用户最新明确要求运行过程中可以滑动且不暂停 | 已实现并回归，待用户验收 | 7 files / 43 tests；真实浏览器 `scrollY 1040 → 1760` 时 progress `0.087 → 0.138`；见 ADR-0007 与 P6.6 报告 |
| 2026-07-13 | Decode 使用独立深色终章 | 改为与前文一致的浅色章节、暖白数据卡和共享状态色 | 用户指出最后一页为黑色，与前面风格不一致 | 已实现并回归，待用户验收 | 7 files / 44 tests；新构建旧深色背景残留为 0；见 P6.7 报告 |
| 2026-07-13 | 所有章节统一使用 `145vh + sticky` | Initialize/Tokenize 改为自然高度并随文档等量移动 | 用户指出第二、第三章滚动后页面变长但画面不动；真实浏览器确认短场景被固定在 92px | 已实现并回归，待用户验收 | 7 files / 45 tests；两章 `scrollDelta 260 / visualDelta -260`；见 P6.8 报告 |
| 2026-07-13 | P6.8 只取消 Initialize/Tokenize 的 sticky | 将自然文档流推广到全部正文章节 | 用户确认其他章节也有同类问题并要求一并快速修复 | 已实现并回归，待用户验收 | Attention/TP/Decode 均为 `scrollDelta 180 / visualDelta -180`；见 ADR-0008 与 P6.9 报告 |

## 10. 阶段完成记录

| 阶段 | 状态 | 证据 | 结论 |
|---|---|---|---|
| P0 方案 | 已完成 | `docs/PROJECT_PLAN.md`、`docs/ARCHITECTURE.md` | 用户同意按默认方案执行 |
| P1 环境与基线 | 已完成 | `docs/reports/2026-07-10-p1-environment-audit.md`、`docs/reports/2026-07-10-p1-baseline.md` | 环境可用，baseline 通过，等待验收 |
| P2 采集器 | 已完成 | `collector/`、`schemas/trace-event-v1.schema.json` | 5 个行为测试与语法检查通过 |
| P3 正式采集 | 已完成 | `data/raw/qwen35-a3b-w8a8-20260710-p3r2` | eager 深层采集通过，输出与旧证据一致 |
| P4 数据投影 | 已完成 | `data/web/qwen35-a3b-w8a8-20260710-p3r2` | 454 事件、必需 stage 齐全、错误 0、脱敏通过 |
| P4.1 融合/并行补采 | 已完成 | `data/web/qwen35-a3b-w8a8-20260710-p4r3`、`docs/reports/2026-07-10-p4.1-quantization-and-tp-trace.md` | 1722 事件、量化 scale 与 50 个 TP span 齐全、错误 0 |
| P4.2 Attention 重建 | 已完成 | `data/web/qwen35-a3b-w8a8-20260710-p4r4/attention-derived.json`、`docs/reports/2026-07-10-p4.2-derived-attention.md` | 16 heads、causal softmax 与融合输出相似度校验通过、错误 0 |
| P5 架构/视觉冻结 | 已完成 | `docs/ARCHITECTURE.md`、`docs/INTERACTION_DESIGN.md`、`docs/assets/p5-fused-long-scroll-direction.png` | 技术与融合视觉方向已验收并进入实现 |
| P6 网站 MVP | 三个纠偏切片、P6.5 页面/游标解耦、P6.6 滚动不中断、P6.7 Decode 浅色一致性、P6.8/P6.9 全章节连续滚动、自动化、桌面/390px 浏览器和设计 QA 已通过；待用户产品/视觉验收 | `web/`、`design-qa.md`、`docs/audits/2026-07-13-p6-rebuild/`、`docs/audits/2026-07-13-p7-readiness/`、`docs/audits/2026-07-13-p8-completion/`、`docs/reports/2026-07-13-p6.9-all-chapter-scroll-regression.md` | 页面已达到再次申请验收状态；用户接受前不进入 P7 正式交付 |
| P7 QA/发布 | 正式交付未开始；已完成不扩大范围的 readiness 补强 | `docs/audits/2026-07-13-p7-readiness/` | 用户接受 P6 后再进入完整设备/性能/许可/部署检查 |
