import { micromark } from 'micromark'
import { gfm, gfmHtml } from 'micromark-extension-gfm'
import { html } from 'very-small-parser'
import { toMdast } from 'very-small-parser/lib/html/toMdast'
import { toText as toMarkdown } from 'very-small-parser/lib/markdown/block/toText'
import mermaid from 'mermaid'
import katex from 'katex'

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
})

let statusNode = querySelector('#status')
let markdownEditor = querySelector<HTMLTextAreaElement>('#markdownEditor')
let htmlEditor = querySelector('#htmlEditor')
let clearFormatBtn = querySelector<HTMLButtonElement>('#clearFormatBtn')
let copyRichBtn = querySelector<HTMLButtonElement>('#copyRichBtn')
let copyHtmlBtn = querySelector<HTMLButtonElement>('#copyHtmlBtn')
let copyMarkdownBtn = querySelector<HTMLButtonElement>('#copyMarkdownBtn')
let latexToggle = querySelector<HTMLInputElement>('#latexToggle')
let mermaidToggle = querySelector<HTMLInputElement>('#mermaidToggle')
let toast = querySelector('#toast')

let toastTimeout: number | undefined

function markdown_to_html(markdown_text: string) {
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

function extractIconLinks(markdown_text: string) {
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

function html_to_markdown(html_text: string) {
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

function normalizeHtmlForMarkdown(container: HTMLElement) {
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

// unescape style elements in text nodes
function unescapeStyleElements(node: ChildNode) {
  if (node instanceof Text) {
    let text = node.textContent.trim()
    if (!text.startsWith('<style>') || !text.endsWith('</style>')) return
    let style = document.createElement('style')
    style.textContent = text.slice('<style>'.length, -'</style>'.length)
    debugger
    node.replaceWith(style)
    return
  }
  if (!(node instanceof HTMLElement)) return
  if (node.tagName.toLowerCase() == 'code') return
  node.childNodes.forEach(child => {
    unescapeStyleElements(child)
  })
}

async function renderMermaid(container: HTMLElement) {
  let counter = 0
  let elements = container.querySelectorAll(
    'pre.language-mermaid, code.language-mermaid',
  )
  for (let code of elements) {
    let pre =
      code.tagName === 'PRE'
        ? (code as HTMLPreElement)
        : (code.closest('pre') as HTMLPreElement)
    if (!pre) continue
    let content = code.textContent || ''
    if (!content.trim()) continue
    let id = `mermaid-${++counter}`
    try {
      let { svg } = await mermaid.render(id, content)
      let div = document.createElement('div')
      div.className = 'mermaid-diagram'
      div.innerHTML = svg
      div.style.display = 'flex'
      div.style.justifyContent = 'center'
      div.style.padding = '1rem'
      pre.replaceWith(div)
    } catch (error) {
      console.error('Mermaid render error:', error)
    }
  }
}

function renderLatex(container: HTMLElement) {
  let html = container.innerHTML

  // Unwrap pre/code blocks that contain $$ (block LaTeX)
  // Replace <pre><code>...</code></pre> with just the content
  html = html.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, (_, content) => {
    if (content.includes('$$')) {
      return content // Will be processed below
    }
    return `<pre><code>${content}</code></pre>`
  })

  // Handle block LaTeX ($$...$$) - now after unwrapping
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    math = math.trim()
    if (!math) return ''
    try {
      let rendered = katex.renderToString(math, {
        displayMode: true,
        throwOnError: false,
      })
      return `<div class="katex-block" style="display:flex;justify-content:center;padding:0.5rem;">${rendered}</div>`
    } catch (error) {
      console.error('KaTeX render error:', error)
      return _
    }
  })

  // Handle inline LaTeX ($...$) - must not start with $$
  html = html.replace(/(?<!\$)\$([^\$\n]+?)\$(?!\$)/g, (_, math) => {
    if (!math) return _
    try {
      let rendered = katex.renderToString(math, {
        displayMode: false,
        throwOnError: false,
      })
      return `<span class="katex-inline">${rendered}</span>`
    } catch (error) {
      console.error('KaTeX render error:', error)
      return _
    }
  })

  container.innerHTML = html
}

function applyStyle() {
  unescapeStyleElements(htmlEditor)

  htmlEditor.querySelectorAll('table').forEach(table => {
    table.style.borderCollapse = 'collapse'
    table.querySelectorAll<HTMLTableCellElement>('th,td').forEach(cell => {
      cell.style.border = '1px solid black'
      cell.style.padding = '0.25rem 0.5rem'
    })
  })
  htmlEditor.querySelectorAll('pre').forEach(pre => {
    pre.style.border = '1px solid black'
    pre.style.width = 'fit-content'
    pre.style.padding = '0.5rem'
  })
  htmlEditor
    .querySelectorAll<HTMLElement>('code:not(pre code)')
    .forEach(code => {
      code.style.background = '#eee'
      code.style.padding = '0.1rem 0.25rem'
      code.style.borderRadius = '0.25rem'
    })
}

function isTableCellEmpty(cell: HTMLTableCellElement) {
  return !cell.innerText.trim()
}

function deleteEmptyTableRowsAndCols(table: HTMLTableElement) {
  let changed = true
  while (changed) {
    changed = false

    for (let rowIndex = table.rows.length - 1; rowIndex >= 0; rowIndex--) {
      let row = table.rows[rowIndex]
      let allEmpty = Array.from(row.cells).every(isTableCellEmpty)
      if (!allEmpty) continue
      row.remove()
      changed = true
    }

    if (table.rows.length == 0) {
      table.remove()
      return
    }

    let colCount = table.rows[0].cells.length
    for (let colIndex = colCount - 1; colIndex >= 0; colIndex--) {
      let allEmpty = true
      for (let row of table.rows) {
        if (!row.cells[colIndex] || !isTableCellEmpty(row.cells[colIndex])) {
          allEmpty = false
          break
        }
      }
      if (!allEmpty) continue
      for (let row of table.rows) {
        row.cells[colIndex]?.remove()
      }
      changed = true
    }
  }

  if (table.rows.length == 0 || table.rows[0].cells.length == 0) {
    table.remove()
  }
}

function applyHTMLEditorEventListeners() {
  htmlEditor
    .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    .forEach(input => {
      input.onchange = () => {
        if (input.checked) {
          input.setAttribute('checked', '')
        } else {
          input.removeAttribute('checked')
        }
        updateFromHtmlEditor()
      }
    })

  htmlEditor.querySelectorAll('table').forEach(table => {
    function showDialog(event: MouseEvent) {
      let td = (event.target as HTMLElement)?.closest('td,th')
      if (!td) return
      let tr = td.closest('tr')!
      let dialog = document.createElement('dialog')
      dialog.innerHTML = /* html */ `
        <div style="display: flex; justify-content: flex-end;">
          <button data-action="mute" title="Restore right-click in the table for devtool inspect, until right-click outside the table">Mute</button>
          <button data-action="close">Close</button>
        </div>

        <h2>Table Operations</h2>
        <button data-action="deleteTable">Delete Table</button>
        <button data-action="deleteEmptyRowsAndCols">Delete Empty Rows/Cols</button>

        <h2>Row Operations</h2>
        <button data-action="deleteRow">Delete Row</button>
        <button data-action="insertRowBefore">Insert Row Before</button>
        <button data-action="insertRowAfter">Insert Row After</button>

        <h2>Column Operations</h2>
        <button data-action="deleteCol">Delete Column</button>
        <button data-action="insertColBefore">Insert Column Before</button>
        <button data-action="insertColAfter">Insert Column After</button>
      `
      function getIndex() {
        let index = 0
        for (let cell of tr.cells) {
          if (cell == td) break
          index++
        }
        return index
      }

      function createCell(html?: string) {
        let td = document.createElement('td')
        td.style.border = '1px solid black'
        if (html) {
          td.innerHTML = html
        } else {
          td.appendChild(document.createElement('br'))
        }
        return td
      }

      function createRow() {
        let n = tr.cells.length
        let newRow = document.createElement('tr')
        for (let i = 0; i < n; i++) {
          let newCell = createCell()
          newRow.appendChild(newCell)
        }
        return newRow
      }

      let actions = {
        mute() {
          actions.close()
          table.oncontextmenu = null
          document.body.oncontextmenu = event => {
            let target = event.target as HTMLElement
            if (target.closest('table') == table) {
              return
            }
            table.oncontextmenu = showDialog
            document.body.oncontextmenu = null
          }
        },
        close() {
          dialog.close()
        },
        deleteTable() {
          table.remove()
          actions.close()
        },
        deleteEmptyRowsAndCols() {
          deleteEmptyTableRowsAndCols(table)
          actions.close()
        },
        deleteRow() {
          let tr = td.closest('tr')!
          tr.remove()
          actions.close()
        },
        insertRowBefore() {
          let newRow = createRow()
          tr.before(newRow)
          actions.close()
        },
        insertRowAfter() {
          let newRow = createRow()
          tr.after(newRow)
          actions.close()
        },
        deleteCol() {
          let index = getIndex()
          for (let tr of table.rows) {
            tr.cells[index].remove()
          }
          actions.close()
        },
        insertColBefore() {
          let index = getIndex()
          for (let tr of table.rows) {
            tr.cells[index].before(createCell('&nbsp;'))
          }
          actions.close()
        },
        insertColAfter() {
          let index = getIndex()
          for (let tr of table.rows) {
            tr.cells[index].after(createCell('&nbsp;'))
          }
          actions.close()
        },
      }
      for (let [key, value] of Object.entries(actions)) {
        let button = dialog.querySelector<HTMLButtonElement>(
          `button[data-action="${key}"]`,
        )!
        button.onclick = value
      }
      table.insertAdjacentElement('afterend', dialog)
      dialog.showModal()
      event.preventDefault()
      return false
    }
    table.oncontextmenu = showDialog
  })
}

async function updateFromMarkdownEditor() {
  let html_text = markdown_to_html(markdownEditor.value)
  htmlEditor.innerHTML = html_text
  applyStyle()
  applyHTMLEditorEventListeners()
  if (latexToggle.checked) {
    renderLatex(htmlEditor)
  }
  if (mermaidToggle.checked) {
    await renderMermaid(htmlEditor)
  }
}
markdownEditor.oninput = updateFromMarkdownEditor

function updateFromHtmlEditor() {
  // remove extra <br> tags in list items
  htmlEditor.querySelectorAll('li br').forEach(br => {
    let li = br.parentElement!
    if (br == li.childNodes[li.childNodes.length - 1]) {
      br.outerHTML = '<span></span>'
    }
  })

  // fix nested list items
  htmlEditor.querySelectorAll('ul > ul').forEach(ul => {
    let li = ul.previousElementSibling
    if (li && li.tagName == 'LI') {
      li.appendChild(ul)
    } else {
      ul.outerHTML = `<li>${ul.innerHTML}</li>`
    }
  })

  // unwrap span tags in list items
  htmlEditor.querySelectorAll<HTMLSpanElement>('li span').forEach(span => {
    let li = span.parentElement!
    if (li.childNodes.length == 1) {
      li.innerText = span.innerText
    }
  })

  // unwrap text elements copied from word documents
  htmlEditor.querySelectorAll('font').forEach(font => {
    if (font.childNodes.length != 1) return
    let text = font.childNodes[0]
    if (!(text instanceof Text)) return
    font.outerHTML = font.innerHTML
  })

  // unwrap text elements copied from google doc
  htmlEditor.querySelectorAll('span').forEach(span => {
    if (span.childNodes.length != 1) return
    let weight = +span.style.fontWeight
    if (weight > 400) {
      span.outerHTML = span.innerText.bold()
      return
    }
    span.outerHTML = span.innerHTML
  })
  htmlEditor
    .querySelectorAll('span[id*="docs-internal-guid"]')
    .forEach(span => {
      span.outerHTML = span.innerHTML
    })

  let markdown_text = html_to_markdown(htmlEditor.innerHTML)

  let lines = markdown_text.split('\n')

  // remove heading tags with span tags
  let changed = false
  lines.forEach((line, index) => {
    // e.g. `### <span style="font-weight: normal;">Phase 1: Core Features</span>`
    let match = line.match(
      /^(#+) <span style="font-weight: normal;">(.*)<\/span>$/,
    )
    if (!match) return
    let heading = match[1]
    let title = match[2]
    lines[index] = `${heading} ${title}`
    changed = true
  })

  markdownEditor.value = lines.join('\n').replaceAll('<span />', '')

  applyHTMLEditorEventListeners()

  if (changed) {
    updateFromMarkdownEditor()
  }
}
htmlEditor.oninput = updateFromHtmlEditor

function hasMedia(node: Element) {
  let tagName = node.tagName.toLowerCase()
  switch (tagName) {
    case 'img':
    case 'audio':
    case 'video':
      return !!node.getAttribute('src')
    case 'svg':
      return true
  }
  for (let child of node.children) {
    if (hasMedia(child)) {
      return true
    }
  }
  return false
}

clearFormatBtn.onclick = event => {
  // remove styling attributes
  htmlEditor.querySelectorAll('*').forEach(node => {
    let attrs = ['style', 'class', 'id', 'dir', 'aria-level']
    for (let attr of attrs) {
      node.removeAttribute(attr)
    }
  })

  // trim whitespace
  htmlEditor.querySelectorAll('*').forEach(node => {
    if (hasMedia(node)) {
      return
    }
    if (node.childNodes.length !== 1) return
    let text = node.childNodes[0]
    if (!(text instanceof Text)) return
    let textContent = text.textContent
    let trimmed = textContent.trim()
    if (trimmed === textContent) return
    text.textContent = trimmed
  })

  // unwrap span elements
  htmlEditor.querySelectorAll<HTMLSpanElement>('span').forEach(span => {
    if (span.closest('pre,code')) return
    span.outerHTML = span.innerHTML
  })

  // unwrap styling elements
  htmlEditor.querySelectorAll('b,i,u,s').forEach(node => {
    node.outerHTML = node.innerHTML
  })

  // remove excessive newlines
  let nodes = htmlEditor.querySelectorAll('br+br+br')
  for (let i = nodes.length - 1; i >= 0; i--) {
    let third = nodes[i]
    let second = third.previousSibling
    if (
      !(second instanceof HTMLElement && second.tagName.toLowerCase() === 'br')
    ) {
      continue
    }
    let first = second.previousSibling
    if (
      !(first instanceof HTMLElement && first.tagName.toLowerCase() === 'br')
    ) {
      continue
    }
    third.remove()
  }
  nodes = htmlEditor.querySelectorAll(':is(p,div)+:is(p,div)+:is(p,div)')
  for (let i = nodes.length - 1; i >= 0; i--) {
    let third = nodes[i]
    if (!isEmptyBlock(third)) continue

    let second = third.previousSibling
    if (!isEmptyBlock(second)) continue

    let first = second!.previousSibling
    if (!isEmptyBlock(first)) continue

    third.remove()
  }

  // replace empty <p> with <div>
  htmlEditor.querySelectorAll('p').forEach(p => {
    if (!isEmptyBlock(p)) return
    p.outerHTML = '<div></div>'
  })

  // remove empty <div> siblings of <p>
  htmlEditor.querySelectorAll('div').forEach(div => {
    if (!isEmptyBlock(div)) return
    let prev = div.previousSibling
    if (prev instanceof HTMLElement && prev.tagName.toLowerCase() === 'p') {
      div.remove()
      return
    }
    let next = div.nextSibling
    if (next instanceof HTMLElement && next.tagName.toLowerCase() === 'p') {
      div.remove()
      return
    }
  })

  applyStyle()

  updateFromHtmlEditor()
}

// empty div or p
function isEmptyBlock(node: Node | null): boolean {
  if (!(node instanceof HTMLElement)) return false
  if (!node.parentElement) return false
  let tagName = node.tagName.toLowerCase()
  if (tagName !== 'p' && tagName !== 'div') return false
  let html = node.innerHTML.trim()
  return html.length === 0 || html === '<br>'
}

function showToast(msg: string, anchor: HTMLElement) {
  let rect = anchor.getBoundingClientRect()
  toast.style.top = rect.bottom + 12 + 'px'
  toast.style.left = rect.left + rect.width / 2 + 'px'
  toast.style.transform = 'translateX(-50%)'
  toast.textContent = msg
  toast.classList.add('show')
  clearTimeout(toastTimeout)
  toastTimeout = window.setTimeout(() => {
    toast.classList.remove('show')
  }, 2000)
}

copyRichBtn.onclick = async event => {
  let html = htmlEditor.innerHTML
  let text = htmlEditor.innerText
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    }),
  ])
  copyRichBtn.textContent = '✓'
  setTimeout(() => {
    copyRichBtn.textContent = 'R'
  }, 2000)
  showToast('Copied Rich Text', copyRichBtn)
}

