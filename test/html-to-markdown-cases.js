let fs = require('fs')
let path = require('path')
let { html } = require('very-small-parser')
let { toMdast } = require('very-small-parser/lib/html/toMdast')
let {
  toText: toMarkdown,
} = require('very-small-parser/lib/markdown/block/toText')

function extractEditorHtml(filePath) {
  let raw = fs.readFileSync(filePath, 'utf8')
  let match = raw.match(/<div id="htmlEditor"[^>]*>([\s\S]*)<\/div>\s*$/)
  return match ? match[1].trim() : raw.trim()
}

function preprocessHtml(html_text) {
  // mirrors prepareHtmlForMarkdown in src/app.ts
  html_text = html_text.replace(/<div>\s*<br\s*\/?>\s*<\/div>/gi, '')
  while (/<\/div>\s*<div>/i.test(html_text)) {
    html_text = html_text.replace(/<\/div>\s*<div>/gi, '<br>')
  }
  return html_text.replace(/>\s+</g, '><')
}

function html_to_markdown_from_patched(html_patched) {
  html_patched = html_patched
    .replaceAll('<br>', '<br/>')
    .replaceAll('<hr>', '<hr/>')
    .replaceAll('<br/>\n', '<br/>')
    .replaceAll('<hr/>\n', '<hr/>')
    .replace(/>\s+</g, '><')
  return toMarkdown(toMdast(html.html.parsef(html_patched))).trim()
}

function html_to_markdown(html_text) {
  return html_to_markdown_from_patched(preprocessHtml(html_text))
}

let root = path.join(__dirname, '..')
let failed = 0

for (let n of [1, 2, 3]) {
  let input = extractEditorHtml(path.join(root, `case-${n}.html`))
  let expected = fs
    .readFileSync(path.join(root, `case-${n}.md`), 'utf8')
    .trimEnd()
  let actual = html_to_markdown(input)
  let pass = actual === expected
  if (!pass) failed++
  console.log(`case-${n}: ${pass ? 'PASS' : 'FAIL'}`)
  if (!pass) {
    console.log('expected:', JSON.stringify(expected))
    console.log('actual:  ', JSON.stringify(actual))
  }
}

process.exit(failed)
