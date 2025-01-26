import { config } from "../config.js";

export function adminHandler(bot) {
  // 警告用户
  bot.command("warn", async (ctx) => {
    if (!isAdmin(ctx)) {
      return await ctx.reply("只有管理员才能使用此命令！");
    }

    const reply = ctx.message.reply_to_message;
    if (!reply) {
      return await ctx.reply("请回复要警告的用户的消息！");
    }

    const userId = reply.from.id;
    ctx.session.warnings = (ctx.session.warnings || 0) + 1;

    await ctx.reply(`已警告用户。当前警告次数：${ctx.session.warnings}`);
    
    if (ctx.session.warnings >= 3) {
      try {
        await ctx.banChatMember(userId);
        await ctx.reply("由于警告次数达到3次，该用户已被封禁。");
      } catch (error) {
        console.error("封禁用户失败:", error);
        await ctx.reply("封禁用户失败，请确保机器人具有管理员权限。");
      }
    }
  });

  // 删除消息
  bot.command("del", async (ctx) => {
    if (!isAdmin(ctx)) {
      return await ctx.reply("只有管理员才能使用此命令！");
    }

    const reply = ctx.message.reply_to_message;
    if (!reply) {
      return await ctx.reply("请回复要删除的消息！");
    }

    try {
      await ctx.deleteMessage(reply.message_id);
      await ctx.deleteMessage(ctx.message.message_id);
    } catch (error) {
      console.error("删除消息失败:", error);
      await ctx.reply("删除消息失败，请确保机器人具有删除消息的权限。");
    }
  });

  // 禁言用户
  bot.command("mute", async (ctx) => {
    if (!isAdmin(ctx)) {
      return await ctx.reply("只有管理员才能使用此命令！");
    }

    const reply = ctx.message.reply_to_message;
    if (!reply) {
      return await ctx.reply("请回复要禁言的用户的消息！");
    }

    const userId = reply.from.id;
    const duration = 3600; // 默认禁言1小时

    try {
      await ctx.restrictChatMember(userId, {
        until_date: Math.floor(Date.now() / 1000) + duration,
        permissions: {
          can_send_messages: false,
          can_send_media_messages: false,
          can_send_other_messages: false,
        }
      });
      await ctx.reply("已禁言该用户1小时。");
    } catch (error) {
      console.error("禁言用户失败:", error);
      await ctx.reply("禁言失败，请确保机器人具有管理员权限。");
    }
  });

  // 解除禁言
  bot.command("unmute", async (ctx) => {
    if (!isAdmin(ctx)) {
      return await ctx.reply("只有管理员才能使用此命令！");
    }

    const reply = ctx.message.reply_to_message;
    if (!reply) {
      return await ctx.reply("请回复要解除禁言的用户的消息！");
    }

    const userId = reply.from.id;

    try {
      await ctx.restrictChatMember(userId, {
        permissions: {
          can_send_messages: true,
          can_send_media_messages: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true,
        }
      });
      await ctx.reply("已解除该用户的禁言。");
    } catch (error) {
      console.error("解除禁言失败:", error);
      await ctx.reply("解除禁言失败，请确保机器人具有管理员权限。");
    }
  });

  // 设置群规则
  bot.command("setrules", async (ctx) => {
    if (!isAdmin(ctx)) {
      return await ctx.reply("只有管理员才能使用此命令！");
    }

    const rules = ctx.message.text.split("/setrules ")[1];
    if (!rules) {
      return await ctx.reply("请输入群规则内容！格式: /setrules <规则内容>");
    }

    try {
      await ctx.setChatDescription(rules);
      await ctx.reply("群规则已更新！");
    } catch (error) {
      console.error("设置群规则失败:", error);
      await ctx.reply("设置群规则失败，请确保机器人具有管理员权限。");
    }
  });

  // 清理消息
  bot.command("clean", async (ctx) => {
    if (!isAdmin(ctx)) {
      return await ctx.reply("只有管理员才能使用此命令！");
    }

    try {
      const messages = await ctx.api.getChatHistory(ctx.chat.id, {
        limit: 100
      });

      for (const message of messages) {
        try {
          await ctx.deleteMessage(message.message_id);
        } catch (error) {
          console.error("删除消息失败:", error);
        }
      }

      await ctx.reply("已清理最近100条消息。");
    } catch (error) {
      console.error("清理消息失败:", error);
      await ctx.reply("清理消息失败，请确保机器人具有管理员权限。");
    }
  });
}

function isAdmin(ctx) {
  return config.ADMIN_IDS.includes(ctx.from.id);
} 