# 当前项目状态

> 快照日期：2026-07-13。每个大步骤结束时更新；上下文恢复后先与真实 Git 状态核对。

## 1. 仓库

- 路径：`/Users/user/work/MrZ20_1/model-inference-visualizer`
- 分支：`main`
- HEAD：`2d81450 feat: build interactive inference visualizer`
- 远端：`origin git@github.com:MrZ20/model-inference-visualizer.git`
- 分支相对 `origin/main`：ahead 1
- 工作树同时包含此前已暂存的 P6 回归/连续性档案和本次重建变更；不得覆盖、回滚，也没有 commit 或 push 授权。
- 本地最新静态预览正在运行：`http://127.0.0.1:4175/?lang=en`（4173 被一个不可用的既有监听占用；4174 是上一构建的旧预览，均未擅自终止）。

## 2. 阶段与验收

| 项目 | 状态 |
|---|---|
| 数据采集 P0–P4.2 | 完成 |
| 架构与选定视觉 P5 | 完成并得到方向确认 |
| P6 三个视觉纠偏切片 | 已连续实现 |
| P6 自动化 | 7 files / 45 tests、类型检查、4.6 MB 静态构建通过 |
| P6 真实浏览器与设计 QA | 通过，证据见 `docs/audits/2026-07-13-p6-rebuild/` |
| P7 readiness 补充审计 | 390px 响应式、键盘、Evidence dialog、双语 URL 优先级通过 |
| 完成性审计补充 | 补齐 Linear Attention 代表层六阶段 Focus，并逐项核对原始交付要求；不构成越过 Gate 的新阶段 |
| P6.5 页面/步骤控制 | 已实现并通过失败回归、完整自动化与 1280×720 真实浏览器复验 |
| P6.6 滚动不中断 | 失败回归、完整自动化与 1280×720 真实浏览器复验通过 |
| P6.7 Decode 视觉一致性 | 已改为全站浅色编辑语言，失败回归与真实浏览器计算样式通过 |
| 滚轮浏览器差异 | Google 浏览器物理滚轮正常；Codex 内置浏览器物理滚轮输入存在宿主限制，网站未增加规避性补丁 |
| P6.8 第二/第三章连续滚动 | 已取消短场景 sticky 停留，失败回归与 1280×720 真实浏览器复验通过 |
| P6.9 全章节连续滚动 | 已改为自然文档流，全局失败回归与 1280×720 真实浏览器抽样通过 |
| P6 产品/视觉 | **等待用户复验 P6.9 并接受整体体验** |
| 当前 Gate | 仍打开；P6.9 机器证据通过，但不能替代用户接受 |
| P7 正式交付 | 未开始；本轮只完成不改变产品范围的 readiness 修复与证据 |

P6 不能在用户操作前写成“最终完成”。本轮已经修复审计列出的结构性问题并通过机器与浏览器检查，但用户仍需要判断整体体验是否回到最初确认的视觉与交互方向。

## 3. 当前真实数据

### 发布 run

- Run ID：`qwen35-a3b-w8a8-20260710-p4r4`
- Web bundle：约 4 MB
- 事件：1722；rank 0/1 各 742
- prompt：`Hello, my name is`
- prompt token IDs：`[9419, 11, 821, 803, 369]`
- 输出 IDs：`[498, 7525, 3855, 1089, 321]`
- 最终文本：`Hello, my name is [Your Name], and`

### 关键事实

- hidden size 2048，40 层，30 linear attention / 10 full attention。
- 16 Q heads、2 KV heads、head size 256；TP=2、EP=false。
- 256 experts、每 Token top-8。
- layer 3 prefill Q `[5, 2048]`、K/V `[5, 256]`。
- DERIVED attention 由真实 Q/K/V 离线计算并用融合输出验证；不是内核原生 softmax dump。
- 五次生成决策的 logits 均为 `[1, 248320]`；第一枚 token 使用 prefill logits，后四枚使用对应 decode logits。

## 4. 当前实现

