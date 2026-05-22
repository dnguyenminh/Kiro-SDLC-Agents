"""Copy shared/viewer/ into package for distribution.

Run before `python -m build` to bundle static HTML/JS/CSS into the wheel.
"""

import shutil
import sys
from pathlib import Path


def main() -> None:
    """Copy ../shared/viewer/ → src/mcp_code_intel/viewer/."""
    project_root = Path(__file__).parent
    source = project_root.parent / "shared" / "viewer"
    dest = project_root / "src" / "mcp_code_intel" / "viewer"

    if not source.exists():
        print(f"ERROR: Source not found: {source}", file=sys.stderr)
        sys.exit(1)

    # Clean previous copy
    if dest.exists():
        shutil.rmtree(dest)

    shutil.copytree(source, dest)
    print(f"Copied {source} → {dest} ({_count_files(dest)} files)")


def _count_files(directory: Path) -> int:
    """Count files recursively."""
    return sum(1 for _ in directory.rglob("*") if _.is_file())


if __name__ == "__main__":
    main()
