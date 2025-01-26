import { config } from "../config.js";

export async function aiHandler(ctx) {
  const message = ctx.message.text;
  if (!message) return;

  try {
    // 显示正在输入状态
    await ctx.api.sendChatAction(ctx.chat.id, "typing");

    const response = await fetch(config.GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: "你是一个友好的群管理助手，名字叫喵哥。"
          },
          {
            role: "user",
            content: message
          }
        ],
        model: "gemini-2.0-flash-exp"
      })
    });

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    await ctx.reply(aiResponse);
  } catch (error) {
    console.error("AI 响应错误:", error);
    await ctx.reply("喵呜...我现在有点累了，稍后再和你聊天吧~");
  }
} 