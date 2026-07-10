# P2–P4 轨迹采集与数据报告

> 日期：2026-07-10
> 状态：P2、P3、P4 完成
> 最终 run ID：`qwen35-a3b-w8a8-20260710-p3r2`

## 一句话结论

采集器、正式推理、SCP、脱敏和数据校验全部完成。最终网页数据包含 454 个事件，精确生成 token 与每一步 logits top-1 完全一致，关键 tensor 和 TP 两个 rank 均有真实证据。

## P2：采集器

新增：

- 有字节和事件上限的每进程 NDJSON writer。
- tensor shape/dtype/device/统计/小切片/top-k 摘要。
- multiprocessing 动态 rank 识别。
- vLLM/vLLM Ascend 生命周期 wrapper。
- layer 0 linear attention、layer 3 full attention/MoE、embedding 和 logits 代表 hook。
- raw 到 web 的合并、校验、脱敏和章节拆分。
- Qwen token/shape/MoE/logits/TP 不变量校验。
- trace event v1 schema。

本地仓库 `.venv` 中 5 个行为测试全部通过，Python 语法检查通过。

## P3：正式推理

正式采集使用：

- 实际容器 `zsl_m2m_0612_1`。
- NPU 4、5，TP=2，EP=false。
- 固定 prompt `Hello, my name is`。
- greedy，生成 5 个 token。
- `enforce_eager=True`，让层内 hook 可见。

最终运行退出码 0，总墙钟约 2 分 43 秒，采集器内部记录的模型运行约 142.57 秒。

精确结果：

```text
prompt token IDs:    [9419, 11, 821, 803, 369]
generated token IDs: [498, 7525, 3855, 1089, 321]
final text:          Hello, my name is [Your Name], and
```

第一次正式采集也成功，但 worker rank 在 writer 创建时尚未进入分布式组，事件显示为 `-`。修正为“每次写事件时动态读取 distributed rank”后，用 `p3r2` 重跑；最终数据中 rank 0/1 各有 129 个事件。

## P4：数据与校验

| 数据 | 大小 |
|---|---:|
| raw | 约 376K |
| curated | 约 720K |
| web | 约 720K |
| 从远端 SCP 的 raw + curated | 约 1.1M |

总量远低于用户规定的 10G 确认线。

最终 454 个事件：

| 阶段 | 事件数 |
|---|---:|
| init | 216 |
| warmup | 8 |
| prefill | 46 |
| decode | 184 |

真实性：

| 等级 | 事件数 |
|---|---:|
| EXACT | 164 |
| STRUCTURAL | 111 |
| SUMMARY | 179 |

必需 stage 缺失 0，JSON/schema 错误 0。发布数据未扫描到远端 hostname、IP、`/root` 或 `/vllm-workspace` 路径。

## 关键真实数据

- Embedding：`[5, 2048]`，BF16。
- layer 0 linear attention 输出：`[5, 2048]`。
- layer 3 full attention：
  - Q：`[5, 2048]`。
  - K：`[5, 256]`。
  - V：`[5, 256]`。
- layer 3 MoE router：`[5, 256]`，每个 token 记录 top-8 expert IDs/values。
- Logits：5 次 `[1, 248320]`。
- Logits top-1：`[498, 7525, 3855, 1089, 321]`，与生成 token 完全一致。
- rank 0 参数清单：约 17.62B parameter elements、约 19.04 GB，其中约 16.20B elements 为 int8。

## 可用于网页的内容

- 初始化、模型配置、10 个权重分片和参数 dtype/shape。
- TP rank 0/1 的加载、KV Cache、prefill/decode 调用。
- token、embedding、linear attention、full attention Q/K/V。
- MoE router top-8、expert 输入输出。
- logits 分布、top-20 和 greedy token。
- 五个 token 的完整生成时间线。

## 不能标成真实值的内容

- 深层采集使用 eager；性能和 graph capture 时间必须引用 baseline。
- 本次 `p3r2` 采集器尚未接入 W8A8 动态 scale 的 Python 可见边界，因此这份旧 run 中不能伪造 scale。后续 `p4r3` 已确认并补采 dispatch、GMM1+SwiGLU 和 GMM2 的真实 per-token scale，详见 `2026-07-10-p4.1-quantization-and-tp-trace.md`。
- 融合 attention 后端没有暴露完整 attention probability matrix；已有真实 Q/K/V shape、统计和小切片，完整热力图只能标记为教学示意。

## 运行后状态

- NPU 4、5 无残留进程。
- vLLM 和 vLLM Ascend 工作树干净。
- 容器磁盘仍约剩 13G。
- 没有将采集代码写入两个远端源码仓。

## 数据位置

- `data/raw/qwen35-a3b-w8a8-20260710-p3r2`：原始私有事件，Git 忽略。
- `data/curated/qwen35-a3b-w8a8-20260710-p3r2`：远端首次脱敏编译结果。
- `data/web/qwen35-a3b-w8a8-20260710-p3r2`：本地重新校验生成的网页数据。
