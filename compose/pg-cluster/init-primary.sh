#!/bin/bash
set -e

# Enable replication in pg_hba.conf
echo "host replication all all scram-sha-256" >> "$PGDATA/pg_hba.conf"

# Configure primary for replication
cat >> "$PGDATA/postgresql.conf" <<EOF
wal_level = replica
max_wal_senders = 10
max_replication_slots = 10
hot_standby = on
wal_keep_size = 256MB
synchronous_commit = local
synchronous_standby_names = 'FIRST 1 (pg_replica_1)'
EOF
