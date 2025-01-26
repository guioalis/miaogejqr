# 喵哥AI群管机器人

一个基于 GrammY 框架的 Telegram 群管理机器人，使用 Deno 部署。

## 功能特性

- AI 聊天功能 (基于 Gemini)
- 群管理功能
  - 警告用户 (`/warn`)
  - 删除消息 (`/del`)
  - 禁言用户 (`/mute`)
  - 解除禁言 (`/unmute`)
  - 设置群规则 (`/setrules`)
  - 清理消息 (`/clean`)
- 自动欢迎新成员
- 反垃圾功能
  - 自动检测刷屏
  - 删除垃圾消息

## 部署说明

### 本地运行

1. 安装 Deno
2. 克隆仓库
3. 配置 `config.js`
4. 运行命令:
5.  bash
deno task start


### Deno Deploy 部署

1. Fork 本仓库
2. 访问 [Deno Deploy](https://dash.deno.com)
3. 创建新项目
4. 关联 GitHub 仓库
5. 配置环境变量:
   - `BOT_TOKEN`
   - `GEMINI_API_KEY`
   - `ADMIN_IDS`

## 配置说明

在 `config.js` 中配置:
- BOT_TOKEN: Telegram 机器人 token
- GEMINI_API_KEY: Gemini API 密钥
- ADMIN_IDS: 管理员用户ID列表
