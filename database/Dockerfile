
FROM postgres:16-alpine

LABEL maintainer="FINANZAPP"
LABEL description="Imagen personalizada de PostgreSQL para FINANZAPP"

COPY init.sql /docker-entrypoint-initdb.d/01-init.sql

EXPOSE 5432
