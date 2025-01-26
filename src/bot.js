const { Bot, InlineKeyboard } = require("grammy");
const fetch = require("node-fetch");
require("dotenv").config();

// 创建机器人实例
const bot = new Bot(process.env.BOT_TOKEN);

// 配置项
const CONFIG = {
  muteTime: 3600, // 默认禁言时间（秒）
  maxWarnings: 3, // 警告次数上限
  badWords: ["脏话1", "脏话2", "广告词"], // 敏感词列表
  defaultMuteTime: 3600, // 默认禁言时间（秒）
  joinVerificationTimeout: 300, // 加入验证超时时间（秒）
  adminCommands: {
    ban: "踢出用户",
    mute: "禁言用户",
    unmute: "解除禁言",
    del: "删除消息",
    warn: "警告用户",
    unwarn: "删除警告",
    clean: "批量删除消息",
    tmute: "临时禁言（格式：/tmute 时间）",
    verify: "手动验证用户",
  },
  games: {
    dice: {
      minBet: 1,
      maxBet: 100
    },
    lottery: {
      price: 10,
      drawTime: 24 * 60 * 60 * 1000 // 24小时
    }
  },
  points: {
    daily: {
      min: 10,
      max: 50
    },
    streak: {
      bonus: 20, // 连续签到奖励
      maxDays: 7  // 最大连续天数
    }
  }
};

// 用户警告记录 (使用内存存储，重启后会重置)
const userWarnings = new Map();

// 添加待验证用户集合
const pendingVerifications = new Map(); // userId -> { timeout, messageId }

// 添加用户会话管理
const userSessions = new Map(); // userId -> { history: [], lastInteraction: timestamp }

// 会话配置
const SESSION_CONFIG = {
  maxHistory: 10, // 最大保留的对话轮数
  expirationTime: 30 * 60 * 1000, // 会话过期时间（30分钟）
  maxTokens: 1000, // 每条消息的最大token数
};

// 清理过期会话
setInterval(() => {
  const now = Date.now();
  for (const [userId, session] of userSessions.entries()) {
    if (now - session.lastInteraction > SESSION_CONFIG.expirationTime) {
      userSessions.delete(userId);
    }
  }
}, 5 * 60 * 1000); // 每5分钟清理一次

// 获取或创建用户会话
function getUserSession(userId) {
  let session = userSessions.get(userId);
  if (!session) {
    session = {
      history: [],
      lastInteraction: Date.now()
    };
    userSessions.set(userId, session);
  }
  return session;
}

// 更新用户会话
function updateUserSession(userId, userMessage, aiResponse) {
  const session = getUserSession(userId);
  session.history.push(
    { role: "user", content: userMessage },
    { role: "assistant", content: aiResponse }
  );
  
  // 保持历史记录在限制范围内
  if (session.history.length > SESSION_CONFIG.maxHistory * 2) {
    session.history = session.history.slice(-SESSION_CONFIG.maxHistory * 2);
  }
  
  session.lastInteraction = Date.now();
}

// 添加时间解析函数
function parseTime(timeStr) {
  const units = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400
  };
  
  const match = timeStr.match(/^(\d+)([smhd])$/);
  if (!match) return null;
  
  const [, num, unit] = match;
  return parseInt(num) * units[unit];
}

// 检查是否为管理员
async function isAdmin(ctx) {
  try {
    if (!ctx.chat?.type.includes("group")) return false;
    const member = await ctx.getChatMember(ctx.from.id);
    return ["creator", "administrator"].includes(member.status);
  } catch (error) {
    console.error("检查管理员权限失败:", error);
    return false;
  }
}

// 获取用户警告次数
function getWarnings(userId) {
  return userWarnings.get(userId) || 0;
}

// 添加警告
function addWarning(userId) {
  const warnings = getWarnings(userId) + 1;
  userWarnings.set(userId, warnings);
  return warnings;
}

// 删除警告
function removeWarning(userId) {
  const warnings = Math.max(0, getWarnings(userId) - 1);
  userWarnings.set(userId, warnings);
  return warnings;
}

