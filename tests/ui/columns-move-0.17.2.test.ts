// 0.17.2 — a column header dragged onto another (the owner, 8 Nov 2026)
import { describe, expect, it } from 'vitest'
import { moveColumn } from '../../src/renderer/src/workspace/table/columns'

describe('moveColumn', () => {
  const order = ['type', 'status', 'links', 'priority', 'id', 'text']
  it('moving right lands after the target, moving left lands before it', () => {
    expect(moveColumn(order, 'type', 'links')).toEqual(['status', 'links', 'type', 'priority', 'id', 'text'])
    expect(moveColumn(order, 'text', 'status')).toEqual(['type', 'text', 'status', 'links', 'priority', 'id'])
  })
  it('No. and Title never move, and nothing moves onto them', () => {
    expect(moveColumn(order, 'title', 'type')).toBe(order)
    expect(moveColumn(order, 'type', 'number')).toBe(order)
    expect(moveColumn(order, 'type', 'type')).toBe(order)
    expect(moveColumn(order, 'unknown', 'type')).toBe(order)
  })
})
