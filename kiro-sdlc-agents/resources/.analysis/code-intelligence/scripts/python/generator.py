"""Analysis file generator — produces markdown output files."""

import os
from datetime import datetime, timezone
from typing import List

from utils import atomic_write, infer_responsibility


def generate_project_structure(modules_data: List[dict], project_info: dict, output_dir: str):
    """Generate project-structure.md."""
    timestamp = datetime.now(timezone.utc).isoformat()
    lines = [
        f"# Project Structure — {project_info['projectName']}",
        "", f"**Last Updated:** {timestamp}",
        f"**Project Type:** {project_info['projectType']}", "",
        "## Modules", "",
        "| Module | Purpose | Language | Framework | Dependencies | Source Files |",
        "|--------|---------|----------|-----------|-------------|-------------|",
    ]
    for mod in modules_data:
        fw = mod.get("framework") or "—"
        deps = ", ".join(mod.get("dependencies", [])[:5]) or "—"
        lines.append(f"| {mod['name']} | {mod.get('purpose', '—')} | "
                     f"{mod['language']} | {fw} | {deps} | {mod['sourceFileCount']} |")

    lines += ["", "## Inter-Module Dependencies", "",
              "| Module | Depends On |", "|--------|-----------|"]
    for mod in modules_data:
        deps = ", ".join(mod.get("dependencies", [])) or "—"
        lines.append(f"| {mod['name']} | {deps} |")
    lines.append("")

    atomic_write(os.path.join(output_dir, "project-structure.md"), "\n".join(lines))


def generate_module_analysis(module_data: dict, output_dir: str):
    """Generate modules/{name}.md."""
    modules_dir = os.path.join(output_dir, "modules")
    os.makedirs(modules_dir, exist_ok=True)
    timestamp = datetime.now(timezone.utc).isoformat()
    fw = module_data.get("framework") or "—"

    lines = [
        f"# Module Analysis — {module_data['name']}",
        "", f"**Last Updated:** {timestamp}",
        f"**Language:** {module_data['language']} | **Framework:** {fw}", "",
        "## Key Classes", "",
        "| Class | Visibility | Responsibility |",
        "|-------|------------|---------------|",
    ]
    for cls in module_data.get("classes", [])[:30]:
        resp = infer_responsibility(cls["name"])
        lines.append(f"| {cls['name']} | {cls['visibility']} | {resp} |")

    lines += ["", "## Public API Surface", ""]
    pub_fns = [f for f in module_data.get("functions", [])
               if f["visibility"] in ("public", "exported")]
    if pub_fns:
        for fn in pub_fns[:20]:
            params = ", ".join(f"{p['name']}: {p['type']}" for p in fn.get("parameters", []))
            lines.append(f"- `{fn['name']}({params}): {fn['returnType']}`")
    else:
        lines.append("_No public functions detected._")

    lines += ["", "## Dependencies", ""]
    deps = module_data.get("dependencies", [])
    lines.append(", ".join(deps) if deps else "None detected.")

    lines += ["", "## Detected Patterns", ""]
    patterns = module_data.get("patterns", {})
    for key in ("diStyle", "errorHandling", "naming", "logging", "testing"):
        lines.append(f"- **{key}**: {patterns.get(key, 'unknown')}")
    lines.append("")

    atomic_write(os.path.join(modules_dir, f"{module_data['name']}.md"), "\n".join(lines))
