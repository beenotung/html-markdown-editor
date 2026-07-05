let fs = require('fs')
let path = require('path')
let { micromark } = require('micromark')
let { gfm, gfmHtml } = require('micromark-extension-gfm')

// mirrors extractIconLinks + restore in src/app.ts
function extractIconLinks(markdown) {
  markdown = markdown.replace(
    /\[(\s*<svg[\s\S]*?<\/svg>\s*)\]\((\S+?)(?:\s+(?:"([^"]*)"|'([^']*)'))?\)/gi,
    (_, svg, url, title1, title2) => {
      let title = title1 || title2
      let titleAttr = title ? ` title="${title}"` : ''
      return `<a href="${url}"${titleAttr}>${svg.trim()}</a>`
    },
  )

  let iconLinkBlocks = []
  markdown = markdown.replace(
    /<a\s[^>]*>[\s\S]*?<svg[\s\S]*?<\/svg>[\s\S]*?<\/a>/gi,
    (html, offset) => {
      let lineStart = markdown.lastIndexOf('\n', offset - 1) + 1
      let lineEnd = markdown.indexOf('\n', offset)
      if (lineEnd == -1) lineEnd = markdown.length
      let line = markdown.slice(lineStart, lineEnd)
      let type = line.replace(html, '').trim() ? 'inline' : 'block'
      let placeholder = `%%ICON_LINK_${iconLinkBlocks.length + 1}%%`
      html = html.replace(/>\s+</g, '><').trim()
      iconLinkBlocks.push({ placeholder, html })
      return type == 'inline' ? placeholder : `\n\n${placeholder}\n\n`
    },
  )
  return { markdown, iconLinkBlocks }
}

function markdown_to_html(markdown_text) {
  let { markdown, iconLinkBlocks } = extractIconLinks(markdown_text)
  let html_text = micromark(markdown, {
    allowDangerousHtml: true,
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()],
  })
  for (let { placeholder, html } of iconLinkBlocks) {
    html_text = html_text.replace(placeholder, html)
  }
  return html_text.trim()
}

function assert(name, condition, detail) {
  if (!condition) {
    console.log(`${name}: FAIL`)
    if (detail) console.log(detail)
    return false
  }
  console.log(`${name}: PASS`)
  return true
}

let failed = 0
let root = path.join(__dirname, '..')

// block icon — legacy [<svg>](url) from bug-input.md
{
  let md = fs.readFileSync(path.join(root, 'bug-input.md'), 'utf8')
  let html = markdown_to_html(md)
  let ok =
    assert(
      'block legacy: has anchor',
      html.includes('<a href="https://www.facebook.com/TeamTwilio"'),
    ) &&
    assert(
      'block legacy: title inside svg',
      /<svg[^>]*>[\s\S]*<title>Facebook logo<\/title>/.test(html),
    ) &&
    assert('block legacy: no placeholder', !html.includes('ICON_LINK')) &&
    assert('block legacy: no double p', !html.includes('<p><p>')) &&
    assert('block legacy: wrapped in p', /<p>[\s\S]*<a href/.test(html))
  if (!ok) {
    failed++
    console.log(html)
  }
}

// block icon — raw html in markdown
{
  let svg = `<svg xmlns="http://www.w3.org/2000/svg"><title>Icon</title><path d="M1"/></svg>`
  let md = `1\n\n<a href="https://example.com">${svg}</a>\n\n3`
  let html = markdown_to_html(md)
  let ok =
    assert(
      'block raw html: has anchor',
      html.includes('<a href="https://example.com"'),
    ) &&
    assert(
      'block raw html: title inside svg',
      /<svg[^>]*>[\s\S]*<title>Icon<\/title>/.test(html),
    ) &&
    assert('block raw html: no placeholder', !html.includes('ICON_LINK'))
  if (!ok) failed++
}

// inline icon
{
  let svg = `<svg><title>Logout</title></svg>`
  let md = `this is the <a href="/logout">${svg}</a> icon`
  let html = markdown_to_html(md)
  let ok =
    assert('inline: single paragraph', /^<p>[\s\S]*<\/p>$/.test(html.trim())) &&
    assert('inline: has anchor', html.includes('<a href="/logout"')) &&
    assert(
      'inline: title inside svg',
      /<svg>[\s\S]*<title>Logout<\/title>/.test(html),
    ) &&
    assert('inline: no placeholder', !html.includes('ICON_LINK')) &&
    assert(
      'inline: text around link',
      html.includes('this is the') && html.includes('icon'),
    )
  if (!ok) failed++
}

process.exit(failed)
