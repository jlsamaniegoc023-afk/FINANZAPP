FROM oven/bun:1.4.4

WORKDIR /app

# Copiar manifiestos y dependencias
COPY package.json bun.lock ./

# Instalar dependencias respetando el archivo de bloqueo
RUN bun install --frozen-lockfile

# Copiar el proyecto
COPY . .

# Compilar el frontend
RUN bun run build

# Configuración de producción
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Ejecutar el servidor TypeScript con Bun
CMD ["bun", "server.ts"]
