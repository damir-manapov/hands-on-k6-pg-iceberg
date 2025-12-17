# hands-on-k6-pg-iceberg

Load-test a simple HTTP API backed by Postgres, alongside a Trino+Iceberg stack (Nessie + MinIO) via Docker Compose. The API uses Kysely for Postgres queries and Trino REST API for Iceberg.

## Quickstart

1. Start services:

```bash
docker compose -f compose/docker-compose.yml up -d
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

## Cluster Mode (Contention Testing)

Run multiple server instances to test Iceberg write contention:

```bash
# Terminal 1: Start 10 workers sharing port 3000
pnpm dev:cluster

# Terminal 2: Run contention test (50 VUs, 30s)
pnpm k6 tests/k6/contention.test.js
```

Customize workers: `WORKERS=5 pnpm dev:cluster`

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

## Services

- Postgres on `localhost:5432` (user `postgres`, password `postgres`)
- MinIO on `localhost:9000` (console `:9001`, user `minioadmin`, password `minioadmin`)
- Nessie catalog on `localhost:19120`
- Trino on `localhost:8080`

## Env

Copy `.env.example` to `.env` and adjust as needed.
