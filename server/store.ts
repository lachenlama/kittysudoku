import fs from 'node:fs'

export interface TeamStats { wins: number; streak: number; lastDailyDate: string | null; best: Record<string, number>; dailyDone: string[] }

const file = process.env.DATA_FILE || './data.json'
export const data: { teams: Record<string, TeamStats> } = (() => {
  try {
    const d = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (d && typeof d.teams === 'object') return d
  } catch { /* first run or unreadable: start empty */ }
  return { teams: {} }
})()

let timer: NodeJS.Timeout | undefined
export function flush() {
  clearTimeout(timer); timer = undefined
  try {
    fs.writeFileSync(file + '.tmp', JSON.stringify(data))
    fs.renameSync(file + '.tmp', file) // atomic swap
  } catch (e) { console.error('save failed', e) }
}
/** Debounced 500 ms save. */
export const save = () => { timer ??= setTimeout(flush, 500) }
process.on('SIGINT', () => { flush(); process.exit(0) })
process.on('SIGTERM', () => { flush(); process.exit(0) })

