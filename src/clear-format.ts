export function hasMedia(node: Element) {
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

export function isEmptyBlock(node: Node | null): boolean {
  if (!(node instanceof HTMLElement)) return false
  if (!node.parentElement) return false
  let tagName = node.tagName.toLowerCase()
  if (tagName !== 'p' && tagName !== 'div') return false
  let html = node.innerHTML.trim()
  return html.length === 0 || html === '<br>'
}

export function clearFormat(container: HTMLElement) {
  // remove styling attributes
  container.querySelectorAll('*').forEach(node => {
    let attrs = ['style', 'class', 'id', 'dir', 'aria-level']
    for (let attr of attrs) {
      node.removeAttribute(attr)
    }
  })

  // trim whitespace
  container.querySelectorAll('*').forEach(node => {
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
  container.querySelectorAll<HTMLSpanElement>('span').forEach(span => {
    if (span.closest('pre,code')) return
    span.outerHTML = span.innerHTML
  })

  // unwrap styling elements
  container.querySelectorAll('b,i,u,s').forEach(node => {
    node.outerHTML = node.innerHTML
  })

  // remove excessive newlines
  let nodes = container.querySelectorAll('br+br+br')
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
  nodes = container.querySelectorAll(':is(p,div)+:is(p,div)+:is(p,div)')
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
  container.querySelectorAll('p').forEach(p => {
    if (!isEmptyBlock(p)) return
    p.outerHTML = '<div></div>'
  })

  // remove empty <div> siblings of <p>
  container.querySelectorAll('div').forEach(div => {
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
}

export function clearFormatHtml(html: string) {
  let container = document.createElement('div')
  container.innerHTML = html
  clearFormat(container)
  return container.innerHTML
}
