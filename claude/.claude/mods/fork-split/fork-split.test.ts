import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { CommandRunResult, ModelForkResult, On, SessionSendResult } from 'claude-code'

const SESSION_ID = '5b1f0c1e-0000-4000-8000-000000000000'
const PARENT_SESSION_ID = '9d3a7e2b-0000-4000-8000-000000000000'
const FORK_ENV = { ZELLIJ: '0', ZELLIJ_PANE_ID: '3', CLAUDE_FORK_PARENT_SESSION: PARENT_SESSION_ID }
const NO_USAGE = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
const FINDINGS_TEXT = 'Question: why does the retry loop never end?\nConclusion: the backoff resets on every error.'
const FINDINGS: ModelForkResult = { isAnswered: true, text: FINDINGS_TEXT, usage: NO_USAGE }
const DELIVERED: SessionSendResult = { isDelivered: true }

type SentMessage = { to: string; text: string }

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

function forkBeneath(on: On, findings: ModelForkResult, delivery: SessionSendResult): SentMessage[] {
  const sent: SentMessage[] = []

  on('model.fork', () => ({ value: findings }))
  on('session.send', (_, e) => {
    sent.push({ to: e.to, text: e.text })

    return delivery
  })

  return sent
}

function promptsBeneath(on: On): (readonly string[] | undefined)[] {
  const contexts: (readonly string[] | undefined)[] = []

  on('prompt.submit', (_, e) => {
    contexts.push(e.context)

    return { text: e.text }
  })

  return contexts
}

async function runCommand($: Engine, command: string, args = ''): Promise<CommandRunResult> {
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  return $.command.run({
    command,
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 200 },
  })
}

test('opens a forked claude in a pane on the right', async ($, on) => {
  mock.env(on, { ZELLIJ: '0' })
  const runs = engineBeneath(on, 0)

  const { text } = await runCommand($, 'fork-split')

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

  await runCommand($, 'fork-split', '  why does the retry loop never end?  ')

  expect(runs[0]?.at(-1)).toBe('why does the retry loop never end?')
})

test('refuses to fork outside zellij', async ($, on) => {
  mock.env(on, {})
  const runs = engineBeneath(on, 0)

  const { text } = await runCommand($, 'fork-split')

  expect(text).toBe('Not inside a zellij session, so there is no pane to split.')
  expect(runs).toEqual([])
})

test('reports the zellij error when the pane does not open', async ($, on) => {
  mock.env(on, { ZELLIJ: '0' })
  engineBeneath(on, 1, 'There is no active session!\n')

  const { text } = await runCommand($, 'fork-split')

  expect(text).toBe('zellij run failed: There is no active session!')
})

test('marks each prompt in a fork with a note that names the main session', async ($, on) => {
  mock.env(on, FORK_ENV)
  const contexts = promptsBeneath(on)

  await $.prompt.submit({ text: 'why does the retry loop never end?', origin: { kind: 'composer' }, wait: false })

  expect(contexts).toHaveLength(1)
  expect(contexts[0]?.at(-1)).toContain(PARENT_SESSION_ID)
})

test('leaves prompts outside a fork as typed', async ($, on) => {
  mock.env(on, {})
  const contexts = promptsBeneath(on)

  await $.prompt.submit({ text: 'why does the retry loop never end?', origin: { kind: 'composer' }, wait: false })

  expect(contexts).toEqual([undefined])
})

test('sends the findings to the main session and closes the fork pane', async ($, on) => {
  mock.env(on, FORK_ENV)
  const runs = engineBeneath(on, 0)
  const sent = forkBeneath(on, FINDINGS, DELIVERED)

  const { text } = await runCommand($, 'handoff')

  expect(text).toBe('Handed off to the main session.')
  expect(sent).toHaveLength(1)
  expect(sent[0]?.to).toContain(PARENT_SESSION_ID)
  expect(sent[0]?.text).toContain(FINDINGS_TEXT)
  expect(runs).toEqual([['zellij', 'action', 'close-pane', '--pane-id', '3']])
})

test('keeps the fork pane open when the main session does not get the findings', async ($, on) => {
  mock.env(on, FORK_ENV)
  const runs = engineBeneath(on, 0)
  forkBeneath(on, FINDINGS, { isDelivered: false, reason: 'The session is not running.' })

  const { text } = await runCommand($, 'handoff')

  expect(text).toBe('The main session did not get the handoff: The session is not running.')
  expect(runs).toEqual([])
})

test('reports the zellij error when the fork pane does not close', async ($, on) => {
  mock.env(on, FORK_ENV)
  engineBeneath(on, 1, 'No pane with id 3\n')
  forkBeneath(on, FINDINGS, DELIVERED)

  const { text } = await runCommand($, 'handoff')

  expect(text).toBe('Handed off to the main session, but the pane stays open: zellij action failed: No pane with id 3')
})

test('asks for a discussion first when the fork has nothing to hand off', async ($, on) => {
  mock.env(on, FORK_ENV)
  const runs = engineBeneath(on, 0)
  const sent = forkBeneath(on, { isAnswered: false, reason: 'nothing-to-fork' }, DELIVERED)

  const { text } = await runCommand($, 'handoff')

  expect(text).toBe('Nothing to hand off yet. Discuss something in this fork first.')
  expect(sent).toEqual([])
  expect(runs).toEqual([])
})

test('refuses to hand off from a session that fork-split did not open', async ($, on) => {
  mock.env(on, { ZELLIJ: '0', ZELLIJ_PANE_ID: '3' })
  const runs = engineBeneath(on, 0)
  const sent = forkBeneath(on, FINDINGS, DELIVERED)

  const { text } = await runCommand($, 'handoff')

  expect(text).toBe('This session was not opened by /fork-split, so there is no main session to hand off to.')
  expect(sent).toEqual([])
  expect(runs).toEqual([])
})
