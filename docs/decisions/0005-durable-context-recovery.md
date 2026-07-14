# ADR 0005：上下文压缩后的持久化恢复

- 状态：Accepted
- 日期：2026-07-13
- 决策人：用户与项目执行者

## 背景

原 `MEMORY.md` 记录了大量模型事实和阶段决定，但没有完整保存用户原话、视觉稿被选择的原因、两次失败验收和压缩后的强制读取顺序。对话自动压缩后，后续实现因此可能从当前代码反推意图，并偏离已经确认的长页面、连续动态图和 Focus Scene 方向。

## 决策

1. 建立 `docs/project-context/`，分别保存对话时间线、总方案、视觉交互契约、当前状态和压缩恢复协议。
2. `MEMORY.md` 只作快速摘要，不再是唯一长期上下文。
3. 根级 `AGENTS.md` 强制要求在重大工作和每次上下文压缩后，按 manifest 重读全部需求、状态、ADR、视觉稿和 Git 现实。
4. 当前 UI 和测试结果不是产品意图的权威来源；选定视觉稿和用户明确决定优先。
5. 每个大步骤结束时写回时间线和当前状态，并等待用户验收。
6. 被平台压缩后不可见的逐字聊天不得编造，只能标记为重建摘要。

## 后果

- 会增加少量文档维护成本，但换取跨压缩、跨会话的可审计恢复。
- 产品/视觉验收与自动化测试被明确分离，用户否决会重新打开阶段 Gate。
- 新决定必须同时更新权威方案和摘要，避免 memory 与实现再次单独演化。

## 相关文件

- `AGENTS.md`
- `docs/project-context/CONTEXT_MANIFEST.md`
- `docs/project-context/COMPACTION_RECOVERY.md`
- `docs/project-context/VISUAL_INTERACTION_CONTRACT.md`
- `MEMORY.md`
