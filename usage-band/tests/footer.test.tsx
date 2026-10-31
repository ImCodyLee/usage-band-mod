import { describe, expect, test } from 'claude-code/testing'

describe('Usage Bar footer button', () => {
  for (const surface of ['terminal', 'desktop'] as const) {
    test(`toggles the band on ${surface}`, async ($, on) => {
      on('session.surfaces', async () => ({ value: [surface] }))
      on('session.usage', async () => ({
        value: { startedAt: 0, context: { window: 200_000, percent: 42, tokens: 84_000 }, rateLimits: [] },
      }))

      // Stands in for the engine's own drawing, which the band passes to while hidden.
      on('ui.render', async ($, e) => {
        const { Text } = $.ui.resolve(e)
        return <Text>engine</Text>
      })

      const footer = await $.ui.mount({
        plugin: 'usage-band',
        surface,
        component: 'SessionMode',
        props: { modes: ['focus'] },
      })
      expect((await footer.find({ key: 'toggle' }))?.props.label).toBe('Usage Bar')
      // what the engine and other mods draw in the footer stays
      expect(await footer.find({ type: 'Text', text: 'engine' })).toBeDefined()

      const bandShows = async () => {
        const band = await $.ui.mount({
          plugin: 'usage-band',
          surface,
          component: 'AbovePrompt',
          props: { hasSurvey: false, isWorking: false, maxRows: 10 } as never,
        })
        const shown = (await band.find({ type: 'Text', text: /Ctx/ })) !== undefined
        await band.unmount()
        return shown
      }

      await footer.press({ key: 'toggle' })
      expect(await bandShows()).toBe(false)

      await footer.press({ key: 'toggle' })
      expect(await bandShows()).toBe(true)

      await footer.unmount()
    })
  }
})
