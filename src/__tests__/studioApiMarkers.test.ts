import {describe, it, expect} from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * The Studio delimits marked runs as [[1]] … [[/1]] and parses them back out.
 * If the prompt stops telling the model to preserve them, every italicised
 * term in every article silently becomes plain text — and nothing else would
 * fail, because the fallback is designed to degrade quietly.
 */
describe('translate prompt', () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'src/studioApi.ts'), 'utf8')

  it('tells the model that inline markers are structure', () => {
    expect(source).toContain('[[1]]')
    expect(source).toMatch(/never translate, renumber or drop them/i)
  })

  it('says the markers move with the words when word order changes', () => {
    expect(source).toMatch(/markers move with the words/i)
  })
})
