import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, Register, RenderSurface, SessionRateLimit, SessionUsage } from 'claude-code'

import type { Limit, Usage } from '../types'

const usage = atom({ plugin: 'usage-band', key: 'usage' } as const, null as Usage | null)
const isHidden = atom({ plugin: 'usage-band', key: 'isHidden' } as const, false)
const lastRequestAt = atom({ plugin: 'usage-band', key: 'lastRequestAt' } as const, null as number | null)
const now = atom({ plugin: 'usage-band', key: 'now' } as const, 0)

const MINUTE = 60_000
const TICK_MS = 15_000

function limit(limits: SessionRateLimit[], kind: string): Limit | undefined {
  const found = limits.find(l => l.kind === kind)
  return found ? { percent: found.percentUsed, resetsAt: found.resetsAt } : undefined
}

function snapshot(u: Pick<SessionUsage, 'context' | 'rateLimits' | 'cost'>): Usage {
  return {
    contextPercent: u.context.percent,
    contextTokens: u.context.tokens,
    fiveHour: limit(u.rateLimits, 'five_hour'),
    sevenDay: limit(u.rateLimits, 'seven_day'),
    costUsd: u.cost?.usd,
  }
}

async function refresh($: EngineInterface) {
  const u = await $.session.usage()
  await update($, usage, () => snapshot(u))
}

async function tick($: EngineInterface) {
  const t = await $.clock.now()
  await update($, now, () => t)
}

const PANE = 'usage-band'

// Older VS Code extensions draw no AbovePrompt band, so there the row lives in a pane instead.
// Once VS Code is seen drawing the band, the pane is closed and not opened again.
const BAND_IN_EDITOR = 'vscodeDrawsBand'

const bandInEditor = async ($: EngineInterface) => (await $.store.get(BAND_IN_EDITOR)) === true

const needsPane = async ($: EngineInterface) =>
  (await $.session.surfaces()).includes('vscode') && !(await bandInEditor($))

async function setHidden($: EngineInterface, hidden: boolean) {
  await update($, isHidden, () => hidden)
  if (!(await needsPane($))) return
  if (hidden) await $.ui.close({ id: PANE })
  else await $.ui.open({ id: PANE, title: 'Usage' })
}

const tone = (percent: number | undefined) =>
  percent === undefined ? undefined : percent >= 90 ? 'red' : percent >= 70 ? 'yellow' : undefined

const ORANGE = '#f0883e'

const BAR_CELLS = 10

const barTone = (percent: number) => (percent >= 90 ? 'red' : percent >= 70 ? 'yellow' : 'green')

function bar(percent: number) {
  const filled = Math.min(BAR_CELLS, Math.max(0, Math.round((percent / 100) * BAR_CELLS)))
  return { filled: '█'.repeat(filled), empty: '░'.repeat(BAR_CELLS - filled) }
}

const BAR_W = 96
const BAR_H = 8

// A rounded track with a green→yellow→red gradient laid across its full width,
// so the fill's tip shows how close it is to the 70% and 90% thresholds.
function barSvg(percent: number) {
  const r = BAR_H / 2
  const clamped = Math.min(100, Math.max(0, percent))
  const w = clamped === 0 ? 0 : Math.max(BAR_H, (clamped / 100) * BAR_W)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BAR_W}" height="${BAR_H}" viewBox="0 0 ${BAR_W} ${BAR_H}">` +
    `<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${BAR_W}" y2="0">` +
    `<stop offset="0" stop-color="#3fb950"/><stop offset="0.6" stop-color="#3fb950"/>` +
    `<stop offset="0.8" stop-color="#d29922"/><stop offset="0.95" stop-color="#f85149"/>` +
    `</linearGradient></defs>` +
    `<rect width="${BAR_W}" height="${BAR_H}" rx="${r}" fill="#8b949e" fill-opacity="0.25"/>` +
    (w > 0 ? `<rect width="${w.toFixed(1)}" height="${BAR_H}" rx="${r}" fill="url(#g)"/>` : '') +
    `</svg>`
  )
}

const kilo =(tokens: number) => (tokens >= 1000 ? `${Math.round(tokens / 1000)}k` : `${tokens}`)

function resetsIn(iso: string | undefined, at: number) {
  if (!iso) return ''
  const minutes = Math.max(0, Math.round((Date.parse(iso) - at) / MINUTE))
  if (minutes < 60) return ` (${minutes}m)`
  const hours = Math.round(minutes / 60)
  return hours < 48 ? ` (${hours}h)` : ` (${Math.round(hours / 24)}d)`
}

