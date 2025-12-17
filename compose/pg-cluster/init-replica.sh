#!/bin/bash
set -e

echo "Waiting for primary to be ready..."
until pg_isready -h pg-primary -p 5432 -U postgres; do
  sleep 1
done

echo "Cloning from primary..."
rm -rf "$PGDATA"/*
pg_basebackup -h pg-primary -D "$PGDATA" -U replicator -Fp -Xs -P -R

echo "Replica initialized"
