import { JSDOM } from 'jsdom'

let dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
let { window } = dom

global.document = window.document
global.window = window as unknown as Window & typeof globalThis
global.Node = window.Node
global.Text = window.Text
global.NodeFilter = window.NodeFilter
global.HTMLElement = window.HTMLElement
global.HTMLAnchorElement = window.HTMLAnchorElement
global.HTMLInputElement = window.HTMLInputElement

if (!window.HTMLElement.prototype.innerText) {
  Object.defineProperty(window.HTMLElement.prototype, 'innerText', {
    configurable: true,
    get() {
      return this.textContent ?? ''
    },
    set(value: string) {
      this.textContent = value
    },
  })
}
