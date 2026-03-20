# CRIMS 变更记录

## 2026-03-19
- 变更主题：新增 CRIMS 项目总控 skill
- 变更原因：需要参考 `dayan-agent-system-orchestrator` 的结构，为智能服务系统项目建立同类型的项目 skill
- 影响范围：skill 文档层，不涉及业务代码
- 同步文档：
  - `SKILL.md`
  - `references/project-overview.md`
  - `references/architecture.md`
  - `references/database-design.md`
  - `references/api-event-contracts.md`
  - `references/frontend-code-structure.md`
  - `references/implementation-plan.md`
  - `references/progress-tracker.md`
  - `references/third-party-dependencies.md`
  - `checklists/doc-sync-checklist.md`
  - `checklists/github-sync-checklist.md`
- 备注：内容以 `project introduce.md` 为首轮事实来源

## 2026-03-19（第二轮）
- 变更主题：基于真实代码结构增强 CRIMS 项目总控 skill
- 变更原因：用户要求扫描整个项目代码，不能只基于 `project introduce.md`
- 影响范围：skill 文档层，不涉及业务代码
- 新增/更新重点：
  - 补充三端真实目录与入口文件
  - 补充 B端 / C端 实际模块落位
  - 补充 `dataService.ts` 导出函数与 `geminiService.ts` AI 能力映射
  - 补充 C端 `App.tsx`、`Appointment.tsx`、`Home.tsx`、`Chat.tsx` 的页面内联业务逻辑说明
  - 补充后端 `gemini-proxy` 的实际代理链路说明
  - 新增 `references/repo-file-map.md`

## 2026-03-21
- 变更主题：B/C 端联调优化、服务目录接库与清理测试回写
- 变更原因：围绕 C端“我的”页、预约页、B端反馈中心、B端服务目录管理完成一轮真实接库、联调修复与非功能性代码清理，并要求同步到项目总控 skill
- 影响范围：业务代码 + skill 文档
- 代码侧重点：
  - C端“我的”页改为真实读写 `customers.nickname / phone / preferences / settings`
  - C端售后提交与列表改为真实读写 `feedbacks.request_type / request_status / handling_note / handled_at`
  - B端反馈中心支持售后工单状态流转与处理备注回写
  - B端新增服务目录管理页，预约结算/客户消费优先读取 `services_catalog`
  - C端预约页优先读取 `services_catalog`，修复服务价格首屏 88 → 35 闪烁
  - 完成一轮 cleanup：删除无用 import / 无用 prop、合并重复 fallback 逻辑、减少重复解析、统一用户侧文案
- 同步文档：
  - `references/progress-tracker.md`
  - `references/change-log.md`
- 备注：本轮以“不新增功能，只做测试与优化”为约束；仍保留少量服务常量兜底逻辑，供数据库不可用时回退

## 2026-03-21（优化续轮）
- 变更主题：My 页面拆分、服务目录彻底去常量兜底依赖、提示文案统一
- 变更原因：用户要求在不新增业务功能的前提下，继续做代码结构优化、删除无用代码、统一口径并同步 skill 文档
- 影响范围：业务代码 + skill 文档
- 代码侧重点：
  - C端新增 `services/serviceCatalog.ts`，统一读取 `services_catalog`
  - C端新增 `pages/my/shared.ts` 与 `pages/my/MyDialogs.tsx`，从 `My.tsx` 中拆出共享类型/工具与弹窗实现
  - C端 `Appointment.tsx`、`My.tsx`、`geminiService.ts` 去除 `SERVICES_LIST` 依赖，改为服务目录数据库来源
  - B端 `CustomerList.tsx`、`AppointmentManager.tsx` 去除 `SERVICES_CATALOG` fallback 依赖，删除 `-B/constants.ts`
  - 统一用户侧与 B端提示文案，减少 Supabase/SQL/权限等实现细节暴露
- 同步文档：
  - `references/progress-tracker.md`
  - `references/change-log.md`
- 备注：本轮不新增业务能力，主要目标为结构整理与活跃代码去冗余
