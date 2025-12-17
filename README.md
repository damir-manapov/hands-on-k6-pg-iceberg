# hands-on-k6-pg-iceberg

Load-test a simple HTTP API backed by Postgres, alongside a Trino+Iceberg stack (Nessie + MinIO) via Docker Compose. The API uses Kysely for Postgres queries and Trino REST API for Iceberg.

## Quickstart (Single Mode)

1. Start services:

```bash
pnpm compose:up
```

2. Install deps and run the server:

```bash
pnpm install
pnpm dev
```

3. Run e2e tests:

```bash
pnpm test:e2e
```

4. Run k6 load tests:

```bash
pnpm k6 tests/k6/pg-basic.test.js
pnpm k6 tests/k6/pg-create.test.js
pnpm k6 tests/k6/trino-create.test.js
pnpm k6 tests/k6/trino-batch.test.js
```

5. View database stats:

```bash
pnpm stats
```

6. Optimize Iceberg files:

```bash
pnpm optimize
```

## Cluster Mode

Start a production-like cluster with PostgreSQL replication and Trino distributed execution:

```bash
pnpm compose:up:cluster
```

This starts:

- **PostgreSQL**: 1 primary + 2 replicas (1 sync, 1 async)
- **Trino**: 1 coordinator + 2 workers

### PostgreSQL Cluster

| Node | Port | Mode | Description |
|------|------|------|-------------|
| pg-primary | 5432 | Read/Write | Primary node |
| pg-replica-1 | 5433 | Read-only | Synchronous replica |
| pg-replica-2 | 5434 | Read-only | Asynchronous replica |

Run cluster-specific tests:

```bash
pnpm vitest run -c vitest.e2e.config.ts tests/e2e/pg-cluster.e2e.test.ts
```

### Trino Cluster

The coordinator handles query planning, workers execute queries. Use `WORKERS=5 pnpm dev:cluster` to run multiple app instances for contention testing.

```bash
pnpm k6 tests/k6/contention.test.js
```

### Reset Cluster

```bash
pnpm compose:reset
```

## API Endpoints

### Postgres (`/pg`)

- `GET /pg/health` - Health check
- `GET /pg/stats` - Table stats (count, size)
- `GET /pg/people` - List all people
- `POST /pg/people` - Create a person (`{ "name": "..." }`)

### Trino/Iceberg (`/trino`)

- `GET /trino/health` - Health check
- `GET /trino/stats` - Table stats (count, size, file count)
- `GET /trino/people` - List all people
- `POST /trino/people` - Create a person (immediate write)
- `POST /trino/people/batch` - Create a person (batched write, flushes every 500ms)
- `POST /trino/optimize` - Compact small files into larger ones

### Dual Write (`/dual`)

- `GET /dual/health` - Health check (both PG and Trino)
- `GET /dual/people` - List from both stores
- `POST /dual/people` - Write to both PG and Trino simultaneously
- `POST /dual/people/batch` - Write to PG immediately, batch Trino writes

## Services

### Single Mode

- Postgres on `localhost:5432`
- MinIO on `localhost:9000` (console `:9001`)
- Nessie catalog on `localhost:19120`
- Trino on `localhost:8080`

### Cluster Mode

- PostgreSQL primary on `localhost:5432`, replicas on `:5433`, `:5434`
- MinIO on `localhost:9000` (console `:9001`)
- Nessie catalog on `localhost:19120`
- Trino coordinator on `localhost:8080`

Credentials: `postgres/postgres` (PG), `minioadmin/minioadmin` (MinIO)

## Env

Copy `.env.example` to `.env` and adjust as needed.
