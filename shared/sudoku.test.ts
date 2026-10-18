import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generate, countSolutions, findHint, type Difficulty } from './sudoku'

const TARGET = { lion: 28, tiger: 25, panther: 0 }

function validSolution(s: number[]) {
  const ok = (cells: number[]) => new Set(cells.map(i => s[i])).size === 9 && cells.every(i => s[i] >= 1 && s[i] <= 9)
  for (let u = 0; u < 9; u++) {
    assert.ok(ok(Array.from({ length: 9 }, (_, k) => u * 9 + k)), 'row')
    assert.ok(ok(Array.from({ length: 9 }, (_, k) => k * 9 + u)), 'col')
    assert.ok(ok(Array.from({ length: 9 }, (_, k) => ((u / 3) | 0) * 27 + (u % 3) * 3 + ((k / 3) | 0) * 9 + (k % 3))), 'box')
  }
}

for (const d of ['lion', 'tiger', 'panther'] as Difficulty[]) {
  test(`generate ${d}`, () => {
    const t = Date.now()
    const { puzzle, solution } = generate(d)
    const ms = Date.now() - t
    const clues = puzzle.filter(Boolean).length
    console.log(`${d}: ${clues} clues, ${ms} ms`)
    assert.ok(ms < 1500, `took ${ms} ms`)
    assert.equal(countSolutions(puzzle, 2), 1)
    validSolution(solution)
    puzzle.forEach((v, i) => v && assert.equal(v, solution[i]))
    if (d !== 'panther') assert.ok(clues <= TARGET[d] + 2, `clues ${clues}`)
    else assert.ok(clues >= 17 && clues <= 30, `clues ${clues}`)
    const h = findHint(puzzle, solution)!
    assert.equal(h.value, solution[h.cell])
    assert.equal(puzzle[h.cell], 0)
    assert.ok(h.reason.length > 0)
  })
}
