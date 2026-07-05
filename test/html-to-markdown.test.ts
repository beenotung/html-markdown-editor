import { expect } from 'chai'
import { html_to_markdown } from '../src/convert'

let cases = [
  {
    name: 'div lines',
    input: `
<div>1</div>
<div>2</div>
<div>3</div>
`,
    expected: `
1  
2  
3
`,
  },
  {
    name: 'div with br',
    input: `
<div>1</div>
<div><br></div>
<div>2</div>
<div><br></div>
<div>3</div>
`,
    expected: `
1  
2  
3
`,
  },
  {
    name: 'p lines',
    input: `
<p>1</p>
<p>2</p>
<p>3</p>
`,
    expected: `
1

2

3
`,
  },
]

describe('html to markdown', () => {
  for (let { name, input, expected } of cases) {
    it(name, () => {
      let actual = html_to_markdown(input)
      expect(actual).to.equal(expected.trim())
    })
  }
})
