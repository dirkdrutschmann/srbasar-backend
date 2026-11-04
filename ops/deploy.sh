#!/usr/bin/env bash
set -Eeuo pipefail

VERSION="${1:-}"
SOURCE_DIR="${2:-}"

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Invalid release version: $VERSION" >&2
  exit 64
fi

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Source directory does not exist: $SOURCE_DIR" >&2
  exit 66
fi

pushd "$SOURCE_DIR" >/dev/null
npm run audit:production
popd >/dev/null

APP_ROOT="${SRBASAR_BACKEND_ROOT:-/var/www/clients/client2/web3/private}"
CURRENT_LINK="$APP_ROOT/current"
SHARED_DIR="$APP_ROOT/shared"
RELEASES_DIR="$APP_ROOT/releases"
STABLE_SCRIPT="$APP_ROOT/src/app.js"
STAGING_DIR="$RELEASES_DIR/.staging"
RELEASE_DIR="$RELEASES_DIR/$VERSION"
PM2_USER="${SRBASAR_PM2_USER:-web3}"
PM2_HOME_DIR="${SRBASAR_PM2_HOME:-/var/lib/pm2/web3/.pm2}"
PM2_BIN="${SRBASAR_PM2_BIN:-pm2}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "The backend deployment must run as root on the ISPConfig host." >&2
  exit 77
fi

if ! id "$PM2_USER" >/dev/null 2>&1; then
  echo "PM2 runtime user does not exist: $PM2_USER" >&2
  exit 80
fi

if ! command -v runuser >/dev/null 2>&1; then
  echo "Missing runuser command required for the PM2 runtime user." >&2
  exit 81
fi

NODE_BINARY="${SRBASAR_NODE_BIN:-$(readlink -f "$(command -v node)")}"
if [[ -z "$NODE_BINARY" || ! -x "$NODE_BINARY" ]]; then
  echo "Node.js binary is not executable: $NODE_BINARY" >&2
  exit 82
fi
PM2_PATH="${SRBASAR_PM2_PATH:-$(dirname "$NODE_BINARY"):/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin}"
PM2_GROUP="${SRBASAR_PM2_GROUP:-$(id -gn "$PM2_USER")}"

run_as_pm2_user() {
  runuser -u "$PM2_USER" -- env \
    PM2_HOME="$PM2_HOME_DIR" \
    PATH="$PM2_PATH" \
    "$@"
}

pm2_as_runtime() {
  run_as_pm2_user "$PM2_BIN" "$@"
}

if ! run_as_pm2_user "$PM2_BIN" --version >/dev/null 2>&1; then
  echo "PM2 is not available for runtime user $PM2_USER." >&2
  exit 83
fi

if [[ ! -f "$SHARED_DIR/.env" ]]; then
  echo "Missing shared backend environment: $SHARED_DIR/.env" >&2
  exit 78
fi

if [[ -e "$RELEASE_DIR" || -L "$RELEASE_DIR" ]]; then
  if [[ "$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)" == "$RELEASE_DIR" ]]; then
    echo "Backend release $VERSION is already active."
    exit 0
  fi
  echo "Release already exists: $RELEASE_DIR" >&2
  exit 79
fi

mkdir -p "$SHARED_DIR/logs" "$RELEASES_DIR" "$STAGING_DIR"

if [[ -f "$SHARED_DIR/.env.ballersclub" ]]; then
  chown "root:$PM2_GROUP" "$SHARED_DIR/.env.ballersclub"
  chmod 0640 "$SHARED_DIR/.env.ballersclub"
  if ! run_as_pm2_user test -r "$SHARED_DIR/.env.ballersclub"; then
    echo "Ballers Club ENV is not readable by PM2 runtime user $PM2_USER." >&2
    exit 84
  fi
fi

previous_release="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
previous_script_target="$(readlink "$STABLE_SCRIPT" 2>/dev/null || true)"
previous_script_backup=""
if [[ -z "$previous_script_target" && -f "$STABLE_SCRIPT" ]]; then
  previous_script_backup="$STABLE_SCRIPT.bootstrap"
  if [[ ! -e "$previous_script_backup" && ! -L "$previous_script_backup" ]]; then
    :
  else
    previous_script_backup="$STABLE_SCRIPT.bootstrap.$$"
  fi
  previous_script_target="$previous_script_backup"
