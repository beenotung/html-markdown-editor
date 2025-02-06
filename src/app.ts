import { html, markdown } from 'very-small-parser'
import { toMdast } from 'very-small-parser/lib/html/toMdast'
import { toText as toHtml } from 'very-small-parser/lib/html/toText'
import { toHast } from 'very-small-parser/lib/markdown/block/toHast'
import { toText as toMarkdown } from 'very-small-parser/lib/markdown/block/toText'

let statusNode = querySelector('#status')
let markdownEditor = querySelector<HTMLTextAreaElement>('#markdownEditor')
let htmlEditor = querySelector('#htmlEditor')
let clearFormatBtn = querySelector<HTMLButtonElement>('#clearFormatBtn')

function markdown_to_html(markdown_text: string) {
  let markdown_ast = markdown.block.parse(markdown_text)
  let html_ast = toHast(markdown_ast)
  let html_text = toHtml(html_ast)
  return html_text
}

function html_to_markdown(html_text: string) {
  let html_ast = html.html.parsef(html_text)
  let md_ast = toMdast(html_ast)
  let markdown = toMarkdown(md_ast)
  return markdown
}

markdownEditor.oninput = event => {
  let html_text = markdown_to_html(markdownEditor.value)
  htmlEditor.innerHTML = html_text
}
htmlEditor.oninput = event => {
  let markdown_text = html_to_markdown(htmlEditor.innerHTML)

  let lines = markdown_text.split('\n')
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
  markdownEditor.value = lines.join('\n')
  if (changed) {
    markdownEditor.oninput?.(event)
  }
}

clearFormatBtn.onclick = event => {
  htmlEditor.querySelectorAll('*').forEach(node => {
    node.removeAttribute('style')
    node.removeAttribute('class')
    node.removeAttribute('id')
  })
  htmlEditor.querySelectorAll('span').forEach(span => {
    if (!span.innerText) {
      span.remove()
      return
    }
    if (span.childNodes.length != 1) return
    let text = span.childNodes[0]
    if (!(text instanceof Text)) return
    span.outerHTML = span.innerHTML
  })
  htmlEditor.querySelectorAll('b,i,u,s').forEach(node => {
    node.outerHTML = node.innerHTML
  })
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
