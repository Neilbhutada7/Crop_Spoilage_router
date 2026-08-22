FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .

EXPOSE 5173

# docker-compose mounts a named volume over /app/node_modules (so the
# Linux-built deps aren't shadowed by a host bind mount), which starts
# empty -- reinstall on container start so `npm run dev` always has deps.
# Cheap no-op on restart since npm skips already-satisfied packages.
CMD ["sh", "-c", "npm install --no-audit --no-fund && npm run dev"]
