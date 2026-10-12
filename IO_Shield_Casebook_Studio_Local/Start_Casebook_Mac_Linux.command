#!/bin/sh
cd "$(dirname "$0")" || exit 1
# Release downloads include Node in runtime/, so nothing needs to be installed.
case "$(uname -m)" in
  arm64|aarch64) BUNDLED=runtime/node-arm64 ;;
  *) BUNDLED=runtime/node-x64 ;;
esac
if [ -x "$BUNDLED" ]; then
  NODE="$BUNDLED"
elif [ -x runtime/node ]; then
  NODE=runtime/node
elif command -v node >/dev/null 2>&1; then
  NODE=node
else
  echo 'Install Node.js 22.13 or newer from https://nodejs.org/en/download, then launch again.'
  exit 1
fi
if ! "$NODE" -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||a===22&&b>=13?0:1)'; then
  echo 'Node.js 22.13 or newer is required.'
  exit 1
fi
exec "$NODE" server.mjs --open
