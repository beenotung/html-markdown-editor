import { micromark } from 'micromark'
import { gfm, gfmHtml } from 'micromark-extension-gfm'
import { html } from 'very-small-parser'
import { toMdast } from 'very-small-parser/lib/html/toMdast'
import { toText as toMarkdown } from 'very-small-parser/lib/markdown/block/toText'

let statusNode = querySelector('#status')
let markdownEditor = querySelector<HTMLTextAreaElement>('#markdownEditor')
let htmlEditor = querySelector('#htmlEditor')
let clearFormatBtn = querySelector<HTMLButtonElement>('#clearFormatBtn')

function markdown_to_html(markdown_text: string) {
  let html_text = micromark(markdown_text, {
    allowDangerousHtml: true,
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()],
  })
  return html_text.trim()
}

function html_to_markdown(html_text: string) {
  // extract tables
  let container = document.createElement('div')
  container.innerHTML = html_text
  let plaintext = container.innerText.replaceAll(' ', '').replaceAll('\n', '')
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

  let html_ast = html.html.parsef(container.innerHTML)
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

  return markdown.trim()
}

function applyStyle() {
  htmlEditor.querySelectorAll('table').forEach(table => {
    table.style.borderCollapse = 'collapse'
    table.querySelectorAll<HTMLTableCellElement>('th,td').forEach(cell => {
      cell.style.border = '1px solid black'
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

function applyHTMLEditorEventListeners() {
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

markdownEditor.oninput = event => {
  let html_text = markdown_to_html(markdownEditor.value)
  htmlEditor.innerHTML = html_text
  applyStyle()
  applyHTMLEditorEventListeners()
}
htmlEditor.oninput = event => {
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
    markdownEditor.oninput?.(event)
  }
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
    if (node.childNodes.length !== 1) return
    let text = node.childNodes[0]
    if (!(text instanceof Text)) return
    let textContent = text.textContent
    let trimmed = textContent.trim()
    if (trimmed === textContent) return
    text.textContent = trimmed
  })

  // remove empty elements
  htmlEditor.querySelectorAll<HTMLElement>('span,p').forEach(node => {
    if (!node.innerText) {
      node.remove()
      return
    }
    if (node.childNodes.length != 1) return
    let text = node.childNodes[0]
    if (!(text instanceof Text)) return
    node.outerHTML = node.innerHTML
  })

  // unwrap styling elements
  htmlEditor.querySelectorAll('b,i,u,s').forEach(node => {
    node.outerHTML = node.innerHTML
  })

  applyStyle()

  htmlEditor.oninput?.(event)
}

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
