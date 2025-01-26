import { Bot, Context, session } from "https://deno.land/x/grammy/mod.ts";
import { conversations } from "https://deno.land/x/grammy_conversations/mod.ts";
import { aiHandler } from "./handlers/ai.js";
import { adminHandler } from "./handlers/admin.js";
import { config } from "./config.js";

// 创建机器人实例
const bot = new Bot(config.BOT_TOKEN);

// 添加会话中间件
bot.use(session({
  initial: () => ({
    isAdmin: false,
    warnings: 0,
    spamCount: 0,
    lastMessageTime: 0,
  })
}));

// 添加会话支持
bot.use(conversations());

// 处理 /start 命令
bot.command("start", async (ctx) => {
  await ctx.reply("喵~ 我是群管机器人！我可以帮助管理群组，也可以和大家聊天哦！");
});

// 添加 AI 处理器
bot.on("message", aiHandler);

// 添加管理员命令处理器
bot.use(adminHandler);

// 处理新成员加入
bot.on("chat_member", async (ctx) => {
  if (ctx.chatMember.new_chat_member.status === "member") {
    await ctx.reply(`欢迎 ${ctx.chatMember.new_chat_member.user.first_name} 加入我们的群组！\n请遵守群规哦 =͟͟͞͞ʕ•̫͡•ʔ`);
  }
});

// 添加反垃圾处理
bot.on("message", async (ctx, next) => {
  const now = Date.now();
  const timeDiff = now - ctx.session.lastMessageTime;
  
  // 检查发消息频率
  if (timeDiff < 1000) { // 小于1秒
    ctx.session.spamCount++;
    if (ctx.session.spamCount >= 5) {
      try {
        await ctx.deleteMessage();
        await ctx.reply("检测到刷屏行为，请注意群规！");
        ctx.session.spamCount = 0;
      } catch (error) {
        console.error("删除垃圾消息失败:", error);
      }
      return;
    }
  } else {
    ctx.session.spamCount = 0;
  }
  
  ctx.session.lastMessageTime = now;
  await next();
});

// 启动机器人
bot.start();
console.log("机器人已启动！"); 