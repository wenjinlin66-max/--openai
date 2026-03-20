# CRIMS 进度跟踪

## 当前阶段
- 当前阶段：P2 代码落地与双端联调优化

## 当前目标
- 在不新增业务范围的前提下，持续对 B/C 端已实现能力做联调、清理、测试和文档回写

## 已完成模块
- 项目总览梳理
- B/C 端核心功能梳理
- 架构层次梳理
- 数据库核心表梳理
- 三端真实目录与入口文件梳理
- B端 `dataService.ts` / `geminiService.ts` 实际职责梳理
- C端 `App.tsx` 与关键页面内联逻辑梳理
- 后端 `gemini-proxy` 代理链路梳理
- C端“我的”页真实接入 `customers.nickname / phone / preferences / settings`
- C端售后服务真实接入 `feedbacks.request_type / request_status / handling_note / handled_at`
- B端反馈中心支持售后工单状态更新与处理备注回写
- B端新增服务目录管理页，C端预约页优先读取 `services_catalog`
- 完成一轮非功能性清理：去除冗余分支/无用 prop/无用 import，统一用户侧文案，修复服务价格闪烁
- 完成一轮针对近期改动文件的 LSP 诊断回归，结果为零错误
- `My.tsx` 已开始拆分为 `pages/my/shared.ts` 与 `pages/my/MyDialogs.tsx`，降低单文件复杂度
- C/B 端活跃代码已去除服务目录常量兜底依赖，统一改为数据库优先/数据库唯一来源
- C端 AI 客服服务介绍与 C端会员推荐已改为读取 `services_catalog`

## 进行中模块
- 项目总控 skill 代码落位化补强
- 继续推进会员中心与服务目录相关代码的细粒度组件化拆分

## 未开始模块
- 结合实际代码结构进一步细化文件级 reference
- 补充更具体的环境与部署文档
- 补充更细的 GitHub / 发布流程规范
- 若需要，可继续补“字段口径差异清单”和“B/C 端共享 schema 对齐清单"
- 若后续继续推进，可补服务目录 schema 与常量兜底策略的专题 reference

## 阻塞项
- 尚未基于完整代码树逐模块核对所有页面落位

## 风险项
- 当前事实主要来自 `project introduce.md`，后续若代码实现与文档不一致，需要再做一次对齐
- C端 部分数据结构与 B端 / 文档口径存在字段差异，例如 feedback 与 campaign 的字段命名
- 后端代理命名为 gemini-proxy，但运行时使用 OpenAI-compatible 转发链路，容易让后续维护者误解
- C端 `My.tsx` 仍承担较多 UI 与数据逻辑，后续若继续演进建议拆出 profile/member/after-sales hooks 或子组件
- 服务目录虽然已接入数据库，但 C端 AI 上下文与推荐逻辑仍部分依赖 `constants.ts` 服务常量作为兜底
- `My.tsx` 虽已初步拆分，但主体页面仍承担较多状态编排逻辑，后续若继续整理可再抽 hook

## 下一步动作
- 在真实开发推进时持续回写各专题文档
- 若后续继续完善 skill，可补一份“重构建议 reference”，把当前内联逻辑拆分路线记录下来
- 如继续做优化轮次，优先考虑：进一步拆分 My 页面状态 hook、为服务目录管理补自动化测试、梳理 AI 客服上下文缓存策略

## 文档同步状态
- 已完成首轮 skill 文档初始化，并基于真实仓库完成第二轮代码扫描增强
- 已同步 2026-03 的双端联调、服务目录接库、售后闭环落地与一轮清理测试结果