// 添加用户数据存储
const userDatabase = new Map(); // userId -> { points, lastSign, signStreak, etc }

// 获取用户数据
function getUserData(userId) {
  if (!userDatabase.has(userId)) {
    userDatabase.set(userId, {
      points: 0,
      lastSign: null,
      signStreak: 0,
      totalSigns: 0,
      lastChecked: null
    });
  }
  return userDatabase.get(userId);
}

// 添加签到命令
bot.command("sign", async (ctx) => {
  if (!ctx.chat?.type.includes("group")) {
    return ctx.reply("喵~ 签到功能只能在群组中使用哦！");
  }

  const userId = ctx.from.id;
  const userData = getUserData(userId);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  if (userData.lastSign === today) {
    const keyboard = new InlineKeyboard()
      .text("👛 查看积分", `points_${userId}`)
      .text("🎮 游戏菜单", "games");
      
    return ctx.reply(
      `喵~ ${ctx.from.first_name}，你今天已经签到过啦！\n明天再来哦！`,
      { reply_markup: keyboard }
    );
  }

  // 计算连续签到
  const yesterday = today - 24 * 60 * 60 * 1000;
  if (userData.lastSign === yesterday) {
    userData.signStreak = Math.min(userData.signStreak + 1, CONFIG.points.streak.maxDays);
  } else {
    userData.signStreak = 1;
  }

  // 计算积分奖励
  const basePoints = Math.floor(Math.random() * 
    (CONFIG.points.daily.max - CONFIG.points.daily.min + 1)) + 
    CONFIG.points.daily.min;
  const streakBonus = (userData.signStreak > 1) ? CONFIG.points.streak.bonus : 0;
  const totalPoints = basePoints + streakBonus;

  userData.points += totalPoints;
  userData.lastSign = today;
  userData.totalSigns += 1;

  // 生成签到消息
  let signMessage = `${ctx.from.first_name} 签到成功！喵~ 🌟\n\n`;
  signMessage += `基础奖励：${basePoints} 积分\n`;
  signMessage += `连续签到：${userData.signStreak}天`;
  
  if (streakBonus > 0) {
    signMessage += ` (+${streakBonus}积分)\n`;
  } else {
    signMessage += ` (明天开始有连续奖励哦~)\n`;
  }
  
  signMessage += `总计获得：${totalPoints} 积分\n\n`;
  signMessage += `当前积分：${userData.points}\n`;
  signMessage += `累计签到：${userData.totalSigns}天\n\n`;

  if (userData.signStreak >= CONFIG.points.streak.maxDays) {
    signMessage += "🎉 恭喜达到最大连续签到天数！继续保持哦~";
  } else {
    signMessage += `继续签到 ${CONFIG.points.streak.maxDays - userData.signStreak} 天可获得最大奖励！`;
  }

  const keyboard = new InlineKeyboard()
    .text("🎮 游戏菜单", "games")
    .text("👛 查看积分", `points_${userId}`)
    .row()
    .text("📊 排行榜", "leaderboard")
    .text("🎁 积分商城", "shop");

  await ctx.reply(signMessage, { reply_markup: keyboard });

  // 检查里程碑成就
  checkSignMilestones(ctx, userData);
});

// 里程碑检查
async function checkSignMilestones(ctx, userData) {
  const milestones = {
    7: "🌟 连续签到7天",
    30: "🌙 累计签到30天",
    100: "⭐ 累计签到100天",
    365: "🌞 累计签到365天"
  };

  const streakMilestones = {
    3: 50,
    7: 100,
    14: 200,
    30: 500
  };

  // 检查连续签到里程碑
  for (const [days, bonus] of Object.entries(streakMilestones)) {
    if (userData.signStreak === parseInt(days)) {
      userData.points += bonus;
      await ctx.reply(
        `🎊 恭喜达成连续签到${days}天！\n` +
        `奖励 ${bonus} 积分！\n` +
        `继续保持哦~ 喵~`
      );
    }
  }

  // 检查累计签到里程碑
  for (const [days, title] of Object.entries(milestones)) {
    if (userData.totalSigns === parseInt(days)) {
      await ctx.reply(
        `🏆 恭喜获得成就：${title}\n` +
        `累计签到 ${days} 天！\n` +
        `继续加油哦~ 喵~`
      );
    }
  }
}

