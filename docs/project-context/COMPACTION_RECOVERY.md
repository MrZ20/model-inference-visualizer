# 上下文压缩恢复协议

## 1. 触发条件

出现以下任一情况时，必须执行完整恢复：

- 系统明确给出 conversation summary、compaction 或 condensed context；
- 聊天历史明显缺失，只剩阶段摘要；
- 执行者不确定视觉稿、当前 Gate、用户上次验收结论或下一步；
- 当前实现、`MEMORY.md` 与用户反馈相互矛盾；
- 任务中断后重新进入仓库。

## 2. 恢复步骤

### A. 先停止扩展实现

不要先改 UI，不要从现有代码猜产品意图，不要重复跑 SSH/NPU。先向用户简短说明正在从持久化档案恢复。

### B. 读取持久化上下文

从仓库根目录依次读取：

```bash
sed -n '1,240p' docs/project-context/README.md
sed -n '1,320p' docs/project-context/CHAT_TIMELINE.md
sed -n '1,360p' docs/project-context/MASTER_PLAN.md
sed -n '1,320p' docs/project-context/VISUAL_INTERACTION_CONTRACT.md
sed -n '1,280p' docs/project-context/CURRENT_STATE.md
sed -n '1,260p' docs/project-context/COMPACTION_RECOVERY.md
sed -n '1,260p' MEMORY.md
sed -n '1,240p' TASKS.md
```

前端工作还要读取 `web/AGENTS.md`，并实际查看 `docs/assets/p5-fused-long-scroll-direction.png`。

### C. 恢复仓库现实

```bash
git status --short --branch
git diff --cached --stat
git log --oneline --decorate -5
```

检查 staged、unstaged 和 untracked 文件，保护用户已有改动。`CURRENT_STATE.md` 如果与 Git 不一致，先更新它。

### D. 做一次对齐复述

继续工作前，在 commentary 中用四句话说明：

1. 北极星与选定视觉方向；
2. 当前数据与真实性边界；
3. 当前阶段和用户验收状态；
4. 本轮唯一允许推进的大步骤。

复述不是让用户重新回答全部问题，而是让用户能及时发现恢复错误。

## 3. 每个大步骤结束后的写回

1. 将新的用户指令追加到 `CHAT_TIMELINE.md`；能逐字保留时用原话。
2. 将仓库、数据、测试、已知问题、验收和下一步更新到 `CURRENT_STATE.md`。
3. 产品或交互边界变化时更新 `MASTER_PLAN.md` / `VISUAL_INTERACTION_CONTRACT.md`。
4. 新架构决定写 ADR，再在 `MEMORY.md` 留一行摘要。
5. 更新 `TASKS.md` 的 Gate；用户未验收时不得写成“已通过”。
6. 运行与风险相称的客观检查，记录命令与结果。
7. 暂存相关文件；未经用户明确授权，不提交、不推送。
8. 按约定停下等待该大步骤验收。

## 4. 冲突处理

- 用户最新明确要求优先，更新档案后执行。
- 视觉稿与当前 UI 冲突时，以已经选定的视觉稿和交互契约为准；当前 UI 只是待修实现。
- 测试通过但用户实际无法操作时，Gate 失败；先复现用户路径并补回归测试。
- 报告称“passed”但用户否决时，报告必须标记为被用户验收推翻，不能继续作为完成证据。
- 不确定某段聊天是否逐字准确时写“重建摘要”，不能补写想象中的对话。

## 5. 恢复完成检查表

```text
North star:
Selected visual:
Current run/data:
Current Git state:
Current phase:
Last accepted gate:
Unaccepted findings:
Allowed next step:
Actions requiring approval:
```

填不完整就不能进入下一阶段。

## 6. 机制边界

模型无法在压缩后自动取回平台未提供的逐字历史。因此真正可靠的办法是：在消息仍可见时把关键原话和决定写入仓库；压缩后按本协议重读。这个限制必须如实说明，不能声称已经恢复了不可见的完整逐字聊天。
