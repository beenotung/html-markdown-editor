import { expect } from 'chai'
import { clearFormatHtml } from '../src/clear-format'

let cases = [
  {
    name: 'removes styling attributes and trims text',
    input: `<p class="foo" style="color:red" id="x" dir="ltr"> hello </p>`,
    expected: `<p>hello</p>`,
  },
  {
    name: 'unwraps span and bold',
    input: `<p><span><b>hello</b></span></p>`,
    expected: `<p>hello</p>`,
  },
  {
    name: 'removes third br in br+br+br',
    input: `<p>a<br><br><br>b</p>`,
    expected: `<p>a<br><br>b</p>`,
  },
  {
    name: 'removes third empty block in a triple run',
    input: `<p></p><p><br></p><p></p><p>content</p>`,
    expected: `<div></div><p>content</p>`,
  },
  {
    name: 'replaces empty p with div',
    input: `<p></p>`,
    expected: `<div></div>`,
  },
  {
    name: 'removes empty div after p',
    input: `<p>text</p><div></div>`,
    expected: `<p>text</p>`,
  },
  {
    name: 'removes empty div before p',
    input: `<div></div><p>text</p>`,
    expected: `<p>text</p>`,
  },
  {
    name: 'keeps svg icon links intact',
    input: `<p><a href="https://example.com"><svg><title>Icon</title></svg></a></p>`,
    expected: `<p><a href="https://example.com"><svg><title>Icon</title></svg></a></p>`,
  },
  {
    name: 'unwraps span around svg in link',
    input: `<p><a href="https://example.com"><span><svg><title>Icon</title></svg></span></a></p>`,
    expected: `<p><a href="https://example.com"><svg><title>Icon</title></svg></a></p>`,
  },
]

describe('clear format', () => {
  for (let { name, input, expected } of cases) {
    it(name, () => {
      let actual = clearFormatHtml(input)
      expect(actual).to.equal(expected)
    })
  }
})
