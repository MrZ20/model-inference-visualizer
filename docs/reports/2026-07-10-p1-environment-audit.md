# P1A 远端环境核查报告

> 日期：2026-07-10
> 状态：只读核查完成，等待用户验收
> 本阶段没有运行推理、没有修改远端文件、没有 SCP 数据

## 结论

目标测试、模型缓存和空闲 NPU 均可用，可以进入无插桩 baseline。

有三项需要按实际环境调整：

1. 用户提供的容器 `zsl_m2m_0612` 不存在，实际容器是 `zsl_m2m_0612_1`。
2. NPU 0 正被其他进程占用，baseline 建议只暴露空闲的 4、5 两张卡。
3. 容器文件系统只剩约 13G，采集输出不能按 10G 作为日常上限；正式采集器应设置约 2G 的硬上限。

## 远端入口

| 项目 | 实际值 |
|---|---|
| SSH | `ssh a3-node1` |
| 实际主机 | `liteserver-for-vllm-ascend-00002` |
| 容器 | `zsl_m2m_0612_1` |
| 镜像 | `quay.nju.edu.cn/ascend/cann:9.0.0-a3-ubuntu22.04-py3.12` |
| 工作目录 | `/vllm-workspace/vllm-ascend` |

## 代码版本

| 仓库 | Git 状态 | Commit |
|---|---|---|
| vLLM Ascend | `main`，工作树干净 | `81a8928d0b389751104b3c483f223a86afc04dd3` |
| vLLM | detached HEAD，工作树干净 | `1f486d96a17303ce8db8e02be39545b2be338446` |

Python 实际从上述工作区加载源码。安装包版本字符串包含较旧的 Git 标识，因此后续数据 provenance 使用仓库 Git SHA，不使用 package version 字符串作为唯一依据。

## 软件环境

| 软件 | 版本 |
|---|---|
| Python | 3.12.13 |
| PyTorch | 2.10.0+cpu |
| torch-npu | 2.10.0 |
| Transformers | 5.5.4 |
| pytest | 9.1.1 |
| CANN | 9.0.0 |
| npu-smi | 25.5.0 |

`torch==2.10.0+cpu` 是包版本标签；实际 NPU 能力由 `torch-npu==2.10.0` 提供。是否能正常推理由下一步 baseline 验证，不能只凭版本名判断失败。

## NPU 状态

- `npu-smi info` 显示 NPU 1–7 无运行进程。
- NPU 0 上存在其他进程和显存占用。
- baseline 使用 `ASCEND_RT_VISIBLE_DEVICES=4,5`，与测试的 `tensor_parallel_size=2` 一致。
- 不占用 NPU 0，也不额外暴露 6、7。

## 模型缓存

| 项目 | 值 |
|---|---|
| 路径 | `/root/.cache/modelscope/hub/models/Eco-Tech/Qwen3___5-35B-A3B-w8a8-mtp` |
| 总大小 | 约 38G |
| 权重 | 10 个 safetensors 分片 |
| 量化 | `W8A8_DYNAMIC` |
| config SHA256 | `5e4d7f74fec2f360eb9cfbfcd6ec0c4c76e684d3a11caaed259d9fd9bfbc7944` |
| quant description SHA256 | `614ebab4519e9b3299988950848d9bcc2f131732750ed45c4af4c9306ea42467` |

模型配置与旧教程一致：hidden size 2048、40 层、16 个 attention heads、2 个 KV heads、256 experts、每个 token 选择 8 个 experts、30 层 linear attention 和 10 层 full attention。

## 目标测试

测试文件存在：

```text
tests/e2e/pull_request/two_card/test_qwen3_5_35b_a3b_w8a8.py
```

测试参数与方案一致：固定 prompt `Hello, my name is`、TP=2、EP=false、Ascend 量化、greedy、最多生成 5 个 token。

## 磁盘与采集限制

容器根文件系统：

```text
总容量 491G
已使用 458G
剩余约 13G
使用率 98%
```

后续规则：

- baseline 只保存小型文本日志。
- 正式采集器远端输出设置约 2G 硬上限，正常目标远小于 1G。
- 不保存完整权重或完整大 tensor。
- SCP 前先执行 `du -sh` 和文件清单。
- 若待 SCP 数据超过 10G，停止并请求用户确认。

## 建议的下一大步骤

运行一次无插桩 baseline：

- 使用实际容器 `zsl_m2m_0612_1`。
- 使用用户指定的环境变量。
- 增加 `ASCEND_RT_VISIBLE_DEVICES=4,5`。
- 运行目标 pytest，不安装、不修改源码。
- 记录开始/结束时间、退出码、输出文本、峰值日志大小和运行后 NPU 状态。

baseline 完成后再次停下，等待验收，再开始采集器设计与实现。
