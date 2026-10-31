# usage-band

A Claude Code mod that adds a band above the prompt:

    Ctx 42% 84k | Cache 52m | 5h 31% (2h) | Week 12% (4d) | Cost $3.17

## Install

In a terminal:

```bash
claude plugin marketplace add ImCodyLee/usage-band-mod
claude plugin install usage-band@usage-band-mod
```

Then start a new Claude session. Or paste this to Claude:

> Add the plugin marketplace `ImCodyLee/usage-band-mod`, install `usage-band` from it, and tell me to start a new session.

## Update

```bash
claude plugin marketplace update usage-band-mod
claude plugin update usage-band@usage-band-mod
```

## Use

See [usage-band/README.md](usage-band/README.md). `/usage-band [show|hide]` toggles the band.
