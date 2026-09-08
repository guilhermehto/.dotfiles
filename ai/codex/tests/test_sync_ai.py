import pathlib
import subprocess
import tempfile
import unittest


class SyncSkillsTest(unittest.TestCase):
    def setUp(self):
        self.workspace = tempfile.TemporaryDirectory()
        self.addCleanup(self.workspace.cleanup)
        self.root = pathlib.Path(self.workspace.name).resolve()
        self.repo = self.root / 'dotfiles'
        self.skills = self.repo / 'agents/.agents/skills'
        self.installed = self.root / 'user/.agents/skills'
        self.skills.mkdir(parents=True)
        self.installed.mkdir(parents=True)
        source = pathlib.Path(__file__).resolve().parents[1] / 'bin/codex-sync-ai'
        self.script = self.repo / 'ai/codex/bin/codex-sync-ai'
        self.script.parent.mkdir(parents=True)
        self.script.write_text(source.read_text().replace('$HOME/', f'{self.root}/user/'))

    def skill(self, name):
        target = self.skills / name
        target.mkdir()
        (target / 'SKILL.md').write_text(f'---\nname: {name}\ndescription: Test fixture\n---\n')
        return target

    def sync(self):
        subprocess.run(['bash', str(self.script)], check=True, capture_output=True, text=True)

    def test_discovers_central_skills_and_preserves_links_on_repeat(self):
        target = self.skill('commit')
        self.sync()
        link = self.installed / 'commit'
        self.assertTrue(link.is_symlink())
        self.assertEqual(link.resolve(), target)
        before = link.lstat().st_mtime_ns
        self.sync()
        self.assertEqual(link.lstat().st_mtime_ns, before)

    def test_migrates_dangling_links_from_both_old_roots(self):
        for name, old_root in [('commit', 'ai/codex/skills'), ('shared', 'ai/skills')]:
            self.skill(name)
            (self.installed / name).symlink_to(self.repo / old_root / name)
        self.sync()
        for name in ('commit', 'shared'):
            self.assertEqual((self.installed / name).resolve(), self.skills / name)

    def test_preserves_foreign_links_and_real_directories(self):
        external = self.root / 'external'
        external.mkdir()
        self.skill('foreign')
        self.skill('local')
        (self.installed / 'foreign').symlink_to(external)
        local = self.installed / 'local'
        local.mkdir()
        (local / 'keep').write_text('user content')
        self.sync()
        self.assertEqual((self.installed / 'foreign').resolve(), external)
        self.assertFalse(local.is_symlink())
        self.assertEqual((local / 'keep').read_text(), 'user content')

    def test_prunes_stale_owned_links_including_dangling_relative_links(self):
        for name, target in [('old', self.repo / 'ai/codex/skills/old'),
                             ('removed', '../../../dotfiles/agents/.agents/skills/removed')]:
            (self.installed / name).symlink_to(target)
        foreign = self.installed / 'foreign'
        foreign.symlink_to(self.root / 'missing-external')
        self.sync()
        self.assertFalse((self.installed / 'old').is_symlink())
        self.assertFalse((self.installed / 'removed').is_symlink())
        self.assertTrue(foreign.is_symlink())


if __name__ == '__main__':
    unittest.main()
