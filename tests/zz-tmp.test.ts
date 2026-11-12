import { test } from 'vitest'
import { parseCsv } from '../src/modules/import-export/csv'
test('x', () => {
  const s = 'a,b,c,d\n' + '1,"x"\n'.repeat(100000)
  const t0 = Date.now(); const r = parseCsv(s); console.error('ROWS', r.length, 'ms', Date.now() - t0)
}, 120000)
