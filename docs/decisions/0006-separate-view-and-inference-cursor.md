# ADR 0006：分离可视页面与推理游标

- 状态：Accepted
- 日期：2026-07-13
- 决策人：用户与项目执行者

第 3 条中的“手动滚动立即暂停”已被用户最新要求推翻，并由 ADR-0007 取代；其余 view/cursor 与开始策略决定继续有效。

## 背景

旧 `PlaybackSnapshot.chapter` 同时表示“用户正在看的章节”和“推理已经运行到的步骤”。点击章节会重置游标，而 `sceneProgress` 又把游标之前的全部章节直接渲染为 100%。因此仅浏览到 Attention，就会把此前停在 23% 的 Prefill 瞬间补完；平滑滚动、IntersectionObserver 和播放镜头也会竞争同一个状态。

用户明确要求页面位置与推理步骤独立，并要求开始入口支持三种起点和两种执行方式。

## 决策

1. `PlaybackSnapshot` 分开保存：
   - `viewChapter` / `viewChapterIndex`：当前可视页面；
   - `chapter` / `chapterIndex` / `progress`：推理游标；
   - `progressByChapter`：各场景已经实际执行到的进度。
2. 章节按钮、Previous/Next 和 IntersectionObserver 只更新 `viewChapter`，不修改推理游标或任何场景进度。
3. 连续播放时镜头可以跟随推理游标；用户 wheel、touch、滚动条或页面滚动接管后立即暂停，随后页面可继续独立浏览。
4. `START` 命令显式携带起点和模式：
   - `beginning`：清空场景进度，从 Initialization 开始；
   - `page`：从当前可视页面 0% 开始；
   - `step`：从独立推理游标继续；
   - `continuous`：连续跨章节；
   - `single`：只推进当前场景的一个语义阶段并保持暂停。
5. 单步阶段数使用场景语义定义：Initialization 8、Token 5、Prefill 40、Attention 6、MoE 6、TP 7、Decode 5；不是按任意毫秒增量前进。

## 后果

- 浏览页面不再篡改推理历史，旧页面也不会被补到完成态。
- “当前页面”和“当前步骤”成为可验证的不同起点；顶栏同时显示 Viewing 与 Cursor，避免用户误判。
- 播放引擎需要维护每场景进度，但仍是唯一时间源；场景组件不拥有独立全局时钟。
- 自动播放仍可提供连续镜头，手动滚动则具有明确优先级。

## 证据

- `web/src/lib/playback/engine.test.ts`
- `web/src/routes/page.test.ts`
- `docs/reports/2026-07-13-p6.5-playback-navigation-regression.md`
- 后续滚动语义：`docs/decisions/0007-independent-camera-follow-during-playback.md`
