#!/usr/bin/env bash
# Serve Timecard over http://localhost so the app can load (file:// is blank).
set -e
cd "$(dirname "$0")"
PORT="${PORT:-8765}"
URL="http://127.0.0.1:${PORT}/Timecard.html"

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "Python is required. Install from https://www.python.org then try again."
  exit 1
fi

echo ""
echo "  TRP Timecard — local server"
echo "  Open:  $URL"
echo "  Stop:  Ctrl+C"
echo ""

# Open browser after a short delay (macOS / Linux / Windows via cmd.exe if present)
( sleep 0.7
  if command -v open >/dev/null 2>&1; then open "$URL"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
  elif command -v cmd.exe >/dev/null 2>&1; then cmd.exe /c start "$URL"
  fi
) >/dev/null 2>&1 &

exec "$PY" -m http.server "$PORT"
