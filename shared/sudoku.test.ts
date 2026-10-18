import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generate, countSolutions, findHint, seeded, type Difficulty, type Variant } from './sudoku'

const TARGET: Record<Variant, Record<Difficulty, number>> = {
  classic: { lion: 28, tiger: 25, panther: 0 },
  diagonal: { lion: 28, tiger: 25, panther: 0 },
  cages: { lion: 10, tiger: 4, panther: 0 },
}
const BUDGET: Record<Variant, number> = { classic: 1500, diagonal: 1500, cages: 3000 }

function validSolution(s: number[], variant: Variant) {
  const ok = (cells: number[]) => new Set(cells.map(i => s[i])).size === 9 && cells.every(i => s[i] >= 1 && s[i] <= 9)
  for (let u = 0; u < 9; u++) {
    assert.ok(ok(Array.from({ length: 9 }, (_, k) => u * 9 + k)), 'row')
    assert.ok(ok(Array.from({ length: 9 }, (_, k) => k * 9 + u)), 'col')
    assert.ok(ok(Array.from({ length: 9 }, (_, k) => ((u / 3) | 0) * 27 + (u % 3) * 3 + ((k / 3) | 0) * 9 + (k % 3))), 'box')
  }
  if (variant === 'diagonal') {
    assert.ok(ok(Array.from({ length: 9 }, (_, k) => k * 10)), 'diag \\')
    assert.ok(ok(Array.from({ length: 9 }, (_, k) => k * 8 + 8)), 'diag /')
  }
}

for (const variant of ['classic', 'diagonal', 'cages'] as Variant[]) {
  for (const d of ['lion', 'tiger', 'panther'] as Difficulty[]) {
    test(`generate ${variant} ${d}`, () => {
      const t = Date.now()
      const { puzzle, solution, cages } = generate(d, variant)
      const ms = Date.now() - t
      const clues = puzzle.filter(Boolean).length
      console.log(`${variant} ${d}: ${clues} clues, ${ms} ms`)
      assert.ok(ms < BUDGET[variant], `took ${ms} ms`)
      assert.equal(countSolutions(puzzle, 2, variant, cages), 1)
      validSolution(solution, variant)
      puzzle.forEach((v, i) => v && assert.equal(v, solution[i]))
      if (variant === 'cages') {
        assert.ok(cages);
        const seen = cages!.flatMap(c => c.cells)
        assert.equal(seen.length, 81)
        assert.equal(new Set(seen).size, 81)
        for (const c of cages!) {
          assert.equal(c.cells.reduce((a, i) => a + solution[i], 0), c.sum)
          assert.equal(new Set(c.cells.map(i => solution[i])).size, c.cells.length, 'no repeated digit in cage')
        }
      } else assert.equal(cages, undefined)
      if (d !== 'panther') assert.ok(clues <= TARGET[variant][d] + 2, `clues ${clues}`)
      else assert.ok(clues <= 30, `clues ${clues}`)
      const h = findHint(puzzle, solution, variant, cages)!
      assert.equal(h.value, solution[h.cell])
      assert.equal(puzzle[h.cell], 0)
      assert.ok(h.reason.length > 0)
    })
  }
}

test('same seed -> same puzzle (all variants), different seed differs', () => {
  for (const v of ['classic', 'diagonal', 'cages'] as Variant[]) {
    const a = generate('panther', v, seeded('2026-10-19'))
    const b = generate('panther', v, seeded('2026-10-19'))
    const c = generate('panther', v, seeded('2026-10-20'))
    assert.deepEqual(a, b)
    assert.notDeepEqual(a.solution, c.solution)
  }
})
