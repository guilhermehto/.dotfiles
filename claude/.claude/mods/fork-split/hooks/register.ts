import type { CommandRunResult, EngineInterface, Register } from 'claude-code'

function forkPaneArgv(sessionId: string, prompt: string): string[] {
  const claude = ['env', `CLAUDE_FORK_PARENT_SESSION=${sessionId}`, 'claude', '--resume', sessionId, '--fork-session']

  if (prompt !== '') {
    claude.push(prompt)
  }

  return ['zellij', 'run', '--direction', 'right', '--close-on-exit', '--name', 'fork', '--', ...claude]
}

function forkNote(parentSessionId: string): string {
  return `This is a side discussion forked with /fork-split from session ${parentSessionId}. The first prompt with this note starts the side discussion.`
}

function handoffPrompt(parentSessionId: string): string {
  return [
    `Write a handoff note for session ${parentSessionId}, the main session this side discussion was forked from.`,
    `Cover only the side discussion: the prompts with a note that names session ${parentSessionId}, and the replies to them.`,
    'State the main question or questions, then the conclusions and findings.',
    'Leave out the back-and-forth, the dead ends, and what the main session already knows.',
    'Do not use tools. Reply with the note alone.',
  ].join('\n')
}

function handoffMessage(note: string): string {
  return `Handoff from a side discussion forked from this session with /fork-split:\n\n${note}`
}

function readParentSessionId($: EngineInterface): Promise<string | undefined> {
  return $.env.get('CLAUDE_FORK_PARENT_SESSION')
}

async function zellijFailure($: EngineInterface, argv: string[]): Promise<string | undefined> {
  const command = argv.slice(0, 2).join(' ')

  try {
    const { exitCode, stderr } = await $.process.run(argv)

    if (exitCode !== 0) {
      return `${command} failed: ${stderr.trim()}`
    }
  } catch (error) {
    return `${command} did not start: ${String(error)}`
  }

  return undefined
}

async function closeForkPane($: EngineInterface): Promise<CommandRunResult> {
  const paneId = await $.env.get('ZELLIJ_PANE_ID')

  if (paneId === undefined) {
    return { text: 'Handed off to the main session. Not inside a zellij pane, so no pane was closed.' }
  }

  const failure = await zellijFailure($, ['zellij', 'action', 'close-pane', '--pane-id', paneId])

  if (failure !== undefined) {
    return { text: `Handed off to the main session, but the pane stays open: ${failure}` }
  }

  return { text: 'Handed off to the main session.' }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'fork-split',
      description: 'Fork this conversation into a new zellij pane on the right',
      argumentHint: '[prompt]',
    })
    await $.command.register({
      name: 'handoff',
      description: 'Send the findings of this fork to the main session and close the pane',
    })

    return next(e)
  })

  on('command.run', { command: 'fork-split' }, async ($, e) => {
    if ((await $.env.get('ZELLIJ')) === undefined) {
      return { text: 'Not inside a zellij session, so there is no pane to split.' }
    }

    const sessionId = await $.session.id()
    const failure = await zellijFailure($, forkPaneArgv(sessionId, e.args.trim()))

    if (failure !== undefined) {
      return { text: failure }
    }

    return { text: 'Forked this conversation into a pane on the right.' }
  })

  on('prompt.submit', async ($, e, next) => {
    const parentSessionId = await readParentSessionId($)

    if (parentSessionId === undefined) {
      return next(e)
    }

    return next({ ...e, context: [...(e.context ?? []), forkNote(parentSessionId)] })
  })

  on('command.run', { command: 'handoff' }, async $ => {
    const parentSessionId = await readParentSessionId($)

    if (parentSessionId === undefined) {
      return { text: 'This session was not opened by /fork-split, so there is no main session to hand off to.' }
    }

    const note = await $.model.fork({ prompt: handoffPrompt(parentSessionId) })

    if (!note.isAnswered && note.reason === 'nothing-to-fork') {
      return { text: 'Nothing to hand off yet. Discuss something in this fork first.' }
    }

    if (!note.isAnswered) {
      return { text: `No handoff note was written: ${note.reason}` }
    }

    const delivery = await $.session.send({ to: { sessionId: parentSessionId }, text: handoffMessage(note.text) })

    if (!delivery.isDelivered) {
      return { text: `The main session did not get the handoff: ${delivery.reason}` }
    }

    return closeForkPane($)
  })
}
