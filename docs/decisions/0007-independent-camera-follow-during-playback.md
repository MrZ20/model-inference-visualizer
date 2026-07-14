# ADR 0007：播放 transport 与镜头跟随独立

- 状态：Accepted
- 日期：2026-07-13
- 决策人：用户与项目执行者
- 取代：ADR-0006 第 3 条中的“滚动立即暂停”部分

## 背景

P6.5 按当时要求在 wheel、touch 和非程序化 scroll 时暂停连续播放。用户最新验收明确改为“运行过程中可以滑动页面，且不暂停”。复现同时发现，旧播放帧还会持续把 `viewChapter` 覆盖成推理游标，所以即使允许原生滚动，页面也可能被自动镜头拉回。

## 决策

1. `PlaybackEngine` 的动画帧只推进 inference cursor 和 `progressByChapter`，不写可视页面。
2. 页面层维护可恢复的 camera-follow 状态：显式开始连续/单步运行时启用自动跟随。
3. wheel、touch、滚动条、非程序化 scroll 和章节导航只关闭自动跟随，不发送 `PAUSE`。
4. 手动接管期间 IntersectionObserver 继续更新 `viewChapter`；推理游标、transport 和正文动画独立继续。
5. 再次显式开始会把页面定位到选定起点并恢复自动跟随。
6. 用户显式点击 Pause，或进入需要稳定阅读的 Focus Scene，仍可以暂停 transport。

## 后果

- 用户可以边看后续或前面章节，边让真实推理时间线继续推进。
- Viewing 与 Cursor 可能长期不同，顶栏必须同时展示两者。
- 播放引擎不再拥有镜头策略，避免每帧状态发布覆盖人工浏览。
- 验收必须同时证明页面位置变化、transport 仍为 playing、正文进度继续增加，并证明手动页面不会被游标拉回。

## 证据

- `web/src/lib/playback/engine.test.ts`
- `web/src/routes/page.test.ts`
- `docs/reports/2026-07-13-p6.6-scroll-without-pausing-regression.md`
