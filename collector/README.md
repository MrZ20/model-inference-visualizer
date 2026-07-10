# 推理轨迹采集器

采集器用于专门的教学运行，不进入 vLLM 或 vLLM Ascend 生产代码。

外部接口只有：

- `TraceWriter.emit(...)`：写入一个有版本的 NDJSON 事件。
- `summarize(...)`：记录 tensor 元数据，并按需采集小切片、统计或 top-k。
- `compile_trace(...)`：合并、校验、脱敏并拆分网页章节。

正式 Qwen3.5 运行使用 `scripts/collect_qwen35.py`。该脚本故意启用
`enforce_eager=True`，保证代表性层的 hook 可以观察到真实 tensor。优化执行图
的初始化与耗时证据来自已通过的无插桩 baseline，不把 eager trace 的耗时当成
线上性能。

## 本地测试

```bash
python3 -m venv .venv
PYTHONPATH=collector/src .venv/bin/python -m unittest discover \
  -s collector/tests -v
```

## 远端运行约束

- 每个进程默认最多写 64 MiB。
- 每个 stage 默认最多写 32 个事件。
- 只对 layer 0 linear attention、layer 3 full attention/MoE、logits 等代表点采样。
- 不保存完整权重或完整大 tensor。
- 输出目录运行后必须先用 `du -sh` 检查，再决定 SCP。
