use std::collections::{BTreeMap, BTreeSet};
use zellij_tile::prelude::*;

#[derive(Default)]
struct State {
    dim_fg: Option<String>,
    dim_bg: Option<String>,
    dimmed: BTreeSet<PaneId>,
}

register_plugin!(State);

impl ZellijPlugin for State {
    fn load(&mut self, configuration: BTreeMap<String, String>) {
        self.dim_fg = configuration.get("fg").cloned();
        self.dim_bg = configuration.get("bg").cloned();

        request_permission(&[
            PermissionType::ReadApplicationState,
            PermissionType::ChangeApplicationState,
        ]);
        subscribe(&[EventType::PaneUpdate, EventType::PermissionRequestResult]);
    }

    fn update(&mut self, event: Event) -> bool {
        match event {
            Event::PaneUpdate(manifest) => self.sync(&manifest),
            // Zellij surfaces a background plugin as a floating pane to ask for permissions.
            Event::PermissionRequestResult(_) => hide_self(),
            _ => {}
        }

        false
    }
}

impl State {
    fn sync(&mut self, manifest: &PaneManifest) {
        let changes = color_changes(manifest, &self.dimmed);

        for pane in &changes.dim {
            set_pane_color(*pane, self.dim_fg.clone(), self.dim_bg.clone());
        }
        for pane in &changes.restore {
            set_pane_color(*pane, None, None);
        }

        self.dimmed = changes.unfocused;
    }
}

#[derive(Debug, Default, PartialEq)]
struct ColorChanges {
    dim: Vec<PaneId>,
    restore: Vec<PaneId>,
    unfocused: BTreeSet<PaneId>,
}

fn color_changes(manifest: &PaneManifest, dimmed: &BTreeSet<PaneId>) -> ColorChanges {
    let mut changes = ColorChanges::default();
    let selectable_panes = manifest.panes.values().flatten().filter(|p| p.is_selectable);

    for pane in selectable_panes {
        let id = pane_id(pane);
        let is_dimmed = dimmed.contains(&id);

        if pane.is_focused {
            if is_dimmed {
                changes.restore.push(id);
            }
        } else {
            if !is_dimmed {
                changes.dim.push(id);
            }
            changes.unfocused.insert(id);
        }
    }

    changes.dim.sort();
    changes.restore.sort();
    changes
}

fn pane_id(pane: &PaneInfo) -> PaneId {
    if pane.is_plugin {
        PaneId::Plugin(pane.id)
    } else {
        PaneId::Terminal(pane.id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn terminal(id: u32, is_focused: bool) -> PaneInfo {
        PaneInfo {
            id,
            is_focused,
            is_selectable: true,
            ..Default::default()
        }
    }

    fn manifest(tabs: Vec<Vec<PaneInfo>>) -> PaneManifest {
        PaneManifest {
            panes: tabs.into_iter().enumerate().collect::<HashMap<_, _>>(),
        }
    }

    fn set(ids: &[PaneId]) -> BTreeSet<PaneId> {
        ids.iter().copied().collect()
    }

    #[test]
    fn dims_every_unfocused_pane_on_first_update() {
        let panes = manifest(vec![vec![terminal(1, true), terminal(2, false), terminal(3, false)]]);

        let changes = color_changes(&panes, &BTreeSet::new());

        assert_eq!(changes.dim, vec![PaneId::Terminal(2), PaneId::Terminal(3)]);
        assert!(changes.restore.is_empty());
    }

    #[test]
    fn swaps_colors_when_focus_moves() {
        let dimmed = set(&[PaneId::Terminal(2)]);
        let panes = manifest(vec![vec![terminal(1, false), terminal(2, true)]]);

        let changes = color_changes(&panes, &dimmed);

        assert_eq!(changes.dim, vec![PaneId::Terminal(1)]);
        assert_eq!(changes.restore, vec![PaneId::Terminal(2)]);
        assert_eq!(changes.unfocused, set(&[PaneId::Terminal(1)]));
    }

    #[test]
    fn sends_nothing_when_focus_is_unchanged() {
        let dimmed = set(&[PaneId::Terminal(2)]);
        let panes = manifest(vec![vec![terminal(1, true), terminal(2, false)]]);

        let changes = color_changes(&panes, &dimmed);

        assert!(changes.dim.is_empty());
        assert!(changes.restore.is_empty());
    }

    #[test]
    fn leaves_unselectable_panes_alone() {
        let status_bar = PaneInfo {
            id: 7,
            is_plugin: true,
            is_selectable: false,
            ..Default::default()
        };
        let panes = manifest(vec![vec![terminal(1, true), status_bar]]);

        let changes = color_changes(&panes, &BTreeSet::new());

        assert!(changes.dim.is_empty());
        assert!(changes.unfocused.is_empty());
    }

    #[test]
    fn treats_plugin_and_terminal_panes_with_the_same_id_separately() {
        let sidebar = PaneInfo {
            id: 2,
            is_plugin: true,
            is_selectable: true,
            ..Default::default()
        };
        let panes = manifest(vec![vec![terminal(2, true), sidebar]]);

        let changes = color_changes(&panes, &BTreeSet::new());

        assert_eq!(changes.dim, vec![PaneId::Plugin(2)]);
    }

    #[test]
    fn forgets_closed_panes_without_restoring_them() {
        let dimmed = set(&[PaneId::Terminal(2), PaneId::Terminal(9)]);
        let panes = manifest(vec![vec![terminal(1, true), terminal(2, false)]]);

        let changes = color_changes(&panes, &dimmed);

        assert!(changes.restore.is_empty());
        assert_eq!(changes.unfocused, set(&[PaneId::Terminal(2)]));
    }

    #[test]
    fn keeps_the_focused_pane_of_each_tab_undimmed() {
        let panes = manifest(vec![
            vec![terminal(1, true), terminal(2, false)],
            vec![terminal(3, true), terminal(4, false)],
        ]);

        let changes = color_changes(&panes, &BTreeSet::new());

        assert_eq!(changes.dim, vec![PaneId::Terminal(2), PaneId::Terminal(4)]);
    }
}
