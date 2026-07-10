# 项目 Memory

> 这是项目的长期对齐文件。每完成一个阶段、做出一个架构决策、发现一个事实变化或发生一次偏离，都必须更新本文件。

## 1. 当前状态

- 日期：2026-07-10
- 当前阶段：P2–P4 已完成
- 当前状态：正式轨迹已下载、脱敏、编译并通过校验
- 下一阶段门：进入 P5 架构冻结与视觉方向
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

## 4. 当前决策

| ID | 决策 | 状态 | 原因 |
|---|---|---|---|
| D-001 | 第一版使用预录真实轨迹，不现场推理 | 已确认 | 可复现、安全、无需网站后端 |
| D-002 | 真实推理前先冻结最小 schema 和采集点 | 已确认 | 避免昂贵运行后发现缺数据 |
| D-003 | raw/curated/web 三层数据包 | 已确认 | 隔离大数据、敏感信息和发布数据 |
| D-004 | 网页核心不依赖 vLLM Python 对象 | 已确认 | 降低版本耦合，便于测试和扩展 |
| D-005 | 第一版 UI 专注 Qwen3.5，协议保留扩展性 | 已确认 | 控制范围，同时避免完全写死 |
| D-006 | 全部可视元素标记 EXACT/SUMMARY/STRUCTURAL/SCHEMATIC | 已确认 | 防止教学示意冒充真实数据 |
| D-007 | 40 层总览，代表层深挖，不逐层重复动画 | 已确认 | 保留真实结构并控制认知和性能成本 |
| D-008 | 单个远端采集包硬上限约 2G | 已确认 | 远端仅剩约 13G，必须留出运行安全空间 |
| D-009 | 任一待 SCP 数据超过 10G 时先征得用户确认 | 已确认 | 用户明确要求 |
| D-010 | 优化 baseline 与 eager 深层采集分开 | 已确认 | graph replay 不暴露层内 hook；eager 用于真实 tensor，baseline 用于优化路径和耗时 |
| D-011 | raw 数据 Git 忽略，只发布 curated/web | 已确认 | raw 含远端 provenance，发布数据必须脱敏 |
| D-012 | 不伪造融合内核内部数据 | 已确认 | W8A8 per-token 动态 scale 和完整 attention 概率未被内核暴露，只做结构解释并明确标记 |

确认后的决策要转写为 `docs/decisions/` 中的 ADR；本表保留摘要。

## 5. 当前默认假设

- 仓库名为 `model-inference-visualizer`。
- 中文为主，关键术语中英双语。
- 初学者使用故事模式，工程师使用探索模式。
- 第一版沿用固定 prompt、greedy 和 5 个输出 token。
- 桌面优先，移动端先做摘要体验。
- 第一版先本地验收，之后再决定公开部署。
- 默认不保存或发布可恢复的模型权重值。

## 6. 开放问题

1. 项目最终是公开网站、内部演示，还是仅本地使用？
2. 是否允许采集并保存极小的权重/激活数值切片，还是只保留统计和归一化热力图？
3. 第一版是否继续固定 `Hello, my name is`，还是改为更适合中文读者的 prompt？
4. 视觉表达更偏科普故事，还是更偏源码/算子调试？当前方案建议两层共存、故事模式默认。
5. 是否需要在第一版展示两个 TP rank 的通信细节，还是只展示拓扑和聚合事件？
6. 远端正式采集时允许修改教学分支代码，还是必须全部通过外部启动脚本/monkey patch 完成？

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

## 10. 阶段完成记录

| 阶段 | 状态 | 证据 | 结论 |
|---|---|---|---|
| P0 方案 | 已完成 | `docs/PROJECT_PLAN.md`、`docs/ARCHITECTURE.md` | 用户同意按默认方案执行 |
| P1 环境与基线 | 已完成 | `docs/reports/2026-07-10-p1-environment-audit.md`、`docs/reports/2026-07-10-p1-baseline.md` | 环境可用，baseline 通过，等待验收 |
| P2 采集器 | 已完成 | `collector/`、`schemas/trace-event-v1.schema.json` | 5 个行为测试与语法检查通过 |
| P3 正式采集 | 已完成 | `data/raw/qwen35-a3b-w8a8-20260710-p3r2` | eager 深层采集通过，输出与旧证据一致 |
| P4 数据投影 | 已完成 | `data/web/qwen35-a3b-w8a8-20260710-p3r2` | 454 事件、必需 stage 齐全、错误 0、脱敏通过 |
| P5 架构/视觉冻结 | 未开始 | - | - |
| P6 网站 MVP | 未开始 | - | - |
| P7 QA/发布 | 未开始 | - | - |
