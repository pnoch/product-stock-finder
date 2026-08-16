#!/usr/bin/env bash
set -euo pipefail

# Bootstraps the dedicated sync-test database in the running MySQL container
# and applies the drizzle migrations. Idempotent.
#
# Usage:
#   scripts/setup-test-db.sh
#
# Reads credentials from the container env (docker inspect). Override with:
#   MYSQL_CONTAINER=<name> TEST_DB_NAME=<db> scripts/setup-test-db.sh

CONTAINER="${MYSQL_CONTAINER:-promptgen-mysql}"
DB_NAME="${TEST_DB_NAME:-stock_tracker_test}"

ENV_LINE=$(docker inspect "$CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}')
MYSQL_USER=$(printf '%s\n' "$ENV_LINE" | sed -n 's/^MYSQL_USER=//p')
MYSQL_PASSWORD=$(printf '%s\n' "$ENV_LINE" | sed -n 's/^MYSQL_PASSWORD=//p')
MYSQL_ROOT_PASSWORD=$(printf '%s\n' "$ENV_LINE" | sed -n 's/^MYSQL_ROOT_PASSWORD=//p')
PORT=$(docker port "$CONTAINER" 3306/tcp | sed -n 's/.*://p' | head -1)

if [[ -z "$MYSQL_USER" || -z "$MYSQL_PASSWORD" || -z "$MYSQL_ROOT_PASSWORD" || -z "$PORT" ]]; then
  echo "Could not read MySQL credentials/port from container $CONTAINER" >&2
  exit 1
fi

docker exec "$CONTAINER" mysql -u root -p"$MYSQL_ROOT_PASSWORD" \
  -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$MYSQL_USER'@'%'; FLUSH PRIVILEGES;"

TEST_DATABASE_URL=$(node -e "
  const user = process.argv[1];
  const pass = process.argv[2];
  const port = process.argv[3];
  const db = process.argv[4];
  process.stdout.write('mysql://' + encodeURIComponent(user) + ':' + encodeURIComponent(pass) + '@127.0.0.1:' + port + '/' + db);
" "$MYSQL_USER" "$MYSQL_PASSWORD" "$PORT" "$DB_NAME")

DATABASE_URL="$TEST_DATABASE_URL" pnpm exec drizzle-kit migrate

echo "Test DB ready: $TEST_DATABASE_URL"
echo "Run DB tests with: TEST_DATABASE_URL=\"$TEST_DATABASE_URL\" RUN_DB_TESTS=1 pnpm test"