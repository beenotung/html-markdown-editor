import { expect } from 'chai'
import { markdown_to_html } from '../src/convert'
import { renderLatex } from '../src/latex'

function markdown_to_html_with_latex(markdown: string) {
  let container = document.createElement('div')
  container.innerHTML = markdown_to_html(markdown)
  renderLatex(container)
  return container
}

function countKatexInline(container: HTMLElement) {
  return container.querySelectorAll('.katex-inline').length
}

function countKatexBlock(container: HTMLElement) {
  return container.querySelectorAll('.katex-block').length
}

function mathTex(container: HTMLElement) {
  return container.querySelector('annotation[encoding="application/x-tex"]')
    ?.textContent
}

function hasBlockMath(container: HTMLElement) {
  return container.querySelector('math[display="block"]') != null
}

let mixedDollarAndFormulaCases = [
  {
    name: 'multiple bare dollar amounts',
    markdown: 'dollar $100, $200 (end)',
    check(container: HTMLElement) {
      expect(container.innerHTML).to.equal('<p>dollar $100, $200 (end)</p>')
      expect(container.querySelector('math')).to.equal(null)
    },
  },
  {
    name: 'inline formula',
    markdown: 'inline formula $c = a + b$ (end)',
    check(container: HTMLElement) {
      expect(countKatexInline(container)).to.equal(1)
      expect(countKatexBlock(container)).to.equal(0)
      expect(hasBlockMath(container)).to.equal(false)
      expect(mathTex(container)).to.equal('c = a + b')
      expect(container.querySelector('p')?.innerHTML).to.match(
        /^inline formula /,
      )
      expect(container.querySelector('p')?.innerHTML).to.match(/ \(end\)$/)
    },
  },
  {
    name: 'block formula',
    markdown: 'block formula $$x = x + 1$$ (end)',
    check(container: HTMLElement) {
      expect(countKatexBlock(container)).to.equal(1)
      expect(countKatexInline(container)).to.equal(0)
      expect(hasBlockMath(container)).to.equal(true)
      expect(mathTex(container)).to.equal('x = x + 1')
      expect(container.textContent).to.include('block formula')
      expect(container.textContent).to.include('(end)')
    },
  },
]

let currencyCases = [
  {
    name: 'HK$ with K suffix',
    markdown: 'item (HK$123K), other (HK$456K)',
    expected: 'HK$123K',
  },
  {
    name: 'HK$ without K suffix',
    markdown: 'fee HK$99 only',
    expected: 'HK$99',
  },
  {
    name: 'HKD$ with K suffix',
    markdown: 'item (HKD$50K), other (HKD$80K)',
    expected: 'HKD$50K',
  },
  {
    name: 'HKD$ without K suffix',
    markdown: 'fee HKD$99 only',
    expected: 'HKD$99',
  },
  {
    name: 'bare $ amount',
    markdown: 'costs $100 each',
    expected: '$100',
  },
  {
    name: 'bare $ cross-match',
    markdown: 'paid ($100) and ($200) total',
    expected: '$100',
  },
]

describe('markdown to html (latex)', () => {
  for (let { name, markdown, expected } of currencyCases) {
    it(`does not render ${name} as latex`, () => {
      let container = markdown_to_html_with_latex(markdown)
      expect(countKatexInline(container)).to.equal(0)
      expect(container.textContent).to.include(expected)
    })
  }

  for (let { name, markdown, check } of mixedDollarAndFormulaCases) {
    it(name, () => {
      let container = markdown_to_html_with_latex(markdown)
      check(container)
    })
  }

  it('renders inline math starting with a digit', () => {
    let container = markdown_to_html_with_latex('value $2x$ here')
    expect(countKatexInline(container)).to.equal(1)
    expect(container.textContent).to.include('x')
  })
})
