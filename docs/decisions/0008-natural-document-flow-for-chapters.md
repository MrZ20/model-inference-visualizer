# ADR 0008：所有正文章节使用自然文档流

- 状态：Accepted
- 日期：2026-07-13
- 决策人：用户与项目执行者
- 取代：ADR-0004 第 1 条中的章节 sticky 主画布部分；固定顶栏、长页面与 Focus Scene 决定继续有效

## 背景

统一的 `145vh` 章节高度与 `position: sticky; top: 92px` 会在文档继续滚动时把主画面固定在视口。P6.8 先证明该行为使 Initialize/Tokenize 出现可见停滞；用户随后确认其他章节也有相同体验并要求一并修复。

## 决策

1. 所有正文章节使用自然内容高度，不为播放人为增加 sticky 滚动跑道。
2. 所有章节主画布进入普通文档流，滚动多少，画面就移动多少。
3. 顶部播放控制仍固定；Viewing 与 inference cursor、camera takeover 和 transport 仍保持独立。
4. Focus Scene 仍在原章节内展开并逐阶段动画，但不依赖 sticky 定位。
5. 页面继续保持全宽纵向 scrollytelling，不退回 A4、dashboard、分页或图片轮播。

## 后果

- 用户滚动获得连续、直接的视觉反馈，不再出现文档滚动而主画面不动。
- 页面总高度由真实内容决定，章节切换点更紧凑。
- 自动播放仍可通过程序化章节导航跟随游标；内容动画和真实轨迹数据不变。
- 验收必须确认后续章节的画面位移与文档滚动等量，并确认 Focus 点击和播放回归仍通过。

## 证据

- `web/src/routes/page.test.ts`
- `docs/reports/2026-07-13-p6.9-all-chapter-scroll-regression.md`
