import { expect } from 'chai'
import { markdown_to_html } from '../src/convert'

describe('markdown to html (icon links)', () => {
  describe('block legacy [<svg>](url)', () => {
    let html: string
    let url = 'https://example.com/social'
    let linkTitle = 'Example social link'
    let svgTitle = 'Social icon'

    before(() => {
      let md = `
1

[<svg xmlns='http://www.w3.org/2000/svg' fill='currentColor' viewBox='0 0 72 72' role='presentation'>
<title>${svgTitle}</title>
<g>
<path d='M1 1h10v10H1z' />
</g>
  </svg>  ](${url} "${linkTitle}")

3
`
      html = markdown_to_html(md)
    })

    it('has anchor', () => {
      expect(html).to.include(`<a href="${url}"`)
    })

    it('keeps title inside svg', () => {
      expect(html).to.include(`<title>${svgTitle}</title>`)
      expect(html).to.match(
        new RegExp(`<svg[^>]*>[\\s\\S]*<title>${svgTitle}</title>`),
      )
    })

    it('has no placeholder', () => {
      expect(html).not.to.include('ICON_LINK')
    })

    it('has no double p', () => {
      expect(html).not.to.include('<p><p>')
    })

    it('wraps in p', () => {
      expect(html).to.match(/<p>[\s\S]*<a href/)
    })
  })

  describe('block raw html in markdown', () => {
    let html: string
    let url = 'https://example.com'
    let svgTitle = 'Icon'

    before(() => {
      let svg = `<svg xmlns="http://www.w3.org/2000/svg"><title>${svgTitle}</title><path d="M1"/></svg>`
      let md = `1\n\n<a href="${url}">${svg}</a>\n\n3`
      html = markdown_to_html(md)
    })

    it('has anchor', () => {
      expect(html).to.include(`<a href="${url}"`)
    })

    it('keeps title inside svg', () => {
      expect(html).to.match(
        new RegExp(`<svg[^>]*>[\\s\\S]*<title>${svgTitle}</title>`),
      )
    })

    it('has no placeholder', () => {
      expect(html).not.to.include('ICON_LINK')
    })
  })

  describe('inline icon', () => {
    let html: string
    let url = '/logout'
    let svgTitle = 'Logout'

    before(() => {
      let svg = `<svg><title>${svgTitle}</title></svg>`
      let md = `this is the <a href="${url}">${svg}</a> icon`
      html = markdown_to_html(md)
    })

    it('renders single paragraph', () => {
      expect(html.trim()).to.match(/^<p>[\s\S]*<\/p>$/)
    })

    it('has anchor', () => {
      expect(html).to.include(`<a href="${url}"`)
    })

    it('keeps title inside svg', () => {
      expect(html).to.match(
        new RegExp(`<svg>[\\s\\S]*<title>${svgTitle}</title>`),
      )
    })

    it('has no placeholder', () => {
      expect(html).not.to.include('ICON_LINK')
    })

    it('keeps text around link', () => {
      expect(html).to.include('this is the')
      expect(html).to.include('icon')
    })
  })
})