copyHtmlBtn.onclick = async event => {
  let html = htmlEditor.innerHTML
  await navigator.clipboard.writeText(html)
  copyHtmlBtn.textContent = '✓'
  setTimeout(() => {
    copyHtmlBtn.textContent = 'H'
  }, 2000)
  showToast('Copied Raw HTML', copyHtmlBtn)
}

copyMarkdownBtn.onclick = async event => {
  let markdown = markdownEditor.value
  await navigator.clipboard.writeText(markdown)
  copyMarkdownBtn.textContent = '✓'
  setTimeout(() => {
    copyMarkdownBtn.textContent = 'M'
  }, 2000)
  showToast('Copied Markdown', copyMarkdownBtn)
}

latexToggle.onchange = updateFromMarkdownEditor
mermaidToggle.onchange = updateFromMarkdownEditor

function calcSize() {
  let html = htmlEditor.innerHTML
  let markdown = markdownEditor.value

  htmlEditor.textContent = ''
  markdownEditor.value = ''

  htmlEditor.style.maxHeight = ''
  markdownEditor.style.maxHeight = ''

  let rect = htmlEditor.getBoundingClientRect()
  htmlEditor.style.maxHeight = rect.height + 'px'

  rect = markdownEditor.getBoundingClientRect()
  markdownEditor.style.maxHeight = rect.height + 'px'

  htmlEditor.innerHTML = html
  markdownEditor.value = markdown
}

window.addEventListener('resize', calcSize)

htmlEditor.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey) {
    switch (event.key) {
      case 'b':
        document.execCommand('bold')
        break
      case 'i':
        document.execCommand('italic')
        break
      case 'u':
        document.execCommand('underline')
        break
      case 's':
        document.execCommand('strikethrough')
        break
      case 'k':
        document.execCommand('insertOrderedList')
        break
      case 'o':
        document.execCommand('insertUnorderedList')
        break
      default:
        return
    }
    event.preventDefault()
  }
})

statusNode.textContent = ''
calcSize()

function querySelector<E extends HTMLElement>(selector: string) {
  let element = document.querySelector<E>(selector)
  if (!element) {
    throw new Error(`Element not found: "${selector}"`)
  }
  return element
}
