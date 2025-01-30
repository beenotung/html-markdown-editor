import { html, markdown } from 'very-small-parser'
import { toMdast } from 'very-small-parser/lib/html/toMdast'
import { toText as toHtml } from 'very-small-parser/lib/html/toText'
import { toHast } from 'very-small-parser/lib/markdown/block/toHast'
import { toText as toMarkdown } from 'very-small-parser/lib/markdown/block/toText'

let statusNode = querySelector('#status')
let markdownEditor = querySelector<HTMLTextAreaElement>('#markdownEditor')
let htmlEditor = querySelector('#htmlEditor')

markdownEditor.oninput = () => {
  let md_ast = markdown.block.parse(markdownEditor.value)
  let html_ast = toHast(md_ast)
  htmlEditor.innerHTML = toHtml(html_ast)
}
htmlEditor.oninput = () => {
  let html_ast = html.html.parsef(htmlEditor.innerHTML)
  let md_ast = toMdast(html_ast)
  markdownEditor.value = toMarkdown(md_ast)
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