fi
staging_release="$STAGING_DIR/$VERSION.$$"
cleanup() {
  rm -rf -- "$staging_release"
}
trap cleanup EXIT

mkdir -p "$staging_release"
cp -a "$SOURCE_DIR/." "$staging_release/"
rm -f "$staging_release/.env" "$staging_release/logs"
ln -s "$SHARED_DIR/.env" "$staging_release/.env"
ln -s "$SHARED_DIR/logs" "$staging_release/logs"
if [[ -f "$SHARED_DIR/.env.ballersclub" ]]; then
  rm -f -- "$staging_release/.env.ballersclub"
  ln -s "$SHARED_DIR/.env.ballersclub" "$staging_release/.env.ballersclub"
fi

pushd "$staging_release" >/dev/null
npm_config_allow_remote=root npm ci --omit=dev --no-audit --no-fund
node --check src/app.js
node ops/backupDatabase.js "$SHARED_DIR/backups" "$VERSION"
node ops/migrate.js
node ops/backfillLocations.js
run_as_pm2_user "$NODE_BINARY" ops/importBallersclub.js
node ops/checkBallersCatalog.js
popd >/dev/null

find "$staging_release" -type d -exec chmod 755 {} +
find "$staging_release" -type f -exec chmod 644 {} +

mv -- "$staging_release" "$RELEASE_DIR"
trap - EXIT

if [[ -n "$previous_script_backup" ]]; then
  mv -- "$STABLE_SCRIPT" "$previous_script_backup"
fi

next_script="$STABLE_SCRIPT.next.$$"
ln -s "$RELEASE_DIR/src/app.js" "$next_script"
mv -Tf -- "$next_script" "$STABLE_SCRIPT"

next_link="$CURRENT_LINK.next.$$"
ln -s "$RELEASE_DIR" "$next_link"
mv -Tf -- "$next_link" "$CURRENT_LINK"

port="$(awk -F= '$1 == "PORT" { value=$2; gsub(/[[:space:]\"'"'"']/, "", value); print value }' "$SHARED_DIR/.env" | tail -n 1)"
port="${port:-4001}"
if [[ ! "$port" =~ ^[0-9]+$ ]]; then
  echo "Invalid backend PORT in $SHARED_DIR/.env" >&2
  exit 82
fi

reload_backend() {
  # PM2 gleicht die Instanzzahl bei einem Reload nicht automatisch ab.
  local instance_count
  instance_count="$(pm2_as_runtime jlist | "$NODE_BINARY" -e 'let input = ""; process.stdin.on("data", chunk => input += chunk).on("end", () => { const apps = JSON.parse(input); console.log(apps.filter(app => app.name === "srbasar-backend").length); });')"
  if [[ "$instance_count" -gt 0 && "$instance_count" -ne 2 ]]; then
    pm2_as_runtime scale srbasar-backend 2
  fi

  run_as_pm2_user env \
    SRBASAR_BACKEND_ROOT="$APP_ROOT" \
    SRBASAR_BACKEND_CURRENT="$CURRENT_LINK" \
    "$PM2_BIN" startOrReload \
    "$CURRENT_LINK/ecosystem.config.js" \
    --only srbasar-backend \
    --update-env
}

health_check() {
  local attempt
  for attempt in $(seq 1 30); do
    if curl --fail --silent --show-error --max-time 5 "http://127.0.0.1:${port}/v1/health" >/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

rollback() {
  if [[ -n "$previous_release" && -d "$previous_release" ]]; then
    rollback_link="$CURRENT_LINK.rollback.$$"
    ln -s "$previous_release" "$rollback_link"
    mv -Tf -- "$rollback_link" "$CURRENT_LINK"
    if [[ -n "$previous_script_target" ]]; then
      rollback_script="$STABLE_SCRIPT.rollback.$$"
      ln -s "$previous_script_target" "$rollback_script"
      mv -Tf -- "$rollback_script" "$STABLE_SCRIPT"
    fi
    reload_backend || true
    health_check || true
  fi
}

if ! reload_backend || ! health_check; then
  echo "Backend health check failed for release $VERSION; rolling back." >&2
  rollback
  exit 83
fi

pm2_as_runtime save
echo "Backend release $VERSION is active on port $port."
