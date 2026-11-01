import type { Register } from 'claude-code'

const PARENT_SESSION_VARIABLE = 'CLAUDE_FORK_PARENT_SESSION'

function forkPaneArgv(sessionId: string, prompt: string): string[] {
  const claude = ['env', `${PARENT_SESSION_VARIABLE}=${sessionId}`, 'claude', '--resume', sessionId, '--fork-session']

  if (prompt !== '') {
    claude.push(prompt)
  }

  return ['zellij', 'run', '--direction', 'right', '--close-on-exit', '--name', 'fork', '--', ...claude]
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'fork-split',
      description: 'Fork this conversation into a new zellij pane on the right',
      argumentHint: '[prompt]',
    })

    return next(e)
  })

  on('command.run', { command: 'fork-split' }, async ($, e) => {
    if ((await $.env.get('ZELLIJ')) === undefined) {
      return { text: 'Not inside a zellij session, so there is no pane to split.' }
    }

    const sessionId = await $.session.id()
    const argv = forkPaneArgv(sessionId, e.args.trim())

    try {
      const { exitCode, stderr } = await $.process.run(argv)

      if (exitCode !== 0) {
        return { text: `zellij run failed: ${stderr.trim()}` }
      }
    } catch (error) {
      return { text: `zellij run did not start: ${String(error)}` }
    }

    return { text: 'Forked this conversation into a pane on the right.' }
  })
}
