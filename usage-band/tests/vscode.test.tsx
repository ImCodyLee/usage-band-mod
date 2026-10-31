import { describe, expect, test } from 'claude-code/testing'

describe('VS Code', () => {
  test('the pane gives way once VS Code draws the band', async ($, on) => {
    const store = new Map<string, unknown>()
    on('store.get', async (_, e) => ({ value: store.get(e.key) }))
    on('store.set', async (_, e) => {
      store.set(e.key, e.value)
      return { value: undefined }
    })
    const panes: string[] = []
    on('ui.open', async (_, e) => {
      panes.push(`open ${e.id}`)
      return { value: { isPlaced: true } }
    })
    on('ui.close', async (_, e) => {
      panes.push(`close ${e.id}`)
      return { value: undefined }
    })
    on('session.surfaces', async () => ({ value: ['vscode'] }))
    on('session.usage', async () => ({
      value: { startedAt: 0, context: { window: 200_000, percent: 42, tokens: 84_000 }, rateLimits: [] },
    }))
    on('command.register', async () => ({ value: { command: 'usage-band' } }))
    on('clock.now', async () => ({ value: 0 }))
    on('clock.after', async () => ({ value: undefined }))
    on('session.start', async (_, e) => ({ cwd: e.cwd }))

    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    expect(panes).toContain('open usage-band')

    const band = await $.ui.mount({
      plugin: 'usage-band',
      surface: 'vscode',
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 10 } as never,
    })
    expect(await band.find({ type: 'Text', text: /Ctx/ })).toBeDefined()
    await band.unmount()

    expect(store.get('vscodeDrawsBand')).toBe(true)
    expect(panes).toContain('close usage-band')

    // The next session in VS Code opens no pane.
    panes.length = 0
    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    expect(panes).not.toContain('open usage-band')
  })
})
