# 上下文清单

> 任何执行者在上下文压缩、会话恢复或准备重大修改时，都必须逐项读取并勾选。不得用 `MEMORY.md` 替代本清单。

## 必读文件

- [ ] `model-inference-visualizer-desktop-particle-flow-agent-plan.md`（当前桌面端 Global Flow 重构的最高优先级方案，必须完整读取）
- [ ] `docs/project-context/README.md`
- [ ] `docs/project-context/CHAT_TIMELINE.md`
- [ ] `docs/project-context/MASTER_PLAN.md`
- [ ] `docs/project-context/VISUAL_INTERACTION_CONTRACT.md`
- [ ] `docs/project-context/CURRENT_STATE.md`
- [ ] `docs/project-context/COMPACTION_RECOVERY.md`
- [ ] `MEMORY.md`
- [ ] `TASKS.md`
- [ ] `docs/decisions/0001-recorded-trace-and-eager-observability.md`
- [ ] `docs/decisions/0002-fusion-boundaries-and-tp-projection.md`
- [ ] `docs/decisions/0003-derived-attention-from-real-qkv.md`
- [ ] `docs/decisions/0004-long-form-interactive-player.md`
- [ ] `docs/decisions/0005-durable-context-recovery.md`
- [ ] `docs/decisions/0006-separate-view-and-inference-cursor.md`
- [ ] `docs/decisions/0007-independent-camera-follow-during-playback.md`
- [ ] `docs/decisions/0008-natural-document-flow-for-chapters.md`
- [ ] `docs/decisions/0009-deterministic-desktop-global-flow.md`
- [ ] `web/AGENTS.md`（修改前端时）

## 必看资产

- [ ] `docs/assets/p5-fused-long-scroll-direction.png`：历史页面与 Focus Scene 视觉上下文；不再约束本轮桌面 Global Flow 的具体前端设计。
- [ ] `data/web/qwen35-a3b-w8a8-20260710-p4r4/manifest.json`：当前发布轨迹入口。
- [ ] `docs/reports/2026-07-12-p6-interaction-regression.md`：第一次错误验收。
- [ ] `docs/reports/2026-07-13-p6-dynamic-playback-regression.md`：第二次错误验收。
- [ ] `docs/reports/2026-07-13-p6.5-playback-navigation-regression.md`：页面/游标解耦、开始策略和滚动接管证据。
- [ ] `docs/reports/2026-07-13-p6.6-scroll-without-pausing-regression.md`：滚动不中断推理与独立镜头跟随证据。
- [ ] `docs/reports/2026-07-13-p6.7-decode-theme-regression.md`：Decode 浅色视觉一致性回归证据。
- [ ] `docs/reports/2026-07-13-p6.8-short-chapter-scroll-regression.md`：Initialize/Tokenize 短场景连续滚动回归证据。
- [ ] `docs/reports/2026-07-13-p6.9-all-chapter-scroll-regression.md`：所有章节自然文档流与连续滚动回归证据。
- [ ] `docs/audits/2026-07-13-p6-rebuild/AUDIT.md`：桌面重建后的真实浏览器与设计 QA。
- [ ] `docs/audits/2026-07-13-p7-readiness/AUDIT.md`：390px、键盘、Evidence dialog 与 URL locale 的当前补充证据。
- [ ] `docs/audits/2026-07-13-p8-completion/AUDIT.md`：原始要求逐项完成性证据与 Linear Attention 纠偏。
- [ ] `docs/audits/2026-07-14-desktop-particle-global-flow/AUDIT.md`：本次桌面粒子 Global Flow 的实现、证据缺口与未通过用户验收的 Gate。

## 必做仓库检查

- [ ] `git status --short --branch`
- [ ] `git diff --cached --stat`
- [ ] `git log --oneline --decorate -5`
- [ ] 确认当前阶段是否已经得到用户验收，不能仅依据测试报告判断。

## 恢复后必须能回答

1. 北极星是什么？
2. 选定视觉稿是哪一个？
3. 页面为什么不能做成仪表盘、A4 卡片或图片轮播？
4. 哪些数据是 captured、derived、structural、schematic？
5. 当前 run ID、模型结构、TP、MoE 和 Decode 事实是什么？
6. 当前大步骤是什么，用户是否已验收？
7. 下一步允许做什么，哪些动作仍需等待？

只要有一项答不上来，就先恢复上下文，不开始实现。
