#!/bin/zsh
set -e
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  print "Install Node.js 22 or newer from https://nodejs.org, then open this launcher again."
  read "?Press Return to close. "
  exit 1
fi
if [ ! -d node_modules ]; then npm ci; fi
npm run build
print "Open http://localhost:3000 in your browser. Keep this window open while playing."
npm start
