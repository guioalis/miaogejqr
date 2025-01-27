# 喵哥AI群管机器人 🐱

一个基于 GrammY 框架的 Telegram 群组管理机器人，集成了 Gemini AI 对话功能。

## 主要功能 ✨

### 群组管理
- 自动欢迎新成员
- 用户验证系统
- 违规内容过滤
- 警告系统
- 禁言/踢出功能
- 批量删除消息

### AI 对话
- 集成 Gemini AI
- 上下文对话支持
- 智能回复
- 自动过滤敏感内容

### 积分系统
- 每日签到
- 连续签到奖励
- 积分排行榜
- 成就系统
- 积分商城

### 娱乐功能
- 五子棋游戏
- 骰子游戏
- 猜数字游戏
- 更多游戏开发中...

## 快速开始 🚀

1. 克隆项目并安装依赖：

git clone https://github.com/guioalis/miaogejqr.git

cd meow-bot

npm install


2. 配置环境变量：

cp .env.example .env

编辑 .env 文件，填入你的 BOT_TOKEN 和 GEMINI_API_KEY


3. 使用 Docker 启动：

docker-compose up -d


## 管理员命令 👮

- `/ban` - 踢出用户
- `/mute` - 禁言用户
- `/unmute` - 解除禁言
- `/warn` - 警告用户
- `/unwarn` - 删除警告
- `/clean` - 批量删除消息
- `/tmute` - 临时禁言
- `/verify` - 手动验证用户

## 用户命令 👥

- `/start` - 开始使用机器人
- `/sign` - 每日签到
- `/gomoku` - 开始五子棋游戏
- 直接发送消息即可与 AI 对话

## 技术栈 🛠

- Node.js
- GrammY
- Docker
- Gemini AI API

## 贡献 🤝

欢迎提交 Issue 和 Pull Request！

## 许可证 📄

MIT License
