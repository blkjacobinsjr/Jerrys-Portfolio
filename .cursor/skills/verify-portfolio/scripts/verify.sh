#!/bin/sh
set -eu
repo=$(CDPATH= cd -- "$(dirname -- "$0")/../../../.." && pwd)
cd "$repo"
evidence="$repo/reports/verification/portfolio"
runtime="$repo/.agent-local/verify-portfolio"
mkdir -p "$evidence" "$repo/.agent-local"
case "${1:-}" in
  launch)
    mkdir "$runtime" || { echo 'Verification instance is already claimed; inspect it with doctor.' >&2; exit 1; }
    if ! npm run build > "$evidence/build.log" 2>&1; then rmdir "$runtime"; exit 1; fi
    node --input-type=module <<'JS'
import { spawn } from 'node:child_process';
import { openSync, writeFileSync } from 'node:fs';
const log = openSync('reports/verification/portfolio/server.log', 'w');
const server = spawn(process.execPath, ['./node_modules/.bin/astro', 'preview', '--host', '127.0.0.1', '--port', '4322', '--ignore-lock'], {
  detached: true,
  stdio: ['ignore', log, log],
});
writeFileSync('.agent-local/verify-portfolio/pid', `${server.pid}\n`);
server.unref();
JS
    for attempt in $(seq 1 60); do
      if curl --silent --fail http://127.0.0.1:4322/ > /dev/null; then
        if "$0" doctor; then exit 0; fi
        "$0" cleanup
        echo 'Preview failed its ownership or page checks; inspect the verification logs.' >&2
        exit 1
      fi
      sleep 0.2
    done
    "$0" cleanup
    echo 'Preview did not become usable; inspect reports/verification/portfolio/server.log.' >&2
    exit 1
    ;;
  doctor)
    test -f "$runtime/pid"
    process_id=$(cat "$runtime/pid")
    kill -0 "$process_id"
    lsof -Pan -p "$process_id" -iTCP:4322 -sTCP:LISTEN > "$evidence/listener.txt"
    node .cursor/skills/verify-portfolio/scripts/prove.mjs doctor
    ;;
  drive)
    "$0" doctor
    node .cursor/skills/verify-portfolio/scripts/prove.mjs drive
    ;;
  cleanup)
    if test -f "$runtime/pid"; then
      process_id=$(cat "$runtime/pid")
      if kill -0 "$process_id" 2>/dev/null; then
        ps -p "$process_id" -o command= | rg --quiet 'astro.*preview.*--port 4322'
        kill "$process_id"
      fi
      rm "$runtime/pid"
    fi
    if test -d "$runtime"; then rmdir "$runtime"; fi
    ;;
  *) echo 'Usage: verify.sh launch|doctor|drive|cleanup' >&2; exit 2 ;;
esac
