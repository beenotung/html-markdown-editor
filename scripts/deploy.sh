#!/bin/bash
set -e
set -o pipefail

npm run build

mkdir -p public/dist
cp dist/bundle.js public/dist/bundle.js
mkdir -p public/lib/katex
cp -r lib/katex/* public/lib/katex/
cp index.html public/index.html

npx surge public https://html-markdown-editor.surge.sh
