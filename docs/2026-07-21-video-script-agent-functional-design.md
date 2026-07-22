# 视频脚本创作智能体：功能与技术设计

状态：待确认
日期：2026-07-21
范围：功能逻辑、数据、服务接口和运行链路；不包含 UI 视觉与交互设计。

## 1. 目标

用户用自然语言描述想找的爆款视频，系统先把描述解析成明确的抓取计划，等待用户确认。确认后，系统通过 OpenCLI 使用已登录的抖音浏览器会话抓取候选视频，只保留最近六个月发布的内容，按点赞数从高到低选出用户要求的数量。

系统随后下载入选视频的临时副本，提取语音并生成原文转写，再由 AI 为每条原文生成一个总结性标题。标题、原文和来源信息组成选题库。用户在浏览器内维护公司产品资料作为案例库，最后选择一条或多条选题以及一个产品，一次生成 1 到 10 条脚本。

## 2. 明确边界

### 2.1 首版包含

- 自然语言抓取要求解析。
- 抓取计划确认后才访问抖音。
- OpenCLI 抖音候选视频采集。
- 最近六个月的严格日期过滤。
- 候选池内按点赞数降序筛选。
- 视频临时下载、语音转写、原文整理和总结性标题生成。
- 浏览器 IndexedDB 中的选题库、案例库和生成脚本库。
- 一批选择一个产品、一个或多个选题，生成 1 到 10 条脚本。
- 本地运行验证，以及同一套服务接口迁移到已安装 OpenCLI 的服务器。

### 2.2 首版不包含

- UI 视觉、布局和交互方案。
- 抖音发布、点赞、评论或私信操作。
- 用户账号体系、团队共享和云端资料同步。
- 原视频的永久保存。
- 视频画面内文字 OCR。首版“原文”定义为视频语音转写加抖音文案；画面字幕 OCR 可作为后续增强。
- 对“抖音全站点赞最高”的承诺。点赞排序只针对本次实际抓到的候选池。

## 3. 已核实的 OpenCLI 能力与缺口

本机已安装 OpenCLI 1.8.6，Daemon 已能在 19825 端口运行。当前 Browser Bridge 扩展尚未连接，所以还不能完成真实抖音抓取。Chrome 中已打开官方扩展安装页，安装扩展并登录抖音后才能做真实链路验证。

OpenCLI 自带的 `douyin search` 可以按关键词抓取视频卡片并返回点赞数，但有以下限制：

- 单次最多返回 30 条。
- 返回值没有发布时间。
- 返回值没有播放或下载地址。
- 未登录抖音时不会返回搜索结果。

`douyin user-videos` 有播放地址，但它要求已知作者的 `sec_uid`，不能代替关键词搜索。

因此不能只调用现成命令完成“半年内、点赞最高、下载并解析”的要求。需要在本项目中维护一个小型 OpenCLI 插件，补齐候选翻页、发布时间、播放地址和作者标识。插件代码跟随项目版本管理，通过 `opencli plugin install file:///绝对路径` 安装到本机或服务器。

## 4. 总体架构

```text
浏览器
  ├─ 抓取要求与确认后的 SearchPlan
  ├─ IndexedDB：选题、产品、生成脚本
  └─ 调用本地或服务器 API
              │
              ▼
Next.js 服务端 API
  ├─ AI Gateway：要求解析、标题总结、脚本生成
  ├─ Capture Orchestrator：异步任务与进度
  ├─ OpenCLI Runner：固定参数调用，不经过 shell
  ├─ Media Pipeline：下载、FFmpeg 提取音频、ASR
  └─ 临时任务目录：任务结束后清理
              │
              ▼
OpenCLI 项目插件 + Browser Bridge + 已登录的抖音 Chrome
```

持久业务数据只保存在用户浏览器。服务端只保存运行任务、日志和临时媒体，不建立选题库或案例库数据库。

## 5. 抓取要求解析

### 5.1 输入

示例：

> 找 20 条近半年发布的职场女性成长类视频，排除纯鸡汤，优先真实故事，按点赞最高排序。

### 5.2 AI 输出契约

```json
{
  "summary": "职场女性真实成长故事",
  "queries": ["职场女性成长", "女性职场逆袭", "职场真实故事"],
  "includeKeywords": ["真实故事", "成长"],
  "excludeKeywords": ["纯鸡汤"],
  "requestedCount": 20,
  "publishedWithinMonths": 6,
  "sortBy": "likes_desc"
}
```

服务端必须用固定 Schema 校验 AI 输出。AI 不能修改以下系统约束：

- `publishedWithinMonths` 固定为 6，除非用户明确指定更短时间。
- `sortBy` 固定为 `likes_desc`。
- `requestedCount` 首版建议限制在 1 到 100。
- 单个抓取任务最多 10 个查询词。

解析结果只是计划，用户确认前不得调用 OpenCLI。

## 6. 候选抓取与筛选

### 6.1 自定义 OpenCLI 插件

建议插件目录：

```text
integrations/opencli-plugin-script-agent/
```

建议命令：

```text
opencli script-agent douyin-candidates <query> \
  --limit <候选数> \
  --published-after <ISO时间> \
  -f json
```

