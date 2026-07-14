# ADR 0004：长页面连续播放器与可展开场景

- 状态：Accepted
- 日期：2026-07-10
- 决策人：用户与项目执行者

第 1 条中的章节 sticky 主画布已被用户后续滚动要求取代；当前自然文档流决定见 ADR-0008。长页面、全宽布局、统一播放状态和 Focus Scene 决定继续有效。

## 背景

P2–P4.2 已得到可发布的真实轨迹、W8A8/MoE 投影、TP=2 双 rank 时间线，以及由真实 Q/K/V 重建并经融合输出验证的 attention。

最初三个视觉稿将这些内容压进 1440×1024 单屏，造成两个问题：

1. 画面像仪表盘或 A4 页面，信息同时出现，视觉焦点不清楚；
2. 静态视觉稿无法表达用户要求的“点击流程节点后连续展开内部计算”。

参考项目 Transformer Explainer 的源码表明，它使用 Svelte、D3 和 GSAP，在同一画布中对 Attention 的 QK、Mask、Softmax 做点击展开，并使用独立长文章承载解释。该项目采用 MIT License。

## 决策

1. 网站采用纵向 scrollytelling。每个章节拥有 sticky 主画布，滚动驱动同一播放状态。
2. 轨迹仍是离散事件；`PlaybackEngine` 在事件间产生教学用连续插值。动画不是视频或图片轮播。
3. 可点击节点进入统一 `Focus Scene`：

       overview -> expanding -> detail -> collapsing -> overview

4. 全局流程、矩阵详情和 TP 双轨不是三个页面，而是同一页面的不同缩放层级。
5. 默认语言改为 English；`EN / 中文` 切换不重置章节、进度和展开状态。
6. 前端采用 Svelte 5、SvelteKit static、TypeScript、D3、GSAP、SVG 与 Canvas。
7. 第一版不引入 ONNX Runtime，不在浏览器中运行模型。
8. 视觉区域使用全宽布局；解释性长文才限制行宽。小屏进入摘要布局。
9. 参考项目只作为交互与实现参考；如直接复制代码，记录来源并保留 MIT 许可。

## 后果

### 正面

- 动画可以从初始化连续走到 Decode，同时支持暂停、单步和回退。
- 复杂详情只在用户需要时出现，降低单屏密度。
- Attention、MoE/W8A8 和 TP 可以共享同一播放时钟和真实性规则。
- 静态站仍可离线运行，部署简单。
- English 默认有利于术语与源码一致，中文模式保持教学可读性。

### 代价

- scroll、播放按钮和时间线必须由一个 Module 解决冲突，不能各自维护进度。
- 展开/收起需要稳定 element ID 和几何过渡，渲染测试比普通页面复杂。
- 中英文都要做视觉回归和文案完整性测试。
- 宽屏主体验需要为小屏维护独立摘要投影。

## 被拒绝的替代方案

### 单屏仪表盘

无法同时保证全局流程、矩阵细节、并行路径和解释的可读性。

### 静态图片/幻灯片轮播

不能支持 hover、点击展开、数据检查和连续路径追踪，也会误导用户对推理过程的理解。

### 每个章节独立页面

会破坏一次推理的连续心智模型，并增加跨页状态同步。

### 浏览器内实时推理

Qwen3.5-35B-A3B 不适合浏览器运行，也不符合可复现、离线和无后端的目标。

## 相关文件

- `docs/ARCHITECTURE.md`
- `docs/INTERACTION_DESIGN.md`
- `data/web/qwen35-a3b-w8a8-20260710-p4r4`
- [Transformer Explainer repository](https://github.com/poloclub/transformer-explainer)
- [Attention expansion implementation](https://github.com/poloclub/transformer-explainer/blob/main/src/components/AttentionMatrix.svelte)
- [Continuous flow timeline](https://github.com/poloclub/transformer-explainer/blob/main/src/utils/animation.ts)