- Svelte 5 + SvelteKit static + TypeScript，网站只回放静态 `p4r4` 轨迹。
- 顶部固定控制统一 prompt、播放/暂停、前后章节、当前场景、速度、语言和 Evidence。
- 顶部播放入口可选择从头、当前页面、当前步骤，以及单步/连续；状态栏分别显示 Viewing 与 Cursor。
- `viewChapter` 与推理 `chapter/progress` 已解耦，各场景实际进度保存于 `progressByChapter`；浏览另一页不会补完旧页。
- 连续播放默认自动跟随推理游标；wheel、touch、滚动条或章节浏览会接管镜头，但 transport 和正文动画继续运行，再次显式开始可恢复自动跟随。
- 所有正文章节使用自然内容高度并随文档连续移动，不再使用 `145vh` sticky 跑道；矩阵剧场通过 Focus 展开和内容阶段动画聚焦。
- 左侧命名章节轨贯穿约 9000 px 的纵向长页面；首屏全局流展示 `Load weights → Tokens → Embedding → 40 layers → Logits → completion`。
- Initialization 展示 config、W8A8、10 shards、两个 TP rank、KV cache、runtime probe 和 READY 顺序。
- Prefill 展示全部 40 层，并同时提供 Linear Attention 与 Full Attention 两个真实可点击入口；Linear Focus 用 p4r4 layer 0 的 `[5, 2048]` 真实边界摘要（受控样本与统计）包围六阶段 Gated DeltaNet 结构路径。
- Attention Focus Scene 可逐步查看 Token、Q/K/V、scores、scale/mask、softmax 和输出验证，并切换 16 heads。
- MoE/W8A8 Focus Scene 可切换 prompt token、rank，并查看真实 top-8、`[40, 2048]` dispatch、per-token scale、GMM1/SwiGLU、GMM2 和 combine。
- Tensor Parallel Focus Scene 用两个同步 lane 展示真实分片、局部 shape/duration、collective、local logits 与 merge。
- Decode 连续展示五个精确 token 决策、logits、KV cache 和文本增长。
- Decode 与前文统一为浅色章节和暖白数据卡，保留 indigo/mint 的选中、完成与循环强调，不再使用整章黑色主题。
- English 默认；`EN / 中文` 切换保留 chapter、focus、stage、progress 和 2× speed。
- 显式 `?lang=en` / `?lang=zh-CN` 优先于本地保存的语言；390px 下提供摘要式堆叠，Focus 内部宽矩阵只在自身区域横向滚动。
- Evidence 是可用 Escape 关闭并恢复触发器焦点的 modal dialog；中英文 provenance 与 fidelity 说明完整对应。
- Captured / Derived / Structural / Schematic 均有文字与边框样式标识。

## 5. 本轮发现并修复的问题

1. Decode 在完成第一枚 token 后曾把 logits 图提前切到下一枚 token，造成 selected token 498 与 logits top-1 7525 错位。现已保持同一决策的 logits、selected token、KV cache 和步骤卡一致，并增加组件回归测试。
2. Focus Scene 为争取宽度把左边距缩到章节栏下方，导致 Attention/MoE/TP 标题被遮挡。现已保留章节栏安全边距；浏览器测得 rail right `104.95 px`、focus title left `133.78 px`。
3. 390px 下曾沿用 920px 桌面 overview，导致 Attention/MoE/TP 展开入口在视口外。现改为摘要式单列，并把展开入口放到首位；全局文档宽度保持 390px。
4. Evidence 曾缺少 dialog/focus/Escape 语义，且中文界面保留英文说明。现已补齐可访问性与本地化，并增加页面级回归。
5. 已保存的中文偏好曾错误覆盖显式 `?lang=en`。现由 URL 明确优先，自动化和真实浏览器均已验证。
6. 完成性审计发现 Linear Attention 过去只有 30/10 层类型图和输入 shape，没有像 Full Attention 一样可展开的代表层，因此“已实现代表层”的证据不足。现已补齐真实边界 Tensor 摘要、源码级 Conv1D/Gated Delta/Norm/Projection 路径、六阶段播放、双语与响应式；受控样本/统计标记 Summary，内部未采集值标记 Structural/Schematic。
7. `MatrixGrid` 默认使用了未定义的 `--blue`，导致部分 Attention score/probability 热力背景退化。现已补齐设计 token，并在浏览器确认计算颜色生效。
8. Focus Scene 在 420ms 关闭动画尚未结束时快速点击同一入口，旧逻辑会把第二次点击再次解释为关闭。现改为 closing 状态下重新打开，并增加页面级竞态回归与真实浏览器复验。
9. 章节点击曾同时移动推理游标，且 `sceneProgress` 会把游标之前的章节直接补到 100%。现已分离可视页面与推理游标，加入三种起点、语义单步/连续和滚动接管；架构决定见 ADR-0006。
10. 用户最新明确要求运行过程中可滚动且不暂停。红灯证实旧代码同时存在手动导航主动暂停和播放帧覆盖视图；现已将 camera follow 与 transport 分离，架构决定见 ADR-0007。
11. Decode 曾单独使用 `#17182b/#1f2037/#24263f` 深色主题，与前文浅色章节不一致。现只替换 Decode CSS 为共享 paper/line/indigo/mint 设计变量，数据和动画逻辑不变。
12. Initialize/Tokenize 曾继承所有长章节的 `145vh + sticky`，导致文档滚动时短场景在 `92px` 处长时间不动。P6.8 先以两章例外验证自然文档流能消除停滞。
13. 用户继续指出其他章节也有同类停滞。公共 `.trace-section/.scene-sticky` 现已改为自然高度和 relative 定位，P6.8 的两章例外升级为全局契约；详见 ADR-0008。

