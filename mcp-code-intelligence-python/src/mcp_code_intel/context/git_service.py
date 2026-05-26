"""Git Service — wraps git log for file history. KSA-171."""

from __future__ import annotations

import subprocess

from .types import GitCommit


class GitService:
    """Provides git history for files in the workspace."""

    def __init__(self, workspace_root: str) -> None:
        self._workspace_root = workspace_root

    def get_file_history(self, file_path: str, limit: int = 5) -> list[GitCommit]:
        """Get recent commit history for a file."""
        try:
            output = subprocess.check_output(
                ["git", "log", "--oneline", "--follow", f"-n{limit}", "--", file_path],
                cwd=self._workspace_root,
                text=True,
                timeout=5,
                stderr=subprocess.DEVNULL,
            )
            commits: list[GitCommit] = []
            for line in output.strip().splitlines():
                if not line:
                    continue
                space_idx = line.index(" ")
                commits.append(GitCommit(
                    hash=line[:space_idx],
                    message=line[space_idx + 1:],
                ))
            return commits
        except (subprocess.SubprocessError, OSError, ValueError):
            return []

    def is_available(self) -> bool:
        """Check if git is available in the workspace."""
        try:
            subprocess.check_output(
                ["git", "rev-parse", "--is-inside-work-tree"],
                cwd=self._workspace_root,
                text=True,
                timeout=2,
                stderr=subprocess.DEVNULL,
            )
            return True
        except (subprocess.SubprocessError, OSError):
            return False
