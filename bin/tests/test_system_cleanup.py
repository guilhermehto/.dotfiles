import os
import pathlib
import subprocess
import tempfile
import time
import unittest

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / '.local/bin/system_cleanup'
TWO_DAYS = 2 * 24 * 60 * 60


class SystemCleanupTest(unittest.TestCase):
    def setUp(self):
        workspace = tempfile.TemporaryDirectory()
        self.addCleanup(workspace.cleanup)
        self.root = pathlib.Path(workspace.name).resolve()
        self.home = self.root / 'home'
        self.src = self.home / 'src'
        self.stubs = self.root / 'stubs'
        self.src.mkdir(parents=True)
        self.stubs.mkdir()
        self.env = {
            'HOME': str(self.home),
            'PATH': f'{self.stubs}:/usr/bin:/bin',
            'GIT_CONFIG_NOSYSTEM': '1',
            'GIT_AUTHOR_NAME': 'Test',
            'GIT_AUTHOR_EMAIL': 'test@example.com',
            'GIT_COMMITTER_NAME': 'Test',
            'GIT_COMMITTER_EMAIL': 'test@example.com',
        }

    def git(self, cwd, *args):
        result = subprocess.run(['git', '-C', str(cwd), *args], env=self.env,
                                check=True, capture_output=True, text=True)
        return result.stdout

    def repo(self):
        upstream = self.root / 'upstream'
        self.git(self.root, 'init', '-q', '-b', 'main', str(upstream))
        self.git(upstream, 'commit', '-q', '--allow-empty', '-m', 'init')
        self.git(upstream, 'config', 'receive.denyCurrentBranch', 'updateInstead')
        repo = self.src / 'app'
        self.git(self.root, 'clone', '-q', str(upstream), str(repo))
        return repo

    def worktree(self, repo, path, branch):
        self.git(repo, 'worktree', 'add', '-q', '-b', branch, str(path))
        return path

    def stub(self, name, body):
        path = self.stubs / name
        path.write_text(f'#!/bin/sh\n{body}\n')
        path.chmod(0o755)

    def cache(self, relative):
        path = self.home / relative
        path.mkdir(parents=True)
        (path / 'entry').write_text('cached')
        return path

    def cleanup(self, *args, answer=''):
        return subprocess.run(['bash', str(SCRIPT), *args], env=self.env, input=answer,
                              capture_output=True, text=True)

    def test_removes_clean_merged_worktrees_after_confirmation(self):
        repo = self.repo()
        merged = self.worktree(repo, self.src / 'app-merged', 'merged')
        (merged / 'node_modules').mkdir()
        (merged / '.gitignore').write_text('node_modules\n')
        self.git(merged, 'add', '.gitignore')
        self.git(merged, 'commit', '-q', '-m', 'ignore deps')
        self.git(repo, 'push', '-q', 'origin', 'merged:main')
        self.git(repo, 'fetch', '-q', 'origin')

        result = self.cleanup(answer='y\n')

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(merged.exists())
        self.assertNotIn(str(merged), self.git(repo, 'worktree', 'list'))

    def test_keeps_worktrees_with_local_work_or_owned_by_other_tools(self):
        repo = self.repo()
        untracked = self.worktree(repo, self.src / 'app-untracked', 'untracked')
        (untracked / 'notes.md').write_text('draft')
        unmerged = self.worktree(repo, self.src / 'app-unmerged', 'unmerged')
        self.git(unmerged, 'commit', '-q', '--allow-empty', '-m', 'wip')
        cogitator = self.worktree(repo, self.src / 'workspaces/ws/session/app', 'session')
        prq = self.worktree(repo, self.home / '.local/state/prq/reviews/pr/run/repo', 'review')

        result = self.cleanup(answer='y\n')

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('no stale worktrees', result.stdout)
        for path in (untracked, unmerged, cogitator, prq):
            self.assertTrue(path.exists(), path)

    def test_keeps_stale_worktrees_when_confirmation_is_declined(self):
        repo = self.repo()
        stale = self.worktree(repo, self.src / 'app-stale', 'stale')

        result = self.cleanup(answer='n\n')

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(stale.exists())

    def test_dry_run_reports_planned_cleanup_without_changing_anything(self):
        repo = self.repo()
        stale = self.worktree(repo, self.src / 'app-stale', 'stale')
        jdtls = self.cache('.cache/nvim/jdtls')

        result = self.cleanup('--dry-run')

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(str(stale), result.stdout)
        self.assertIn(f'would run: rm -rf {jdtls}', result.stdout)
        self.assertTrue(stale.exists())
        self.assertTrue(jdtls.exists())

    def test_clears_cache_directories_using_sudo_for_dotslash(self):
        self.stub('sudo', 'echo "$@" >> "$HOME/sudo.log"; exec "$@"')
        dotslash = self.cache('Library/Caches/dotslash')
        caches = [self.cache(path) for path in ('.npm/_npx', '.yarn/berry/cache',
                                                'Library/Caches/pnpm', '.cache/nvim/jdtls')]

        result = self.cleanup()

        self.assertEqual(result.returncode, 0, result.stderr)
        for path in [dotslash, *caches]:
            self.assertFalse(path.exists(), path)
        self.assertEqual((self.home / 'sudo.log').read_text(), f'rm -rf {dotslash}\n')

    def test_continues_after_a_failing_cleaner_and_exits_non_zero(self):
        self.stub('npm', 'exit 1')
        self.stub('brew', 'touch "$HOME/brew-ran"')

        result = self.cleanup()

        self.assertNotEqual(result.returncode, 0)
        self.assertIn('failed: npm cache clean --force', result.stderr)
        self.assertTrue((self.home / 'brew-ran').exists())

    def test_prunes_registrations_of_deleted_worktrees(self):
        repo = self.repo()
        deleted = self.worktree(repo, self.src / 'app-deleted', 'deleted')
        subprocess.run(['rm', '-rf', str(deleted)], check=True)

        result = self.cleanup()

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn(str(deleted), self.git(repo, 'worktree', 'list'))

    def test_removes_day_old_packs_from_interrupted_fetches_only(self):
        repo = self.repo()
        packs = repo / '.git/objects/pack'
        abandoned = packs / 'tmp_pack_abandoned'
        in_progress = packs / 'tmp_pack_in_progress'
        abandoned.write_text('partial')
        in_progress.write_text('partial')
        two_days_ago = time.time() - TWO_DAYS
        os.utime(abandoned, (two_days_ago, two_days_ago))

        result = self.cleanup()

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(abandoned.exists())
        self.assertTrue(in_progress.exists())


if __name__ == '__main__':
    unittest.main()
