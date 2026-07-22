# 视频脚本创作智能体

基于抖音爆款视频灵感，为产品生成原创短视频脚本的在线智能体。

## 技术栈

- Next.js 16 + React 19 + TypeScript 5
- Tailwind CSS 4
- Framer Motion（微动效）
- Phosphor Icons
- IndexedDB（浏览器本地持久化）

## 设计原则

前端采用 [taste-skill](https://github.com/leonxlnx/taste-skill) 反“slop”设计原则：

- 单一低饱和强调色（amber），避免蓝紫“AI 美学”。
- 左侧固定导航 + 非对称内容布局。
- 编辑感排版与有意图的留白。
- 克制、细腻的 Framer Motion 动效。

## 本地启动

```bash
npm install
# 确保 .env.local 中已配置 AI Gateway
npm run dev
```

> 注意：当前 `package.json` 的 `dev` 脚本已设置 `NEXT_PRIVATE_TURBOPACK_POSTCSS=false`，以绕过部分 Windows + 中文路径环境下 Turbopack 启动 PostCSS 子进程时出现的 `0xc0000142` 错误。若你将项目迁移到不含中文的路径，可移除此环境变量。

打开 [http://localhost:3000](http://localhost:3000)。

## 环境变量

复制 `.env.local.example` 为 `.env.local` 并填写：

```bash
AI_GATEWAY_BASE_URL=https://yunwu.ai/v1beta
AI_GATEWAY_MODEL=gemini-3.1-flash-lite
AI_GATEWAY_API_KEY=your-api-key
```

`.env.local` 已加入 `.gitignore`，不会进入版本控制。

## 功能模块

- **概览**：统计选题、产品、脚本数量，显示系统预检状态。
- **抓取**：自然语言输入 → AI 解析计划 → 确认 → 异步任务 → 保存选题。
- **选题库**：查看、搜索、删除已抓取的抖音视频选题。
- **产品库**：维护公司产品资料、卖点、事实依据与禁用声明。
- **脚本库**：选择产品 + 选题，批量生成 1–10 条原创脚本。

## 当前状态

- 抖音采集改为用户浏览器扩展：搜索、详情、发布时间和临时媒体地址均来自用户自己的 Chrome 与抖音登录态，线上服务器不再依赖 OpenCLI 或服务器本机浏览器。
- 扩展回传候选后，服务器会下载临时视频；超过 14MB 时用内置 FFmpeg 压缩，再交给多模态 AI 解析原文、画面和结构。
- 抓取失败时不再自动退回模拟数据，而是将任务标记为 failed 并返回错误信息，便于排查真实抓取问题。
- 多实例任务队列尚未实现（首版用内存 Map + 轮询）。

## 浏览器扩展

1. 在抓取页下载 `video-script-browser-extension.zip` 并解压。
2. 打开 Chrome 的 `chrome://extensions`，开启“开发者模式”，选择“加载已解压的扩展程序”，选中解压后的目录。
3. 点击扩展图标，填写线上网站地址（本地开发填写 `http://localhost:3000`），点击“保存并授权本站”。
4. 在同一个 Chrome 中登录抖音，回到抓取页点击“重新检测”。显示“已连接”后即可创建任务。

扩展只获得两类权限：`douyin.com`，以及用户在扩展弹窗中主动填写并授权的网站来源。抓取任务使用一次性令牌回传，AI Gateway 密钥不会发送给扩展。

## 脚本

```bash
npm run dev      # 开发服务器
npm run build    # 生产构建
npm run lint     # ESLint 检查
```
