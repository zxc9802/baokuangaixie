# Next.js 初始化设计

## 目标

在当前空目录 `D:\视频脚本写作` 中创建一个可直接开发的 Next.js 项目。

## 技术选择

- 使用官方 `create-next-app` 初始化。
- 使用 npm 管理依赖。
- 使用 TypeScript、App Router、Tailwind CSS 和 ESLint。
- 源代码放在 `src/` 目录。
- 使用默认的 `@/*` 导入别名。
- 保留官方默认首页，不添加业务功能或额外依赖。

## 项目结构

初始化后，应用入口位于 `src/app/`，全局样式位于 `src/app/globals.css`，静态资源位于 `public/`。配置文件使用 `create-next-app` 当前版本生成的官方默认格式。

## 验证标准

- 依赖安装成功。
- ESLint 检查通过。
- Next.js 生产构建成功。
- 除脚手架默认内容外，不引入额外功能。
