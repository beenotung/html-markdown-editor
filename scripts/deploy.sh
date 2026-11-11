#!/bin/bash
set -e
set -o pipefail

npm run clean
npm run build

rm -rf public/dist/
cp -r dist public/

mkdir -p public/lib/katex
rm -rf public/lib/katex/*
cp -r lib/katex/* public/lib/katex/

cp index.html public/index.html

npx surge public https://html-markdown-editor.surge.sh