async function drawUsage($: EngineInterface, els: Elements[RenderSurface], u: Usage, ttlMs: number) {
  const { Box, Text } = els
  const Svg = 'Svg' in els ? els.Svg : undefined
  const at = await read($, now)
  const last = await read($, lastRequestAt)
  const sep = <Text dimColor> | </Text>

  const left = last === null ? undefined : last + ttlMs - at
  const cacheText =
    left === undefined ? '–' : left <= 0 ? 'expired' : left < MINUTE ? '<1m' : `${Math.floor(left / MINUTE)}m`
  const cacheTone =
    left === undefined ? undefined : left <= 0 ? 'red' : left <= ttlMs * 0.2 ? 'yellow' : undefined

  return (
    <Box>
      <Text dimColor>Ctx </Text>
      {u.contextPercent === undefined ? (
        <Text>–</Text>
      ) : Svg ? (
        <Svg
          source={barSvg(u.contextPercent)}
          alt={`Context ${u.contextPercent}% full`}
          width={BAR_W}
          height={BAR_H}
        />
      ) : (
        <Text>
          <Text color={barTone(u.contextPercent)}>{bar(u.contextPercent).filled}</Text>
          <Text dimColor>{bar(u.contextPercent).empty}</Text>
        </Text>
      )}
      <Text dimColor>{u.contextTokens === undefined ? '' : ` ${kilo(u.contextTokens)}`}</Text>
      {sep}
      <Text dimColor>Cache </Text>
      <Text color={cacheTone ?? ORANGE}>{cacheText}</Text>
      {sep}
      <Text dimColor>5h </Text>
      <Text color={tone(u.fiveHour?.percent) ?? ORANGE}>{u.fiveHour ? `${u.fiveHour.percent}%` : '–'}</Text>
      <Text dimColor>{resetsIn(u.fiveHour?.resetsAt, at)}</Text>
      {sep}
      <Text dimColor>Week </Text>
      <Text color={tone(u.sevenDay?.percent) ?? ORANGE}>{u.sevenDay ? `${u.sevenDay.percent}%` : '–'}</Text>
      <Text dimColor>{resetsIn(u.sevenDay?.resetsAt, at)}</Text>
      {sep}
      <Text dimColor>Cost </Text>
      <Text color={ORANGE}>{u.costUsd === undefined ? '–' : `$${u.costUsd.toFixed(2)}`}</Text>
    </Box>
  )
}

export const register: Register = (on, options) => {
  const ttlMs = options.cacheTtl === '5m' ? 5 * MINUTE : 60 * MINUTE

  on('session.start', async ($, e, next) => {
    const ran = await next(e)
    await $.command.register({
      name: 'usage-band',
      description: 'Show or hide the usage band (show | hide; no argument toggles)',
    })
    await refresh($)
    await tick($)
    $.clock.every(TICK_MS, () => void tick($))
    if ((await needsPane($)) && !(await read($, isHidden))) void $.ui.open({ id: PANE, title: 'Usage' })
    return ran
  })

  on('session.attach', async ($, e, next) => {
    const ran = await next(e)
    if (e.surface === 'vscode' && !(await bandInEditor($)) && !(await read($, isHidden))) void $.ui.open({ id: PANE, title: 'Usage' })
    return ran
  })

  // Closing the pane by hand counts as hiding it, so the next /usage-band brings it back.
  on('ui.close', { id: PANE }, async ($, e, next) => {
    const ran = await next(e)
    if (e.origin.kind === 'person') await update($, isHidden, () => true)
    return ran
  })

  on('command.run', { command: 'usage-band' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const hidden = arg === 'hide' ? true : arg === 'show' ? false : !(await read($, isHidden))
    await setHidden($, hidden)
    if (!hidden) await refresh($)
    return { text: hidden ? 'Usage band hidden. /usage-band show brings it back.' : 'Usage band shown.' }
  })

  on('session.measure', async ($, e, next) => {
    await update($, usage, () => snapshot(e))
    return next(e)
  })

  // Every main-thread model request reads (and so re-warms) the prompt cache.
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    if (e.agentId === undefined) {
      const t = await $.clock.now()
      await update($, lastRequestAt, () => t)
      await update($, now, () => t)
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface === 'vscode' && !(await bandInEditor($))) {
      await $.store.set(BAND_IN_EDITOR, true)
      // Closed outside the draw; a plugin's close leaves isHidden alone.
      $.clock.after(0, () => void $.ui.close({ id: PANE }))
    }
    const u = await read($, usage)
    if (e.props.hasSurvey || u === null || (await read($, isHidden))) {
      return next(e)
    }
    return drawUsage($, $.ui.resolve(e), u, ttlMs)
  })

  // A "Usage Bar" button in the prompt footer toggles the band; what other mods and the engine
  // draw there (the mode labels) stays beside it.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const { Box, Button } = $.ui.resolve(e)
    const below = await next(e)
    return (
      <Box flexDirection="row" alignItems="center" gap={1}>
        {below}
        <Button
          key="toggle"
          label="Usage Bar"
          onPress={async () => {
            const hidden = !(await read($, isHidden))
            await setHidden($, hidden)
            if (!hidden) await refresh($)
          }}
        />
      </Box>
    )
  })

  // Where the VS Code extension draws no AbovePrompt band, the same row lives in a pane.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const u = await read($, usage)
    if (u === null) return <els.Text dimColor>Waiting for usage…</els.Text>
    return drawUsage($, els, u, ttlMs)
  })
}