// 查看积分
bot.callbackQuery(/^points_(\d+)$/, async (ctx) => {
  const userId = parseInt(ctx.match[1]);
  const userData = getUserData(userId);

  if (userId !== ctx.from.id) {
    return ctx.answerCallbackQuery({
      text: "喵~ 只能查看自己的积分哦！",
      show_alert: true
    });
  }

  await ctx.answerCallbackQuery();
  
  const today = new Date().setHours(0,0,0,0);
  const keyboard = new InlineKeyboard()
    .text("🎮 游戏菜单", "games")
    .text("📊 排行榜", "leaderboard")
    .row()
    .text("🎁 积分商城", "shop")
    .text(userData.lastSign === today ? "✅ 已签到" : "📝 去签到", "sign_reminder");

  await ctx.editMessageText(
    `${ctx.from.first_name} 的积分信息：\n\n` +
    `当前积分：${userData.points}\n` +
    `连续签到：${userData.signStreak}天\n` +
    `累计签到：${userData.totalSigns}天\n\n` +
    `今日签到：${userData.lastSign === today ? "✅ 已签到" : "❌ 未签到"}\n` +
    `签到提醒：${userData.lastSign === today ? 
      "记得明天继续来签到哦~" : 
      "快来领取今天的奖励吧！"}`,
    { reply_markup: keyboard }
  );
});

// 错误处理中间件
bot.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error("Bot error:", error);
    await ctx.reply("喵呜~ 发生了一些错误，请稍后再试").catch(() => {});
  }
});

// 处理 /start 命令
bot.command("start", async (ctx) => {
  const keyboard = new InlineKeyboard()
    .text("群组规则", "rules")
    .text("使用帮助", "help");
  
  await ctx.reply(
    "喵~ 我是喵哥AI群管机器人！我可以帮助管理群组和回答问题哦 😺",
    { reply_markup: keyboard }
  );
});

// 警告命令
bot.command("warn", async (ctx) => {
  if (!await isAdmin(ctx)) {
    return ctx.reply("喵~ 只有管理员才能使用这个命令哦！");
  }

  const replyToMessage = ctx.message.reply_to_message;
  if (!replyToMessage) {
    return ctx.reply("喵~ 请回复要警告的用户的消息！");
  }

  const userId = replyToMessage.from.id;
  const warnings = addWarning(userId);
  
  if (warnings >= CONFIG.maxWarnings) {
    try {
      await ctx.banChatMember(userId);
      userWarnings.delete(userId);
      await ctx.reply(`用户 ${replyToMessage.from.first_name} 已达到警告上限，已被踢出群组！喵~`);
    } catch (error) {
      await ctx.reply("喵呜~ 踢出用户失败，可能是权限不足");
    }
  } else {
    await ctx.reply(
      `已警告用户 ${replyToMessage.from.first_name}！\n当前警告次数：${warnings}/${CONFIG.maxWarnings}`
    );
  }
});

// 删除警告命令
bot.command("unwarn", async (ctx) => {
  if (!await isAdmin(ctx)) {
    return ctx.reply("喵~ 只有管理员才能使用这个命令哦！");
  }

  const replyToMessage = ctx.message.reply_to_message;
  if (!replyToMessage) {
    return ctx.reply("喵~ 请回复要删除警告的用户的消息！");
  }

  const userId = replyToMessage.from.id;
  const warnings = removeWarning(userId);
  await ctx.reply(
    `已删除用户 ${replyToMessage.from.first_name} 的一个警告！\n当前警告次数：${warnings}/${CONFIG.maxWarnings}`
  );
});