每条返回值不超过 12 个顶层字段：

```json
{
  "aweme_id": "123",
  "desc": "视频文案",
  "author_name": "作者",
  "author_sec_uid": "sec_uid",
  "url": "https://www.douyin.com/video/123",
  "created_at": "2026-06-10T08:00:00+08:00",
  "likes": 120000,
  "play_url": "https://...",
  "duration_seconds": 63,
  "cover_url": "https://..."
}
```

插件负责使用 Browser Bridge 中已登录的抖音页面，持续滚动或翻页，直到达到候选数量、没有更多结果，或触发安全上限。不得伪造缺失的日期或点赞数。

### 6.2 候选池规则

为保证筛选空间，系统抓取数量不是用户最终要求的数量，而是：

```text
候选目标数 = min(max(用户要求数 × 3, 30), 300)
```

多个查询词的结果合并后按 `aweme_id` 去重。

### 6.3 半年定义

“半年以内”定义为从任务开始时间向前减六个自然月，时区使用 `Asia/Shanghai`。例如任务在 2026-07-21 运行，则临界日期为 2026-01-21 同一时刻。

筛选顺序固定：

1. 丢弃没有可验证 `created_at` 的项目。
2. 丢弃早于临界日期的项目。
3. 应用包含词和排除词。
4. 按 `likes` 降序排序；点赞相同则按 `created_at` 降序。
5. 截取用户要求的数量。

如果合格数量不足，返回实际数量和不足原因，不能用过期视频补齐。

## 7. 视频解析链路

每个入选视频独立执行，单条失败不阻断整个任务：

1. 立即使用 `play_url` 下载临时 MP4，避免签名地址过期。
2. 用 FFmpeg 提取 16 kHz 单声道音频。
3. 调用可配置 ASR 服务生成带时间戳的原始转写。
4. 合并抖音文案和语音转写，由 AI 做轻量清理：去除口头重复，但不得改写事实或新增内容。
5. AI 根据完整原文生成一个总结性标题。
6. 返回浏览器保存所需的数据。
7. 删除 MP4 和音频临时文件。

只有 ASR 成功并得到非空转写，状态才能标记为 `analyzed`。不能把抖音卡片文案冒充完整视频原文。

单条状态：

```text
pending → downloading → transcribing → summarizing → analyzed
                                              └──────→ failed
```

## 8. 浏览器数据模型

IndexedDB 名称建议为 `video-script-agent`，版本为 `1`。

### 8.1 `topics` 选题库

```ts
type Topic = {
  id: string;
  awemeId: string;
  summaryTitle: string;
  originalText: string;
  sourceCaption: string;
  sourceUrl: string;
  authorName: string;
  publishedAt: string;
  likes: number;
  durationSeconds: number;
  searchPlanSummary: string;
  createdAt: string;
};
```

`awemeId` 建唯一索引，重复抓取同一视频时默认更新点赞数和分析内容，不新增重复选题。

### 8.2 `products` 公司案例库

```ts
type Product = {
  id: string;
  name: string;
  category: string;
  summary: string;
  targetAudience: string;
  sellingPoints: string[];
  usageScenarios: string[];
  factualClaims: string[];
  forbiddenClaims: string[];
  toneNotes: string;
  updatedAt: string;
};
```

`factualClaims` 是允许脚本使用的事实依据；AI 不得生成未包含在产品资料中的功效、数据、认证或承诺。

### 8.3 `scripts` 生成脚本库

```ts
type GeneratedScript = {
  id: string;
  title: string;
  angle: string;
  script: string;
  topicIds: string[];
  productId: string;
  productClaimsUsed: string[];
  createdAt: string;
};
```

浏览器只保存文本和元数据，不保存原始视频文件。

## 9. 脚本生成规则

一次生成请求必须满足：

- 选择一个产品。
- 选择至少一个选题。
- `count` 为 1 到 10 的整数。

API 输入包含选中选题的标题和原文、完整产品资料、目标生成数量。AI 必须返回准确数量的 JSON 数组，每条包含：

- `title`：脚本标题。
- `angle`：本条使用的创作角度。
- `script`：完整脚本文本。
- `sourceTopicIds`：实际参考的选题。
- `productClaimsUsed`：实际使用的产品事实。

生成约束：

- 学习选题的结构和切入角度，不得复制原文句子。
- 产品事实只能来自 `factualClaims`、卖点和使用场景。
- 不得使用 `forbiddenClaims`。
- 同一批多条脚本必须有不同的开场和核心角度。
- 结果数量不正确或 Schema 不合法时，服务端只允许一次结构修复重试。

## 10. 服务端 API 契约

### 10.1 环境预检

`GET /api/system/preflight`

返回：

- OpenCLI 是否存在及版本。
- Daemon 是否运行。
- Browser Bridge 是否连接。
- 抖音是否已登录。
- FFmpeg 是否存在。
- ASR 和 AI 配置是否齐全。

### 10.2 解析抓取计划

`POST /api/search-plans/parse`

输入自然语言要求，输出经过 Schema 校验的 `SearchPlan`，不执行抓取。

### 10.3 创建抓取任务

