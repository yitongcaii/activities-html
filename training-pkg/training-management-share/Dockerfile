# 培训管理平台 - 生产镜像
# 用法：docker compose up -d（同目录需有 .env）
FROM node:20-alpine

WORKDIR /app

# 时区：中文环境日志/日期统一为北京时间
RUN apk add --no-cache tzdata && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && echo "Asia/Shanghai" > /etc/timezone

# 先装依赖，利用镜像层缓存
COPY package*.json ./
RUN npm ci --omit=dev

# 拷贝应用代码（含 public/vendor 本地化资源、uploads 默认 banner）
COPY . .

EXPOSE 8080
ENV PORT=8080 \
    NODE_ENV=production \
    TZ=Asia/Shanghai

# 容器平台 restart 策略负责进程自愈；如需更稳可改 pm2-runtime
CMD ["node", "server.js"]