// 解除禁言命令
bot.command("unmute", async (ctx) => {
  if (!await isAdmin(ctx)) {
    return ctx.reply("喵~ 只有管理员才能使用这个命令哦！");
  }

  const replyToMessage = ctx.message.reply_to_message;
  if (!replyToMessage) {
    return ctx.reply("喵~ 请回复要解除禁言的用户的消息！");
  }

  try {
    await ctx.restrictChatMember(replyToMessage.from.id, {
      permissions: {
        can_send_messages: true,
        can_send_media_messages: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true,
      },
    });
    await ctx.reply(`已解除用户 ${replyToMessage.from.first_name} 的禁言！喵~`);
  } catch (error) {
    await ctx.reply("喵呜~ 操作失败，可能是权限不足");
  }
});

// 管理员命令
bot.command("ban", async (ctx) => {
  if (!await isAdmin(ctx)) {
    return ctx.reply("喵~ 只有管理员才能使用这个命令哦！");
  }
  
  const replyToMessage = ctx.message.reply_to_message;
  if (!replyToMessage) {
    return ctx.reply("喵~ 请回复要禁言的用户的消息！");
  }

  try {
    await ctx.banChatMember(replyToMessage.from.id);
    await ctx.reply(`已将用户 ${replyToMessage.from.first_name} 踢出群组！喵~`);
  } catch (error) {
    await ctx.reply("喵呜~ 操作失败，可能是权限不足");
  }
});

// 禁言命令
bot.command("mute", async (ctx) => {
  if (!await isAdmin(ctx)) {
    return ctx.reply("喵~ 只有管理员才能使用这个命令哦！");
  }

  const replyToMessage = ctx.message.reply_to_message;
  if (!replyToMessage) {
    return ctx.reply("喵~ 请回复要禁言的用户的消息！");
  }

  try {
    await ctx.restrictChatMember(replyToMessage.from.id, {
      until_date: Math.floor(Date.now() / 1000) + 3600, // 禁言1小时
      permissions: {
        can_send_messages: false,
        can_send_media_messages: false,
        can_send_other_messages: false,
      },
    });
    await ctx.reply(`已将用户 ${replyToMessage.from.first_name} 禁言一小时！喵~`);
  } catch (error) {
    await ctx.reply("喵呜~ 操作失败，可能是权限不足");
  }
});

// 删除消息命令
bot.command("del", async (ctx) => {
  if (!await isAdmin(ctx)) {
    return ctx.reply("喵~ 只有管理员才能使用这个命令哦！");
  }

  const replyToMessage = ctx.message.reply_to_message;
  if (!replyToMessage) {
    return ctx.reply("喵~ 请回复要删除的消息！");
  }

  try {
    await ctx.deleteMessage(replyToMessage.message_id);
    await ctx.deleteMessage(); // 删除命令消息
  } catch (error) {
    await ctx.reply("喵呜~ 删除消息失败，可能是权限不足");
  }
});

