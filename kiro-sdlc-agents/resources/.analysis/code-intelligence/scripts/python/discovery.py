"""Module discovery — finds subprojects based on build system."""

import json
import os
import re
from typing import List


def discover_modules(root_dir: str, detection: dict) -> List[dict]:
    """Discover modules/subprojects based on build system."""
    project_type = detection["projectType"]
    build_file = detection["buildFile"]

    discoverers = {
        "gradle-kotlin": _discover_gradle, "gradle-java": _discover_gradle,
        "maven-java": _discover_maven, "npm-typescript": _discover_npm,
        "npm-javascript": _discover_npm, "cargo-rust": _discover_cargo,
        "go-module": _discover_go, "python": _discover_python,
    }
    discoverer = discoverers.get(project_type)
    modules = discoverer(root_dir) if discoverer else []

    if not modules:
        modules = [_create_root_module(root_dir, project_type, build_file)]

    print(f"[Code-Index] INFO: Module discovery — found {len(modules)} module(s)")
    return modules


def _create_root_module(root_dir: str, project_type: str, build_file: str) -> dict:
    """Create a single root module as fallback."""
    src_dirs = _detect_src_dirs(root_dir, ".", project_type)
    return {"name": "root", "path": ".", "sourceDirectories": src_dirs,
            "buildFile": build_file if build_file != "none" else None, "language": None}


def _detect_src_dirs(root_dir: str, mod_path: str, project_type: str) -> List[str]:
    """Detect source directories for a module."""
    if project_type in ("gradle-kotlin", "gradle-java", "maven-java"):
        return _gradle_maven_src(root_dir, mod_path)
    if project_type in ("npm-typescript", "npm-javascript"):
        return _npm_src(root_dir, mod_path)
    for candidate in ["src", "lib", "."]:
        full = os.path.join(root_dir, mod_path, candidate) if mod_path != "." else os.path.join(root_dir, candidate)
        if os.path.isdir(full):
            return [f"{mod_path}/{candidate}" if mod_path != "." else candidate]
    return [mod_path]


def _gradle_maven_src(root_dir: str, mod_path: str) -> List[str]:
    """Detect Gradle/Maven source directories."""
    candidates = [f"{mod_path}/src/main/kotlin", f"{mod_path}/src/main/java",
                  f"{mod_path}/src/main/resources", f"{mod_path}/src/test/kotlin",
                  f"{mod_path}/src/test/java"]
    found = [c for c in candidates if os.path.isdir(os.path.join(root_dir, c))]
    return found if found else [mod_path]


def _npm_src(root_dir: str, mod_path: str) -> List[str]:
    """Detect npm source directories."""
    candidates = [f"{mod_path}/src", f"{mod_path}/lib", f"{mod_path}/app"]
    found = [c for c in candidates if os.path.isdir(os.path.join(root_dir, c))]
    return found if found else [mod_path]


def _discover_gradle(root_dir: str) -> List[dict]:
    """Discover Gradle subprojects from settings file."""
    modules = []
    for sf in ("settings.gradle.kts", "settings.gradle"):
        path = os.path.join(root_dir, sf)
        if not os.path.isfile(path):
            continue
        content = open(path, "r", encoding="utf-8", errors="ignore").read()
        seen = set()
        for match in re.finditer(r'["\']([^"\']+)["\']', content):
            name = match.group(1).lstrip(":").replace(":", "/")
            if name in seen or not os.path.isdir(os.path.join(root_dir, name)):
                continue
            seen.add(name)
            src_dirs = _gradle_maven_src(root_dir, name)
            modules.append({"name": name.replace("/", "-"), "path": name,
                            "sourceDirectories": src_dirs, "buildFile": None, "language": None})
        break
    return modules


