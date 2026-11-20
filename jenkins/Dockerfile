FROM jenkins/jenkins:lts-jdk21

USER root

ARG DOCKER_VERSION=29.9.2
ARG COMPOSE_VERSION=5.6.1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Instalar Docker CLI
RUN curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER_VERSION}.tgz \
    -o /tmp/docker.tgz \
    && tar -xzf /tmp/docker.tgz -C /tmp \
    && install -m 0755 /tmp/docker/docker /usr/local/bin/docker \
    && rm -rf /tmp/docker /tmp/docker.tgz

# Instalar complemento Docker Compose
RUN mkdir -p /usr/local/lib/docker/cli-plugins \
    && curl -fSL https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-linux-x86_64 \
    -o /usr/local/lib/docker/cli-plugins/docker-compose \
    && chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Instalar Bun 1.4.4
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v1.4.4" \
    && install -m 0755 /root/.bun/bin/bun /usr/local/bin/bun

# Verificar herramientas
RUN docker --version \
    && docker compose version \
    && bun --version \
    && git --version

USER jenkins

