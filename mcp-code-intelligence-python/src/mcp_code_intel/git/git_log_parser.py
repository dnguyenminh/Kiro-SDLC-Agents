"""Parse git log output into structured Commit objects."""

from __future__ import annotations

import subprocess
import sys
from dataclasses import dataclass, field


@dataclass
class Commit:
    """Parsed git commit."""
    hash: str
    author: str
    date: str  # ISO 8601
    message: str
    files_changed: list[str] = field(default_factory=list)
    insertions: int = 0
    deletions: int = 0


class GitLogParser:
    """Parse git log output into Commit objects."""

    def __init__(self, repo_path: str) -> None:
        self._repo_path = repo_path

    def parse(
        self,
        since_hash: str | None = None,
        max_commits: int = 10000,
    ) -> list[Commit]:
        """Parse git log and return list of Commits."""
        cmd = [
            "git", "log",
            "--format=%H|%an|%aI|%s",
            "--numstat",
        ]

        if since_hash:
            cmd.append(f"{since_hash}..HEAD")
        else:
            cmd.extend(["-n", str(max_commits)])

        try:
            result = subprocess.run(
                cmd,
                cwd=self._repo_path,
                capture_output=True,
                text=True,
                timeout=60,
            )
            if result.returncode != 0:
                _log(f"git log failed: {result.stderr[:200]}")
                return []
            return self._parse_output(result.stdout)
        except (subprocess.TimeoutExpired, FileNotFoundError) as e:
            _log(f"git log error: {e}")
            return []

    def _parse_output(self, output: str) -> list[Commit]:
        """Parse the combined format + numstat output."""
        commits: list[Commit] = []
        current: Commit | None = None

        for line in output.split("\n"):
            line = line.rstrip()

            if not line:
                continue

            # Check if this is a commit header line (hash|author|date|message)
            if "|" in line and len(line.split("|")) >= 4:
                parts = line.split("|", 3)
                if len(parts[0]) == 40:  # SHA-1 hash
                    if current:
                        commits.append(current)
                    current = Commit(
                        hash=parts[0],
                        author=parts[1],
                        date=parts[2],
                        message=parts[3],
                    )
                    continue

            # Numstat line: insertions\tdeletions\tfile
            if current and "\t" in line:
                parts = line.split("\t")
                if len(parts) >= 3:
                    try:
                        ins = int(parts[0]) if parts[0] != "-" else 0
                        dels = int(parts[1]) if parts[1] != "-" else 0
                        file_path = parts[2]
                        current.files_changed.append(file_path)
                        current.insertions += ins
                        current.deletions += dels
                    except ValueError:
                        pass

        if current:
            commits.append(current)

        return commits

    def get_latest_hash(self) -> str | None:
        """Get the latest commit hash."""
        try:
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=self._repo_path,
                capture_output=True,
                text=True,
                timeout=10,
            )
            if result.returncode == 0:
                return result.stdout.strip()
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass
        return None


def _log(msg: str) -> None:
    print(f"[git-parser] {msg}", file=sys.stderr, flush=True)