def _discover_maven(root_dir: str) -> List[dict]:
    """Discover Maven child modules from pom.xml."""
    modules = []
    pom = os.path.join(root_dir, "pom.xml")
    if not os.path.isfile(pom):
        return modules
    content = open(pom, "r", encoding="utf-8", errors="ignore").read()
    for match in re.finditer(r"<module>\s*([^<]+?)\s*</module>", content):
        name = match.group(1).strip()
        if os.path.isdir(os.path.join(root_dir, name)):
            src_dirs = _gradle_maven_src(root_dir, name)
            modules.append({"name": name, "path": name, "sourceDirectories": src_dirs,
                            "buildFile": f"{name}/pom.xml", "language": None})
    return modules


def _discover_npm(root_dir: str) -> List[dict]:
    """Discover npm workspace packages."""
    modules = []
    pkg_path = os.path.join(root_dir, "package.json")
    if not os.path.isfile(pkg_path):
        return modules
    try:
        pkg = json.load(open(pkg_path, "r", encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return modules
    workspaces = pkg.get("workspaces", [])
    if isinstance(workspaces, dict):
        workspaces = workspaces.get("packages", [])
    for pattern in workspaces:
        if "*" in pattern:
            parent = pattern.rstrip("/*").rstrip("/**")
            parent_dir = os.path.join(root_dir, parent)
            if os.path.isdir(parent_dir):
                for entry in os.scandir(parent_dir):
                    if entry.is_dir() and os.path.isfile(os.path.join(entry.path, "package.json")):
                        mod_path = f"{parent}/{entry.name}"
                        modules.append({"name": entry.name, "path": mod_path,
                                        "sourceDirectories": _npm_src(root_dir, mod_path),
                                        "buildFile": f"{mod_path}/package.json", "language": None})
        elif os.path.isdir(os.path.join(root_dir, pattern)):
            modules.append({"name": os.path.basename(pattern), "path": pattern,
                            "sourceDirectories": _npm_src(root_dir, pattern),
                            "buildFile": f"{pattern}/package.json", "language": None})
    return modules


def _discover_cargo(root_dir: str) -> List[dict]:
    """Discover Cargo workspace members."""
    cargo = os.path.join(root_dir, "Cargo.toml")
    if not os.path.isfile(cargo):
        return []
    content = open(cargo, "r", encoding="utf-8", errors="ignore").read()
    if "[workspace]" not in content:
        return []
    match = re.search(r'members\s*=\s*\[([^\]]*)\]', content, re.DOTALL)
    if not match:
        return []
    modules = []
    for m in re.finditer(r'"([^"]+)"', match.group(1)):
        name = m.group(1)
        mod_dir = os.path.join(root_dir, name)
        if os.path.isdir(mod_dir):
            src = f"{name}/src" if os.path.isdir(os.path.join(mod_dir, "src")) else name
            modules.append({"name": os.path.basename(name), "path": name,
                            "sourceDirectories": [src], "buildFile": f"{name}/Cargo.toml", "language": "rust"})
    return modules


def _discover_go(root_dir: str) -> List[dict]:
    """Discover Go module."""
    go_mod = os.path.join(root_dir, "go.mod")
    if not os.path.isfile(go_mod):
        return []
    content = open(go_mod, "r", encoding="utf-8", errors="ignore").read()
    match = re.search(r'^module\s+(\S+)', content, re.MULTILINE)
    name = os.path.basename(match.group(1)) if match else "root"
    return [{"name": name, "path": ".", "sourceDirectories": ["."],
             "buildFile": "go.mod", "language": "go"}]


def _discover_python(root_dir: str) -> List[dict]:
    """Discover Python monorepo packages."""
    modules = []
    for indicator in ("packages", "libs"):
        ind_dir = os.path.join(root_dir, indicator)
        if not os.path.isdir(ind_dir):
            continue
        for entry in os.scandir(ind_dir):
            if entry.is_dir():
                has_build = (os.path.isfile(os.path.join(entry.path, "pyproject.toml")) or
                             os.path.isfile(os.path.join(entry.path, "setup.py")))
                if has_build:
                    sub = f"{indicator}/{entry.name}"
                    src = f"{sub}/src" if os.path.isdir(os.path.join(root_dir, sub, "src")) else sub
                    modules.append({"name": entry.name, "path": sub,
                                    "sourceDirectories": [src], "buildFile": None, "language": "python"})
    return modules