## 6. 当前验证证据

- `npm run check`：0 errors，0 warnings。
- `npm test -- --run`：7 files，45 tests passed。
- `npm run build`：成功；adapter-static 写入 `web/build`。
- 真实浏览器 1280×720：
  - Initialization 在 1.6 秒内 progress 到 `0.205`，两个步骤 active，第三个 shard opacity 发生变化；
  - Attention 点击后 region 与 viewport 相交，Softmax stage `0 → 0.25`，面板 transform 同步变化；
  - MoE token `Hello → ,` 后 top experts 从 E214/E202… 改为 E211/E199…，dynamic scale stage `0 → 0.25`；
  - TP 两个 rank lane 同时存在，collective stage 均 `0 → 0.25`；
  - Decode progress `0.272` 时 logits top、selected token 均为 498，KV cache 和完成步骤均为 1；完成态 logits top、selected token 均为 321；
  - 中文切换保留 TP focus、stage `0.25` 和 speed `2`，再切回 English 状态不丢失；
  - 实际 pointer center 命中按钮，文档宽度与 viewport 一致，无全局横向溢出；console warnings/errors 为 0。
- 真实浏览器 390×844：
  - English 首屏由 `?lang=en` 确定，旧中文 localStorage 不再覆盖 URL；文档 `scrollWidth = innerWidth = 390`；
  - Attention、MoE、TP 的展开入口均在章节落点的当前视口中；
  - TP Focus region 宽 356px、内部教学画布 1215px，七阶段播放会逐步激活内容；
  - Evidence 中文 dialog 的说明完整本地化，Escape 关闭后焦点回到“数据证据”。
- 真实浏览器 Linear Attention：
  - 桌面 Prefill 同时显示 Linear/Full Attention 入口；六个 Focus panel 与 `Play sequence` 均在视口中可用；
  - 连续采样 progress `0.053 → 0.092 → 0.131 → 0.171`，输入 stage `0.316 → 0.555 → 0.789 → 1.0`；
  - 390px 章节落点中两个入口均在首屏，Focus region `356px`、内部画布 `1485px`、文档宽度 `390px`；
  - English → 中文保留 Linear Focus，中文 region 为“线性注意力内部过程”；console warnings/errors 为 0。
  - 最终 fidelity 复验中，entry 与 Focus 都显示 Summary，Evidence 同时包含 Captured/Summary/Derived/Structural/Schematic；0.5× 连续采样 progress `0.052 → 0.069`、输入 stage `0.316 → 0.416`。
  - `close → immediate reopen` 后 650ms 仍有 1 个 labelled region、`aria-expanded=true`；region top `107.31`、bottom `613.08` 与 720px viewport 相交，文档宽度仍为 1280px。
- 真实浏览器 P6.5（1280×720）：
  - Prefill 选到 `0.234` 后浏览 Attention，Prefill 保持 `0.234`，Viewing 变为 Attention，而 Cursor 保持 `Prefill · 23%`；
  - 播放选项弹层完整位于视口内（top `67`、bottom `344.19`），真实中心命中按钮，并显示 3 个起点 + 2 个模式；
  - 当前页面 + 单步产生 Attention `0.167`；浏览 TP 时游标仍为 Attention `17%`；当前步骤 + 单步回到 Attention 并推进到 `0.333`；
  - 当时的连续 Attention 播放会在 PageDown 后暂停；该历史行为已被用户 P6.6 最新要求推翻；
  - English → 中文保留 `beginning/continuous` 选择并完整本地化弹层。
