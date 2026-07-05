import { micromark } from 'micromark'
import { gfm, gfmHtml } from 'micromark-extension-gfm'
import { html } from 'very-small-parser'
import { toMdast } from 'very-small-parser/lib/html/toMdast'
import { toText as toMarkdown } from 'very-small-parser/lib/markdown/block/toText'

export function markdown_to_html(markdown_text: string) {
  var { markdown_text, iconLinkBlocks } = extractIconLinks(markdown_text)

  let html_text = micromark(markdown_text, {
    allowDangerousHtml: true,
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()],
  })

  // restore icon links
  for (let { placeholder, html } of iconLinkBlocks) {
    html_text = html_text.replace(placeholder, html)
  }

  let container = document.createElement('div')
  container.innerHTML = html_text
  container.querySelectorAll('input[type="checkbox"]').forEach(input => {
    input.removeAttribute('disabled')
  })
  return container.innerHTML.trim()
}

export function extractIconLinks(markdown_text: string) {
  /**
   * When micromark parses link with svg inside, a newline after <svg> makes it think the paragraph ended.
   * So we convert `[<svg>...</svg>](url "title")` into `<a href="url" title="title"><svg>...</svg></a>`,
   * where the title is optional.
   */
  markdown_text = markdown_text.replace(
    /\[(\s*<svg[\s\S]*?<\/svg>\s*)\]\((\S+?)(?:\s+(?:"([^"]*)"|'([^']*)'))?\)/gi,
    (_, svg, url, title1, title2) => {
      let title = title1 || title2
      let titleAttr = title ? ` title="${title}"` : ''
      return `<a href="${url}"${titleAttr}>${svg.trim()}</a>`
    },
  )

  /**
   * Find all `<a>…<svg>…</svg>…</a>` blocks,
   * store them into array and replace with placeholder `%%ICON_LINK_{I}%%`.
   */
  let iconLinkBlocks: { placeholder: string; html: string }[] = []
  markdown_text = markdown_text.replace(
    /<a\s[^>]*>[\s\S]*?<svg[\s\S]*?<\/svg>[\s\S]*?<\/a>/gi,
    (html, offset) => {
      let lineStart = markdown_text.lastIndexOf('\n', offset - 1) + 1
      let lineEnd = markdown_text.indexOf('\n', offset)
      if (lineEnd == -1) lineEnd = markdown_text.length
      let line = markdown_text.slice(lineStart, lineEnd)
      let entire_line = line.replace(html, '').trim().length == 0
      let placeholder = `%%ICON_LINK_${iconLinkBlocks.length + 1}%%`
      html = html.replace(/>\s+</g, '><').trim()
      iconLinkBlocks.push({ placeholder, html })
      return entire_line ? `\n\n${placeholder}\n\n` : placeholder
    },
  )
  return { markdown_text, iconLinkBlocks }
}

export function html_to_markdown(html_text: string) {
  let container = document.createElement('div')
  container.innerHTML = html_text

  normalizeHtmlForMarkdown(container)

  let plaintext = container.innerText.replaceAll(' ', '').replaceAll('\n', '')

  // convert checkbox to markdown
  for (let input of container.querySelectorAll<HTMLInputElement>(
    'li > input:first-child',
  )) {
    if (input.checked) {
      input.outerHTML = `[x]`
    } else {
      input.outerHTML = `[ ]`
    }
  }

  // extract icon links as raw html (micromark cannot round-trip [<svg>](url))
  let iconLinks: { placeholder: string; html: string; inline: boolean }[] = []
  for (let a of container.querySelectorAll('a')) {
    if (!a.querySelector('svg')) continue
    if (a.innerText.trim()) continue
    let placeholder
    for (let i = iconLinks.length + 1; ; i++) {
      placeholder = `[icon-link-${i}]`
      if (!plaintext.includes(placeholder)) break
    }
    iconLinks.push({
      placeholder,
      html: a.outerHTML,
      inline: hasSibling(a),
    })
    a.outerText = placeholder
    plaintext += placeholder
  }

  // extract tables
  let tables: { placeholder: string; rows: string[][] }[] = []
  for (let table of container.querySelectorAll('table')) {
    let placeholder
    for (let i = tables.length + 1; ; i++) {
      placeholder = `[table-${i}]`
      if (!plaintext.includes(placeholder)) {
        break
      }
    }
    let rows = Array.from(table.querySelectorAll('tr'), tr =>
      Array.from(tr.querySelectorAll('td,th'), cell => cell.innerHTML),
    )
    tables.push({ placeholder, rows })
    table.outerText = placeholder
    plaintext += placeholder
  }

  // export as html
  let html_patched = container.innerHTML
    .replaceAll('<br>', '<br/>')
    .replaceAll('<hr>', '<hr/>')
    .replaceAll('<br/>\n', '<br/>')
    .replaceAll('<hr/>\n', '<hr/>')
    .replace(/>\s+</g, '><')

  let html_ast = html.html.parsef(html_patched)
  let md_ast = toMdast(html_ast)
  let markdown = toMarkdown(md_ast)

  // restore tables
  for (let { placeholder, rows } of tables) {
    if (rows.length == 0) continue
    let [headers, ...rest] = rows
    let to = `| ${headers.join(' | ')} |\n`
    to += `| ${headers.map(() => '---').join(' | ')} |\n`
    for (let cols of rest) {
      to += `| ${cols.join(' | ')} |\n`
    }
    to = '\n\n' + to.trim() + '\n\n'
    markdown = markdown.replace(placeholder, to)
  }

  // restore icon links
  for (let { placeholder, html, inline } of iconLinks) {
    let replacement = inline ? html : `\n\n${html}\n\n`
    markdown = markdown.replace(placeholder, replacement)
  }

  return markdown.trim()
}

function hasSibling(a: HTMLAnchorElement) {
  let parent = a.parentElement
  if (!parent) return false
  return parent.innerHTML.replace(a.outerHTML, '').trim().length > 0
}

export function normalizeHtmlForMarkdown(container: HTMLElement) {
  // trim tailing whitespaces in main text
  if (container.childNodes.length === 1) {
    let child = container.firstChild
    if (child instanceof Text) {
      child.textContent = child.textContent.trimEnd()
      return
    }
  }

  // trim tailing whitespaces in each line
  for (let div of container.querySelectorAll('div')) {
    let child = div.lastChild
    if (child instanceof Text) {
      child.textContent = child.textContent.trimEnd()
    }
  }

  // remove empty spacer divs
  for (let div of container.querySelectorAll('div')) {
    if (/^\s*<br\s*\/?>\s*$/i.test(div.innerHTML)) {
      div.remove()
    }
  }

  // merge consecutive divs with <br>
  for (let index = container.children.length - 1; index > 0; index--) {
    let child = container.children[index]
    if (child.tagName.toLowerCase() != 'div') continue
    let prev = container.children[index - 1]
    if (prev.tagName.toLowerCase() != 'div') continue
    prev.innerHTML += '<br>' + child.innerHTML
    child.remove()
  }
}
