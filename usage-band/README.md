# usage-band

A Claude Code mod: a band above the prompt showing

    Ctx 42% 84k | Cache 52m | 5h 31% (2h) | Week 12% (4d) | Cost $3.17

- `/usage-band [show|hide]` toggles it (no argument flips it).
- The `[ Usage Bar ]` button in the prompt footer, next to the mode labels, toggles it too (terminal and desktop).
- VS Code extensions that draw the band above the prompt show it there, like the terminal and desktop. Older ones that do not get the same row in a "Usage" pane instead (closing the pane hides it until `/usage-band` again); once the mod sees VS Code draw the band, it closes that pane and stops opening it.
- Option `cacheTtl` (`1h` default, or `5m`) sets the cache timer's length; change it in the config menu.
- Colours: yellow at 70%, red at 90%; the cache timer goes yellow in its last 20%, red when expired.

## Where it's loaded from

It's installed from the `claude-mods` marketplace (this repo) as `usage-band@claude-mods`, so every
session loads it, in any project. Turn it off with `claude plugin disable usage-band@claude-mods` (or
the `/plugin` menu) and back on with `enable`. After an edit, raise `version` in `.claude-plugin/plugin.json` and run `claude plugin update usage-band@claude-mods`; it shows up in a new session.

## Editing it

Open a Claude Code session with this folder (`~/.claude/mods/usage-band`) as the working
directory and ask for the change. Claude should load the `plugin-authoring` skill first (it has the API
types for the running build) and check with `claude plugin validate .` afterwards.

- `hooks/register.tsx`: the code
- `tests/`: `claude plugin test .` runs them
- `types/index.d.ts`: the shapes of the values it keeps in `$.state`
- `.claude-plugin/plugin.json`: name, version, the `cacheTtl` option
