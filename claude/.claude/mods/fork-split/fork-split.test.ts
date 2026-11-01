import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { CommandRunResult, On } from 'claude-code'

const SESSION_ID = '5b1f0c1e-0000-4000-8000-000000000000'

function engineBeneath(on: On, exitCode: number, stderr = ''): (readonly string[])[] {
  const runs: (readonly string[])[] = []

  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: SESSION_ID }))
  on('process.run', (_, e) => {
    runs.push(e.argv)

    return { value: { exitCode, stdout: '', stderr, isStdoutTruncated: false, isStderrTruncated: false } }
  })

  return runs
}

async function forkSplit($: Engine, args = ''): Promise<CommandRunResult> {
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  return $.command.run({
    command: 'fork-split',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 200 },
  })
}

test('opens a forked claude in a pane on the right', async ($, on) => {
  mock.env(on, { ZELLIJ: '0' })
  const runs = engineBeneath(on, 0)

  const { text } = await forkSplit($)

  expect(text).toBe('Forked this conversation into a pane on the right.')
  expect(runs).toEqual([
    [
      'zellij', 'run', '--direction', 'right', '--close-on-exit', '--name', 'fork', '--',
      'env', `CLAUDE_FORK_PARENT_SESSION=${SESSION_ID}`, 'claude', '--resume', SESSION_ID, '--fork-session',
    ],
  ])
})

test('passes the arguments to the fork as its first prompt', async ($, on) => {
  mock.env(on, { ZELLIJ: '0' })
  const runs = engineBeneath(on, 0)

  await forkSplit($, '  why does the retry loop never end?  ')

  expect(runs[0]?.at(-1)).toBe('why does the retry loop never end?')
})

test('refuses to fork outside zellij', async ($, on) => {
  mock.env(on, {})
  const runs = engineBeneath(on, 0)

  const { text } = await forkSplit($)

  expect(text).toBe('Not inside a zellij session, so there is no pane to split.')
  expect(runs).toEqual([])
})

test('reports the zellij error when the pane does not open', async ($, on) => {
  mock.env(on, { ZELLIJ: '0' })
  engineBeneath(on, 1, 'There is no active session!\n')

  const { text } = await forkSplit($)

  expect(text).toBe('zellij run failed: There is no active session!')
})
