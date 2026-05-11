FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY dist/package.json ./package.json

RUN npm install --omit=dev --ignore-scripts

COPY dist ./

EXPOSE 3000

CMD ["npm", "run", "start"]