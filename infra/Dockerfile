FROM node:22-bookworm-slim AS client
WORKDIR /src/app
COPY app/package*.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

FROM golang:1.26-bookworm AS server
WORKDIR /src/api
COPY api/go.mod api/go.sum ./
RUN go mod download
COPY api/cmd/ ./cmd/
COPY api/internal/ ./internal/
RUN CGO_ENABLED=1 go build -trimpath -o /mtg4fun ./cmd/mtg4fun

FROM debian:bookworm-slim
RUN groupadd --gid 10001 mtg4fun && useradd --uid 10001 --gid 10001 --no-create-home mtg4fun && mkdir /data && chown mtg4fun:mtg4fun /data
COPY --from=server /mtg4fun /usr/local/bin/mtg4fun
COPY --from=client /src/app/dist /app/web
USER 10001:10001
ENV DB_PATH=/data/mtg4fun.db WEB_DIR=/app/web ADDR=:8080
EXPOSE 8080
ENTRYPOINT ["mtg4fun"]
CMD ["serve"]