- 真实浏览器 P6.6（1280×720，新构建重启后的 4175）：
  - 连续 Initialization 播放时 `scrollY 1040 → 1760`，正文 progress `0.087 → 0.138`，transport 始终为 playing；
  - 播放中浏览 Attention 后 Pause 控件保持可见，游标继续从 Initialization 进入 Tokenize；
  - 手动页面保持在 Attention、`scrollY=4228`，同时 Tokenize progress `0.908 → 0.975`，镜头没有被游标拉回。
- 真实浏览器 P6.7（1280×720，新构建重启后的 4175）：
  - Decode 章节为 `rgb(250,249,255)`、深色文字 `rgb(23,24,43)`；
  - scene/logits/KV/step 卡为暖白 `rgb(255,254,250)` 和共享 neutral border；
  - 旧 `#17182b/#1f2037/#24263f/#393b55` 背景残留数为 0。
- 真实浏览器 P6.8（1280×720，新构建重启后的 4175）：
  - Initialize `scrollY 1040 → 1300`、画面 top `210.14 → -49.86`；Tokenize `2140 → 2400`、画面 top `210.42 → -49.58`，两章均为等量连续移动；
  - Initialize transport 保持 playing，正文 progress `0.064 → 0.131`；
  - 继续滚动到 `scrollY=3250` 后 Viewing 正常进入 Prefill，文档宽度仍为 1280px。
- 真实浏览器 P6.9（1280×720，新构建重启后的 4175）：
  - Prefill、Attention、MoE、TP、Decode 的主画布均计算为 `position: relative`；
  - Attention、TP、Decode 抽样均为 `scrollDelta 180 / visualDelta -180`；
  - 文档尺寸为 1280×7944，无全局横向溢出。
  - 最终复验扩展到 Initialize、Tokenize、Prefill、Attention、MoE、TP、Decode
    全部章节，文档位移与画面位移始终等量反向；播放中真实滚轮使
    `scrollY 1027 → 1439`、Initialization 正文 `0.0118 → 0.0197`，
    transport 保持 playing，人工镜头接管后没有被拉回。
  - 逐章真实滚轮矩阵中，Initialize、Tokenize、Prefill、Attention、MoE、TP
    均为 `scrollDelta 260 / visualDelta -260`，Decode 在文档底部边界为
    `259 / -259`；七章均保持 `position: relative`。
  - Linear/Full Attention、MoE/W8A8、TP Focus 均再次通过视口展开和正文阶段
    运动检查；三种起点×两种模式、双语状态保持、中文 Evidence dialog 与空
    warning/error log 同时通过。
- 参考稿与最终 Attention 同屏对照：`docs/audits/2026-07-13-p6-rebuild/reference-vs-implementation-attention.png`。
- 详细验收：`design-qa.md`、`docs/audits/2026-07-13-p6-rebuild/AUDIT.md`、`docs/audits/2026-07-13-p7-readiness/AUDIT.md` 与 `docs/audits/2026-07-13-p8-completion/AUDIT.md`。

## 7. 当前已知边界

1. 融合 attention 内核未返回的原生 softmax/workspace 仍不伪称 captured；网页明确标记为 DERIVED/SCHEMATIC。
2. 桌面 1280px 以上是完整教学体验；390px 是经过验证的摘要体验，Focus 宽矩阵保留局部横向滚动。更广设备/浏览器矩阵、生产性能和发布检查仍属于 P7。
3. eager span duration 只解释相对步骤，不作为 graph 性能基准。
4. P6.9 机器与浏览器复验已通过；用户第 1 点在“轻微”后被截断，若仍有其他特定卡顿/闪烁/回弹，需要用户指出具体现象，不能由执行者补写。
5. P6 尚未得到用户最终产品/视觉验收。

## 8. 下一步

请用户在 `http://127.0.0.1:4175/?lang=en` 复验所有章节的滚动连续性。用户接受前不进入 P7，不连接 SSH、不重新采集，也不 commit 或 push。
