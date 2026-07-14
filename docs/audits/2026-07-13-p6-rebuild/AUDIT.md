# P6 重建浏览器与视觉验收

## 结论

三个视觉纠偏切片已实现。页面不再是窄卡片、静态结果页或图片轮播，而是一条由同一 PlaybackEngine 驱动的宽屏长页面；Attention、MoE/W8A8 和 Tensor Parallel 都能在原章节内点击展开并逐阶段运动。自动化、真实浏览器和参考稿同屏对照均通过；最终产品/视觉接受仍由用户操作决定。

## 环境

- URL：`http://127.0.0.1:4173/?lang=en`
- 视口：1280 × 720
- 文档尺寸：1280 × 8993（Decode 位置实测）
- run ID：`qwen35-a3b-w8a8-20260710-p4r4`
- 浏览器：Codex in-app Browser
- console warning/error：0

## 截图

- [全局长页面首屏](overview-1280x720.png)
- [Attention 展开与 Softmax](attention-expanded-1280x720.png)
- [MoE/W8A8 展开与 dynamic scale](moe-expanded-1280x720.png)
- [Tensor Parallel 双 lane 与 collective](tensor-parallel-expanded-1280x720.png)
- [Decode 完成态](decode-playing-1280x720.png)
- [选定视觉稿与最终 Attention 同屏对照](reference-vs-implementation-attention.png)

## 真实浏览器断言

### Initialization

- 点击唯一 `Play inference: Initialize`。
- 1.6 秒后 `#init` 为 playing，scene progress `0.205`。
- 两个初始化步骤 active；第三个 shard opacity 从 0 进入中间值。
- 证明正文数据在变，不只是顶部进度条变化。

### Attention

- `Explore attention internals` 精确 accessible name 唯一命中。
- 展开 region top `148.41`、bottom `711.50`、viewport height `720`，与当前 viewport 相交。
- 点击 `05 Softmax probabilities` 后 `--stage: 0 → 0.25`。
- 前四个 article transform 从 `translateY(10px)` 变为 `translateY(0)`，Softmax 面板进入当前阶段。
- 展示真实 Q `[5,2048]`、K/V `[5,256]`、scale `0.0625`、5×5 derived scores/probabilities 与融合输出相似度。

### MoE / W8A8

- `Explore MoE + W8A8` 唯一命中，展开 region 与 viewport 相交。
- token 0 的 top experts 从 E214/E202/E163…；切到 token 1 后变为 E211/E199/E37…。
- `04 Per-token dynamic scale` 使 scale stage `0 → 0.25`。
- 页面显示 `[5,256]` router、`[40,2048]` INT8 dispatch、完整 `[40]` captured scales、GMM1/SwiGLU 和 combine。

### Tensor Parallel

- `Explore tensor parallelism` 唯一命中，展开 region 与 viewport 相交。
- 两个 lane 同时存在：R0/NPU:0 和 R1/NPU:1，各 `8 Q / 1 KV`。
- 两 rank QKV duration 分别 `6.440 ms` 和 `6.515 ms`，并展示 `[2048,4608]` 分片、`[5,4608]` local QKV、`[1,248320]` local logits。
- 点击 `05 Collective` 后两个 `.collective-stage` 同时 `0 → 0.25`。

### Decode

- 初始 output 为 `Hello, my name is`，完成步骤为 0。
- 2× 播放到 progress `0.272`：logits top-1、selected token 均为 498；一个步骤 complete、一个 KV slot filled。
- 完成帧：logits top-1、selected token 均为 321；五个 KV slot 完成；输出为 captured final string。
- 验收期间发现旧实现把已选 token 498 与下一步 logits 7525 并排展示，现已修复并由 `DecodeScene.test.ts` 回归保护。

### 双语与可访问性

- 在 TP focus/collective stage `0.25`、speed `2` 时切到中文，URL 变为 `?lang=zh-CN`，region label 为 `张量并行内部过程`；focus、stage、speed 均保持。
- 切回 English 后状态仍保持。
- 章节按钮包含编号和名称；核心 Play/Focus/Close/Step 控件有唯一 accessible name。
- 实际 pointer center 的 `elementsFromPoint` 首个 button ancestor 为 `.primary-play`。

## 同屏视觉对照发现与修复

将选定稿 Attention 区和最终实现放进同一 2560 × 720 输入后，确认矩阵剧场、章节轨、Q/K/V、causal mask、softmax 与暖白/indigo 视觉语言一致。第一次对照发现 focus shell 向左扩展到固定章节栏下方，三个 focus 标题均被裁切；修复后 rail right `104.95 px`，shell left `115.19 px`，title left `133.78 px`，不再遮挡。

## 自动化

```text
npm run check          0 errors, 0 warnings
npm test -- --run      7 files, 22 tests passed
npm run build          adapter-static build succeeded
```

## 剩余边界

- 原生 fused-attention softmax/workspace 没有伪装成 captured；derived 与 schematic 标记保留。
- eager durations 只用于解释，不宣称 graph 性能。
- 移动端专项、性能、许可与发布终检属于 P7。
- 用户未实际接受前，P6 产品/视觉 Gate 仍打开。
