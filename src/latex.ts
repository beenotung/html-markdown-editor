import katex from 'katex'

// Avoid currency like HK$528K and cross-matches between multiple HK$ amounts.
export let inlineLatexPattern = /(?<![A-Za-z$])\$([^\$\n]+?)\$(?!\$|\d)/g

export function replaceInlineLatex(
  text: string,
  render: (math: string) => string,
): string {
  return text.replace(inlineLatexPattern, (full, math: string) => {
    if (!math) return full
    return render(math)
  })
}

function shouldSkipLatexTextNode(textNode: Text) {
  let parent = textNode.parentElement
  if (!parent) return true
  if (parent.closest('pre, code, .katex-inline, .katex-block')) return true
  return false
}

export function renderInlineLatexInElement(
  container: HTMLElement,
  render: (math: string) => string,
) {
  let walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let textNodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode())) {
    let textNode = node as Text
    if (shouldSkipLatexTextNode(textNode)) continue
    textNodes.push(textNode)
  }

  for (let textNode of textNodes) {
    let text = textNode.textContent ?? ''
    let replaced = replaceInlineLatex(text, render)
    if (replaced === text) continue
    let template = document.createElement('span')
    template.innerHTML = replaced
    textNode.replaceWith(...Array.from(template.childNodes))
  }
}

export function renderLatex(container: HTMLElement) {
  let html = container.innerHTML

  // Unwrap pre/code blocks that contain $$ (block LaTeX)
  html = html.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, (_, content) => {
    if (content.includes('$$')) {
      return content
    }
    return `<pre><code>${content}</code></pre>`
  })

  // Handle block LaTeX ($$...$$)
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

  container.innerHTML = html

  // Handle inline LaTeX ($...$) per text node - skip currency like HK$528K
  renderInlineLatexInElement(container, math => {
    try {
      let rendered = katex.renderToString(math, {
        displayMode: false,
        throwOnError: false,
      })
      return `<span class="katex-inline">${rendered}</span>`
    } catch (error) {
      console.error('KaTeX render error:', error)
      return `$${math}$`
    }
  })
}
