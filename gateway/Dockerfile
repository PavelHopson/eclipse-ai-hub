FROM node:22-alpine

WORKDIR /app
COPY src ./src

ENV NODE_ENV=production
USER node
EXPOSE 8810

CMD ["node", "src/server.mjs"]