`POST /api/capture-jobs`

输入用户已经确认的 `SearchPlan`，返回 `202` 和 `jobId`。

### 10.4 查询抓取进度

`GET /api/capture-jobs/{jobId}`

任务阶段：

```text
queued
searching
filtering
downloading
transcribing
summarizing
complete | partial | failed | cancelled
```

完成或部分完成时返回可直接写入 IndexedDB 的 `Topic[]`，以及每个失败项目的明确原因。

### 10.5 生成脚本

`POST /api/scripts/generate`

输入选题、产品和生成数量，返回经过 Schema 校验的 `GeneratedScript[]`。服务端不保存这些业务数据。

## 11. 运行任务与临时数据

抓取和转写耗时较长，不能放在单个同步 HTTP 请求内。首版本地运行可使用单进程任务队列和任务临时目录：

```text
.data/jobs/<jobId>/
```

服务器部署若仍是单实例，也可沿用。若后续做多实例，再把任务状态迁移到 Redis 或数据库；首版不提前引入。

任务完成、失败或取消后清理媒体文件。任务状态保留短时间用于浏览器取回结果，默认 24 小时后清除。

## 12. 错误处理

- OpenCLI 不存在：预检直接失败，返回安装提示。
- Browser Bridge 未连接：禁止创建抓取任务。
- 抖音未登录或触发验证码：任务暂停并返回明确的人工处理状态，不尝试绕过。
- 某查询无结果：继续其他查询。
- 某视频没有发布时间：丢弃，不能视为半年内。
- 某视频下载或 ASR 失败：记录单条失败，其他视频继续。
- AI 标题生成失败：保留原始转写并标记待重试，不伪造标题。
- 合格视频不足：任务状态为 `partial`，返回实际数量。
- 浏览器 IndexedDB 写入失败：业务数据留在当前响应中供重试，服务端不静默宣称已入库。

## 13. 安全与实现约束

- Node.js 使用 `execFile` 或 `spawn` 调用 OpenCLI，并把参数逐项传递；禁止拼接 shell 命令。
- OpenCLI 命令、站点和参数由服务端白名单固定，用户不能提交任意 CLI 参数。
- AI 和 ASR 密钥只放服务端环境变量，不写入 IndexedDB。
- 日志不记录 Cookie、播放地址签名或完整密钥。
- 临时媒体目录不能位于公开静态目录。
- 遵守抖音平台规则和适用法律，仅处理用户有权访问和分析的内容。

## 14. 验证计划

### 14.1 单元测试

- 自然语言解析结果的 Schema 校验。
- 抓取数量边界：1、10、100 和非法值。
- 六个月临界时刻的包含与排除。
- 多查询结果按 `aweme_id` 去重。
- 缺少日期的项目必须被排除。
- 点赞降序和同点赞日期降序。
- 脚本生成数量必须为 1 到 10。
- 产品禁用声明不能出现在生成请求允许事实中。

### 14.2 OpenCLI 插件测试

- 用固定抓取 Fixture 验证输出字段和类型。
- `opencli browser verify` 验证适配器。
- 未登录、空结果、页面变化和超时均返回结构化错误。

### 14.3 本地真实验证

安装 Browser Bridge 并登录抖音后，用一个明确关键词抓取 3 条：

1. 三条都有可验证发布时间和点赞数。
2. 全部在六个月内。
3. 返回顺序与点赞数一致。
4. 至少一条成功完成下载、转写和标题总结。
5. 临时媒体在任务结束后被删除。

## 15. 实施顺序

1. **运行预检与 OpenCLI 插件**：先证明能稳定返回发布时间、点赞数和播放地址。
2. **筛选与异步任务**：完成去重、半年过滤、排序、进度和部分成功。
3. **视频解析**：接入下载、FFmpeg、ASR 和标题总结。
4. **浏览器数据契约**：实现 IndexedDB 读写，但不决定 UI。
5. **脚本生成**：接入产品事实约束和 1 到 10 条批量生成。
6. **服务器迁移验证**：复用同一预检和插件安装流程，验证服务器上的 Browser Bridge 与抖音登录态。

## 16. 验收标准

- 用户确认前不会访问抖音。
- 所有入选视频都有真实发布时间，且严格位于最近六个月内。
- 入选结果是实际候选池内点赞数最高的前 N 条。
- 每个成功选题都有来源 URL、点赞数、发布时间、完整语音原文和总结性标题。
- 选题、产品和生成脚本只持久化到用户浏览器。
- 一次可基于一个产品和一个或多个选题生成 1 到 10 条脚本。
- AI 不会自行编造产品事实。
- 任一单条视频失败不会抹掉其他成功结果。

## 17. 当前建议默认值

- 单任务最终抓取上限：100 条。
- 候选池倍率：3 倍，上限 300 条。
- 发布时间范围：六个自然月，`Asia/Shanghai`。
- 原文范围：语音转写加抖音文案，不做画面 OCR。
- 一个生成批次选择一个产品，最多生成 10 条。
- 任务临时状态保留：24 小时；媒体在处理完成后立即删除。

这些默认值可以在进入实现前调整，但不应在代码中悄悄改变。