// 处理文本消息
bot.on("message:text", async (ctx) => {
  // 检查是否包含敏感词
  const hasBadWord = CONFIG.badWords.some(word => ctx.message.text.includes(word));
  if (hasBadWord) {
    try {
      await ctx.deleteMessage();
      const warnings = addWarning(ctx.from.id);
      let message = `喵~ 请不要发送不当内容哦！\n当前警告次数：${warnings}/${CONFIG.maxWarnings}`;
      
      if (warnings >= CONFIG.maxWarnings) {
        await ctx.banChatMember(ctx.from.id);
        userWarnings.delete(ctx.from.id);
        message += "\n已达到警告上限，您已被踢出群组！";
      }
      
      await ctx.reply(message);
      return;
    } catch (error) {
      console.error("处理违规消息失败:", error);
    }
  }

  // 处理正常消息
  try {
    const userId = ctx.from.id;
    const userSession = getUserSession(userId);
    const userMessage = ctx.message.text;

    // 显示输入状态
    await ctx.replyWithChatAction("typing");

    // 准备消息历史
    const messages = [
      {
        role: "system",
        content: `你是一个友善的AI助手，名叫喵哥。请用简短、可爱的语气回答问题。
当前时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
你可以记住用户的上下文，并基于历史对话进行回答。
如果用户问题涉及敏感或不当内容，请委婉拒绝。
请保持回答简洁，通常不超过100字。`
      },
      ...userSession.history,
      { role: "user", content: userMessage }
    ];

    const response = await fetch("https://gemini.chaohua.me/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages,
        model: "gemini-2.0-flash-exp",
        max_tokens: SESSION_CONFIG.maxTokens,
        temperature: 0.7,
        presence_penalty: 0.6,
        frequency_penalty: 0.5,
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API错误: ${data.error?.message || '未知错误'}`);
    }

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('无效的API响应');
    }

    const aiResponse = data.choices[0].message.content.trim();
    
    // 更新会话历史
    updateUserSession(userId, userMessage, aiResponse);

    // 发送回复
    const replyKeyboard = new InlineKeyboard()
      .text("♻️ 重新生成", `regenerate_${ctx.message.message_id}`)
      .text("🗑️ 结束对话", `end_${userId}`);

    await ctx.reply(aiResponse, {
      reply_to_message_id: ctx.message.message_id,
      reply_markup: replyKeyboard
    });

  } catch (error) {
    console.error("AI回复错误:", error);
    
    let errorMessage = "喵呜~ 出错了，请稍后再试";
    if (error.message.includes('API错误')) {
      errorMessage = "喵~ API服务器似乎出了点问题，请稍后再试";
    } else if (error.message.includes('无效的API响应')) {
      errorMessage = "喵~ 我现在有点混乱，请重新问我吧";
    }
    
    await ctx.reply(errorMessage, {
      reply_to_message_id: ctx.message.message_id
    });
  }
});

// 处理重新生成按钮
bot.callbackQuery(/^regenerate_(\d+)$/, async (ctx) => {
  const messageId = parseInt(ctx.match[1]);
  const userId = ctx.from.id;
  const userSession = getUserSession(userId);

  if (userSession.history.length < 2) {
    return ctx.answerCallbackQuery({
      text: "喵~ 没有可以重新生成的消息哦",
      show_alert: true
    });
  }

  try {
    await ctx.answerCallbackQuery({ text: "正在重新生成回复..." });
    await ctx.replyWithChatAction("typing");

    // 移除最后一轮对话
    userSession.history = userSession.history.slice(0, -2);
    const lastUserMessage = ctx.update.callback_query.message.reply_to_message.text;

    // 重新调用API
    const messages = [
      {
        role: "system",
        content: "你是一个友善的AI助手，名叫喵哥。请用简短、可爱的语气回答问题。"
      },
      ...userSession.history,
      { role: "user", content: lastUserMessage }
    ];

    const response = await fetch("https://gemini.chaohua.me/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages,
        model: "gemini-2.0-flash-exp",
        max_tokens: SESSION_CONFIG.maxTokens,
        temperature: 0.9, // 增加随机性
        presence_penalty: 0.7,
        frequency_penalty: 0.7,
      })
    });

    const data = await response.json();
    const aiResponse = data.choices[0].message.content.trim();

    // 更新会话历史
    updateUserSession(userId, lastUserMessage, aiResponse);

    // 更新消息
    await ctx.editMessageText(aiResponse, {
      reply_markup: ctx.callbackQuery.message.reply_markup
    });

  } catch (error) {
    console.error("重新生成失败:", error);
    await ctx.answerCallbackQuery({
      text: "喵呜~ 重新生成失败，请稍后再试",
      show_alert: true
    });
  }
});

// 处理结束对话按钮
bot.callbackQuery(/^end_(\d+)$/, async (ctx) => {
  const userId = parseInt(ctx.match[1]);
  
  if (userId !== ctx.from.id) {
    return ctx.answerCallbackQuery({
      text: "喵~ 只有对话发起者才能结束对话哦",
      show_alert: true
    });
  }

  userSessions.delete(userId);
  await ctx.answerCallbackQuery({ text: "对话已结束，记忆已清空" });
  await ctx.editMessageReplyMarkup({ reply_markup: null });
  await ctx.reply("喵~ 对话已结束，你可以开始新的对话啦！");
});

// 处理新成员加入
bot.on("chat_member", async (ctx) => {
  if (ctx.chatMember.new_chat_member.status === "member") {
    const userId = ctx.chatMember.new_chat_member.user.id;
    const userName = ctx.chatMember.new_chat_member.user.first_name;
    
    try {
      // 限制新用户权限
      await ctx.restrictChatMember(userId, {
        permissions: {
          can_send_messages: false,
          can_send_media_messages: false,
          can_send_other_messages: false,
        },
      });

      // 发送验证消息
      const keyboard = new InlineKeyboard()
        .text("我不是机器人", `verify_${userId}`);
      
      const message = await ctx.reply(
        `欢迎 ${userName} 加入群组！喵~ 🎉\n为了防止机器人，请在 ${CONFIG.joinVerificationTimeout} 秒内点击下方按钮进行验证。`,
        { reply_markup: keyboard }
      );

      // 设置验证超时
      const timeout = setTimeout(async () => {
        try {
          const verificationData = pendingVerifications.get(userId);
          if (verificationData) {
            await ctx.banChatMember(userId);
            await ctx.unbanChatMember(userId); // 立即解除封禁，但用户需要重新加入
            await ctx.api.deleteMessage(ctx.chat.id, verificationData.messageId);
            pendingVerifications.delete(userId);
            await ctx.reply(`用户 ${userName} 未能完成验证，已被移出群组。喵~`);
          }
        } catch (error) {
          console.error("验证超时处理失败:", error);
        }
      }, CONFIG.joinVerificationTimeout * 1000);

      // 记录待验证信息
      pendingVerifications.set(userId, {
        timeout,
        messageId: message.message_id
      });
    } catch (error) {
      console.error("处理新成员加入失败:", error);
    }
  }
});

// 添加验证按钮回调
bot.callbackQuery(/^verify_(\d+)$/, async (ctx) => {
  const userId = parseInt(ctx.match[1]);
  const clickerId = ctx.from.id;
  
  if (userId !== clickerId) {
    return ctx.answerCallbackQuery({
      text: "这不是给你的验证按钮哦！喵~",
      show_alert: true
    });
  }

  const verificationData = pendingVerifications.get(userId);
  if (!verificationData) {
    return ctx.answerCallbackQuery({
      text: "验证已过期或无效！喵~",
      show_alert: true
    });
  }

  try {
    // 清除验证超时
    clearTimeout(verificationData.timeout);
    pendingVerifications.delete(userId);

    // 恢复用户权限
    await ctx.restrictChatMember(userId, {
      permissions: {
        can_send_messages: true,
        can_send_media_messages: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true,
      },
    });

    // 更新验证消息
    await ctx.editMessageText(
      `用户 ${ctx.from.first_name} 已通过验证！喵~ 🎉\n请查看群组规则和使用帮助！`,
      {
        reply_markup: new InlineKeyboard()
          .text("群组规则", "rules")
          .text("使用帮助", "help")
      }
    );
    
    await ctx.answerCallbackQuery({
      text: "验证成功！欢迎加入群组！喵~",
      show_alert: true
    });
  } catch (error) {
    console.error("处理验证失败:", error);
    await ctx.answerCallbackQuery({
      text: "验证失败，请联系管理员！喵~",
      show_alert: true
    });
  }
});

// 添加手动验证命令
bot.command("verify", async (ctx) => {
  if (!await isAdmin(ctx)) {
    return ctx.reply("喵~ 只有管理员才能使用这个命令哦！");
  }

  const replyToMessage = ctx.message.reply_to_message;
  if (!replyToMessage) {
    return ctx.reply("喵~ 请回复要验证的用户的消息！");
  }

  try {
    const userId = replyToMessage.from.id;
    // 恢复用户权限
    await ctx.restrictChatMember(userId, {
      permissions: {
        can_send_messages: true,
        can_send_media_messages: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true,
      },
    });
    
    // 清除待验证状态
    const verificationData = pendingVerifications.get(userId);
    if (verificationData) {
      clearTimeout(verificationData.timeout);
      pendingVerifications.delete(userId);
    }

    await ctx.reply(`已手动验证用户 ${replyToMessage.from.first_name}！喵~`);
  } catch (error) {
    await ctx.reply("喵呜~ 验证失败，可能是权限不足");
  }
});

// 添加批量删除消息命令
bot.command("clean", async (ctx) => {
  if (!await isAdmin(ctx)) {
    return ctx.reply("喵~ 只有管理员才能使用这个命令哦！");
  }

  const args = ctx.message.text.split(" ");
  const count = parseInt(args[1]) || 10; // 默认删除10条
  
  if (count > 100) {
    return ctx.reply("喵~ 一次最多只能删除100条消息哦！");
  }

  try {
    // 获取消息ID
    const messages = await ctx.api.getChat(ctx.chat.id);
    const messageId = ctx.message.message_id;
    
    // 批量删除消息
    const promises = [];
    for (let i = 0; i < count; i++) {
      promises.push(ctx.api.deleteMessage(ctx.chat.id, messageId - i).catch(() => {}));
    }
    
    await Promise.all(promises);
    const notification = await ctx.reply(`已删除 ${count} 条消息！喵~`);
    
    // 3秒后删除通知
    setTimeout(() => {
      ctx.api.deleteMessage(ctx.chat.id, notification.message_id).catch(() => {});
    }, 3000);
  } catch (error) {
    console.error("批量删除消息失败:", error);
    await ctx.reply("喵呜~ 删除消息失败，可能是消息太久远了");
  }
});

// 添加临时禁言命令
bot.command("tmute", async (ctx) => {
  if (!await isAdmin(ctx)) {
    return ctx.reply("喵~ 只有管理员才能使用这个命令哦！");
  }

  const args = ctx.message.text.split(" ");
  const timeArg = args[1];
  
  if (!timeArg) {
    return ctx.reply("喵~ 请指定禁言时长！例如：/tmute 1h（支持：s秒、m分、h时、d天）");
  }

  const duration = parseTime(timeArg);
  if (!duration) {
    return ctx.reply("喵~ 时间格式不正确！例如：30s、5m、1h、1d");
  }

  const replyToMessage = ctx.message.reply_to_message;
  if (!replyToMessage) {
    return ctx.reply("喵~ 请回复要禁言的用户的消息！");
  }

  try {
    await ctx.restrictChatMember(replyToMessage.from.id, {
      until_date: Math.floor(Date.now() / 1000) + duration,
      permissions: {
        can_send_messages: false,
        can_send_media_messages: false,
        can_send_other_messages: false,
      },
    });
    
    const timeUnit = timeArg.slice(-1);
    const timeNum = timeArg.slice(0, -1);
    const timeText = {
      s: "秒",
      m: "分钟",
      h: "小时",
      d: "天"
    }[timeUnit];
    
    await ctx.reply(`已将用户 ${replyToMessage.from.first_name} 禁言 ${timeNum}${timeText}！喵~`);
  } catch (error) {
    await ctx.reply("喵呜~ 操作失败，可能是权限不足");
  }
});

// 更新帮助命令回调
bot.callbackQuery("rules", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(`群组规则：
1. 禁止发送违法、色情、暴力等内容
2. 禁止发送广告和垃圾信息
3. 请友善对待其他成员
4. 违反规则将被禁言或踢出群组`);
});

// 更新帮助命令回调
bot.callbackQuery("help", async (ctx) => {
  await ctx.answerCallbackQuery();
  const commandList = Object.entries(CONFIG.adminCommands)
    .map(([cmd, desc]) => `   - /${cmd} - ${desc}`)
    .join("\n");
    
  await ctx.reply(`使用帮助：
1. 直接发送消息即可与喵哥对话
2. 管理员命令：
${commandList}
3. 警告系统：
   - ${CONFIG.maxWarnings}次警告将被踢出群组
   - 发送违规内容会收到警告
   - 管理员可以手动警告或删除警告`);
});

// 添加简单的 HTTP 服务器用于健康检查
const http = require('http');
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('OK');
  } else {
    res.writeHead(404);
    res.end();
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`);
});

// 启动机器人
bot.catch((err) => {
  console.error("Bot error:", err);
});

bot.start(); 