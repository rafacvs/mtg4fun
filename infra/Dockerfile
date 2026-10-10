FROM golang:1.26-bookworm AS api-dependencies
WORKDIR /src/api
COPY api/go.mod api/go.sum ./
RUN go mod download

FROM api-dependencies AS api-development
RUN go install github.com/air-verse/air@v1.67.4
COPY infra/air.toml /etc/air.toml
ENV PATH="/src/api/bin:${PATH}"
ENTRYPOINT ["air", "-c", "/etc/air.toml"]

FROM api-dependencies AS api-build
COPY api/cmd/ ./cmd/
COPY api/internal/ ./internal/
RUN CGO_ENABLED=0 go build -trimpath -o /mtg4fun ./cmd/mtg4fun

FROM debian:bookworm-slim AS api-production
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 mtg4fun && useradd --uid 10001 --gid 10001 --no-create-home mtg4fun
COPY --from=api-build /mtg4fun /usr/local/bin/mtg4fun
USER 10001:10001
ENV ADDR=:8080
EXPOSE 8080
ENTRYPOINT ["mtg4fun"]
CMD ["serve"]

FROM node:22-bookworm-slim AS frontend-dependencies
WORKDIR /src/app
COPY app/package*.json ./
RUN npm ci

FROM frontend-dependencies AS frontend-development
EXPOSE 8080
CMD ["sh", "-c", "npm ci && npm run dev -- --host 0.0.0.0 --port 8080 --strictPort"]

FROM frontend-dependencies AS frontend-build
COPY app/ ./
RUN npm run build

FROM nginx:1.28-alpine AS frontend-production
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /src/app/dist /usr/share/nginx/html
EXPOSE 8080
