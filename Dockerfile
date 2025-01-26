FROM node:16-alpine

WORKDIR /app

# 添加时区支持
RUN apk add --no-cache tzdata
ENV TZ=Asia/Shanghai

# 创建日志目录
RUN mkdir -p /app/logs

COPY package*.json ./
RUN npm install

COPY . .

# 添加健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node healthcheck.js || exit 1

CMD ["node", "src/bot.js"] 