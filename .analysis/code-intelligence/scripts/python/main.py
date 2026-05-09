#!/usr/bin/env python3
"""
Code Intelligence System — Full Indexer (Python Edition)

Zero external dependencies — uses only Python 3.7+ standard library.
Orchestrates: detect → discover → scan → parse → analyze → output.

Usage:
    python main.py [project_root_path]
"""

import json
import os
import sys
import time
from datetime import datetime, timezone

from config import load_config
from detector import detect_project_type
from discovery import discover_modules
from generator import generate_module_analysis, generate_project_structure
from parser import parse_file
from patterns import detect_patterns, infer_module_purpose
from scanner import scan_files
from utils import atomic_write, infer_package_purpose


def run_full_index(root_dir: str) -> dict:
    """Run a full index of the workspace."""
    start = time.time()
    root = os.path.abspath(root_dir)
    output_dir = os.path.join(root, ".analysis", "code-intelligence")

    config = load_config(os.path.join(output_dir, "index-config.json"))
    detection = detect_project_type(root)
    modules = discover_modules(root, detection)
    modules_data = _process_modules(modules, config, root, detection)

    _write_metadata(root, output_dir, detection, modules_data)
    _write_analysis(output_dir, detection, modules_data, root)
    _write_kb_payloads(output_dir, modules_data, root)
    _cleanup_stale_modules(output_dir, modules_data)

    elapsed = int((time.time() - start) * 1000)
    total_files = sum(m["sourceFileCount"] for m in modules_data)
    total_classes = sum(len(m["classes"]) for m in modules_data)
    total_functions = sum(len(m["functions"]) for m in modules_data)

    print(f"\n[Code-Index] INFO: Full index complete — {total_files} files, "
          f"{len(modules_data)} modules, {total_classes} classes, "
          f"{total_functions} functions, {elapsed}ms")

    return {"totalFiles": total_files, "totalModules": len(modules_data),
            "totalClasses": total_classes, "totalFunctions": total_functions,
            "parseErrors": 0, "elapsedMs": elapsed}


def _process_modules(modules, config, root, detection):
    """Scan and parse all files for each module."""
    modules_data = []
    total = 0
    for mod in modules:
        scanned = scan_files(config, mod["sourceDirectories"], root)
        classes, functions, imports, pkg_set, dep_set = [], [], [], set(), set()

        for file_info in scanned:
            total += 1
            print(f"\r[Code-Index] INFO: Indexing — {total} files ({mod['name']})", end="")
            result = parse_file(os.path.join(root, file_info["filePath"]), file_info["language"], mod["name"])
            classes.extend(result.get("classes", []))
            functions.extend(result.get("functions", []))
            imports.extend(result.get("imports", []))
            if result.get("packageName"):
                pkg_set.add(result["packageName"])
            for imp in result.get("imports", []):
                for other in modules:
                    if other["name"] != mod["name"] and other["name"] in imp:
                        dep_set.add(other["name"])

        patterns = detect_patterns(classes, functions, imports)
        purpose = infer_module_purpose(mod["name"], classes, list(pkg_set))
        modules_data.append({
            "name": mod["name"], "path": mod["path"],
            "language": mod.get("language") or detection["primaryLanguage"],
            "framework": detection["framework"], "dependencies": list(dep_set),
            "sourceFileCount": len(scanned), "packages": list(pkg_set),
            "classes": classes, "functions": functions,
            "patterns": patterns, "purpose": purpose
        })
    return modules_data


def _write_metadata(root, output_dir, detection, modules_data):
    """Write index-metadata.json."""
    total_files = sum(m["sourceFileCount"] for m in modules_data)
    metadata = {
        "version": "1.0",
        "lastFullIndexTimestamp": datetime.now(timezone.utc).isoformat(),
        "projectName": os.path.basename(root),
        "projectType": detection["projectType"],
        "totalFiles": total_files
    }
    atomic_write(os.path.join(output_dir, "index-metadata.json"), json.dumps(metadata, indent=2))


def _write_analysis(output_dir, detection, modules_data, root):
    """Generate project-structure.md and per-module analysis files."""
    project_info = {
        "projectName": os.path.basename(root),
        "projectType": detection["projectType"],
        "primaryLanguage": detection["primaryLanguage"],
        "framework": detection["framework"]
    }
    generate_project_structure(modules_data, project_info, output_dir)
    for mod_data in modules_data:
        generate_module_analysis(mod_data, output_dir)


def _write_kb_payloads(output_dir, modules_data, root):
    """Generate kb-payloads.json for Knowledge Base ingestion."""
    payloads = []
    for mod in modules_data:
        content = (f"Module: {mod['name']}\nLanguage: {mod['language']}\n"
                   f"Purpose: {mod['purpose']}\nFiles: {mod['sourceFileCount']}\n"
                   f"Classes: {len(mod['classes'])}\nFunctions: {len(mod['functions'])}")
        payloads.append({"title": f"Code Index — {mod['name']}", "content": content,
                         "tags": f"code-index, {mod['name']}, {mod['language']}",
                         "project": os.path.basename(root)})
    atomic_write(os.path.join(output_dir, "kb-payloads.json"), json.dumps(payloads, indent=2))


def _cleanup_stale_modules(output_dir, modules_data):
    """Remove module analysis files that no longer exist."""
    modules_dir = os.path.join(output_dir, "modules")
    if not os.path.isdir(modules_dir):
        return
    discovered = {m["name"] for m in modules_data}
    for f in os.listdir(modules_dir):
        if f.endswith(".md") and f[:-3] not in discovered:
            os.remove(os.path.join(modules_dir, f))
            print(f"[Code-Index] INFO: Removed stale module — {f[:-3]}")


if __name__ == "__main__":
    root_path = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
    result = run_full_index(root_path)
    print(json.dumps(result, indent=2))
