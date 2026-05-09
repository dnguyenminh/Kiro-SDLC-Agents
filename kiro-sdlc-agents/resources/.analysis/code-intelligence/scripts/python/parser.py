"""Source file parser — extracts classes, functions, imports from code files."""

import re
from typing import List

from utils import derive_package


def parse_file(file_path: str, language: str, module_name: str = "root") -> dict:
    """Parse a source file and extract structured information."""
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
    except OSError as e:
        return _error_result(file_path, language, module_name, "read_error", str(e))

    parsers = {
        "kotlin": _parse_kotlin, "java": _parse_java, "python": _parse_python,
        "go": _parse_go, "rust": _parse_rust, "csharp": _parse_csharp,
        "typescript": _parse_typescript, "javascript": _parse_typescript,
    }
    parser = parsers.get(language, _parse_fallback)
    try:
        return parser(file_path, content, module_name)
    except Exception as e:
        return _error_result(file_path, language, module_name, "parse_error", str(e))


def _error_result(fp, lang, mod, status, msg):
    """Create an error parse result."""
    return {"filePath": fp, "language": lang, "moduleName": mod, "packageName": "",
            "classes": [], "functions": [], "imports": [],
            "indexingStatus": status, "errorMessage": msg}


def _success_result(fp, lang, mod, pkg, classes, functions, imports):
    """Create a successful parse result."""
    return {"filePath": fp, "language": lang, "moduleName": mod, "packageName": pkg,
            "classes": classes, "functions": functions, "imports": imports,
            "indexingStatus": "success", "errorMessage": None}


def _cls(name, visibility="public"):
    """Create a class info dict."""
    return {"name": name, "visibility": visibility, "superclass": None, "interfaces": [], "annotations": []}


def _fn(name, visibility="public", params=None, ret="void"):
    """Create a function info dict."""
    return {"name": name, "visibility": visibility, "parameters": params or [], "returnType": ret, "annotations": []}


def _param(name, type_name="Any"):
    """Create a parameter dict."""
    return {"name": name, "type": type_name}


# --- Language-specific parsers (each under 20 lines) ---

def _parse_kotlin(fp, content, mod):
    """Parse Kotlin source file."""
    pkg, imports, classes, functions = "", [], [], []
    for line in content.split("\n"):
        t = line.strip()
        m = re.match(r'^package\s+([\w.]+)', t)
        if m: pkg = m.group(1); continue
        m = re.match(r'^import\s+([\w.*]+)', t)
        if m: imports.append(m.group(1)); continue
        m = re.search(r'(class|object|interface|enum class)\s+(\w+)', t)
        if m: classes.append(_cls(m.group(2))); continue
        m = re.search(r'fun\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*(\w+))?', t)
        if m: functions.append(_fn(m.group(1), "public", _params_colon(m.group(2)), m.group(3) or "Unit"))
    return _success_result(fp, "kotlin", mod, pkg, classes, functions, imports)


def _parse_java(fp, content, mod):
    """Parse Java source file."""
    pkg, imports, classes, functions = "", [], [], []
    for line in content.split("\n"):
        t = line.strip()
        m = re.match(r'^package\s+([\w.]+);', t)
        if m: pkg = m.group(1); continue
        m = re.match(r'^import\s+([\w.*]+);', t)
        if m: imports.append(m.group(1)); continue
        m = re.search(r'(class|interface|enum)\s+(\w+)', t)
        if m: classes.append(_cls(m.group(2))); continue
        m = re.search(r'(public|private|protected)?\s*([\w<>\[\]]+)\s+(\w+)\s*\(', t)
        if m and m.group(2) not in ("class", "interface", "enum"):
            functions.append(_fn(m.group(3), m.group(1) or "package-private", [], m.group(2)))
    return _success_result(fp, "java", mod, pkg, classes, functions, imports)


def _parse_python(fp, content, mod):
    """Parse Python source file."""
    imports, classes, functions = [], [], []
    for line in content.split("\n"):
        t = line.strip()
        m = re.match(r'^(?:import|from)\s+(\S+)', t)
        if m: imports.append(m.group(1)); continue
        m = re.match(r'^class\s+(\w+)', t)
        if m: classes.append(_cls(m.group(1))); continue
        m = re.match(r'^def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(\S+))?:', t)
        if m:
            vis = "private" if m.group(1).startswith("_") else "public"
            functions.append(_fn(m.group(1), vis, _params_python(m.group(2)), m.group(3) or "None"))
    return _success_result(fp, "python", mod, derive_package(fp), classes, functions, imports)


def _parse_go(fp, content, mod):
    """Parse Go source file."""
    pkg_match = re.search(r'^package\s+(\w+)', content, re.MULTILINE)
    pkg = pkg_match.group(1) if pkg_match else ""
    imports = re.findall(r'"([\w./]+)"', content)
    classes = [_cls(m.group(1), "exported" if m.group(1)[0].isupper() else "unexported")
               for m in re.finditer(r'type\s+(\w+)\s+struct', content)]
    functions = [_fn(m.group(1), "exported" if m.group(1)[0].isupper() else "unexported")
                 for m in re.finditer(r'func\s+(\w+)\s*\(', content)]
    return _success_result(fp, "go", mod, pkg, classes, functions, imports)


def _parse_rust(fp, content, mod):
    """Parse Rust source file."""
    imports = [m.group(1) for m in re.finditer(r'^use\s+([\w:*]+);', content, re.MULTILINE)]
    classes = [_cls(m.group(2), "pub" if m.group(1) else "private")
               for m in re.finditer(r'(pub\s+)?(?:struct|enum)\s+(\w+)', content)]
    functions = [_fn(m.group(2), "pub" if m.group(1) else "private")
                 for m in re.finditer(r'(pub\s+)?fn\s+(\w+)', content)]
    return _success_result(fp, "rust", mod, derive_package(fp), classes, functions, imports)


def _parse_csharp(fp, content, mod):
    """Parse C# source file."""
    imports = [m.group(1) for m in re.finditer(r'^using\s+([\w.]+);', content, re.MULTILINE)]
    ns_match = re.search(r'namespace\s+([\w.]+)', content)
    pkg = ns_match.group(1) if ns_match else ""
    classes = [_cls(m.group(1)) for m in re.finditer(r'(?:class|interface)\s+(\w+)', content)]
    functions = [_fn(m.group(2), m.group(1) or "private", [], m.group(2))
                 for m in re.finditer(r'(public|private|protected)?\s*\w+\s+(\w+)\s*\(', content)
                 if m.group(2) not in ("class", "interface", "enum", "namespace", "if", "for", "while")]
    return _success_result(fp, "csharp", mod, pkg, classes, functions, imports)


def _parse_typescript(fp, content, mod):
    """Parse TypeScript/JavaScript source file."""
    imports = [m.group(1) for m in re.finditer(r"(?:from|require\()\s*['\"]([^'\"]+)['\"]", content)]
    classes = [_cls(m.group(2), "exported" if m.group(1) else "private")
               for m in re.finditer(r'(export\s+)?class\s+(\w+)', content)]
    functions = [_fn(m.group(2), "exported" if m.group(1) else "private")
                 for m in re.finditer(r'(export\s+)?(?:async\s+)?function\s+(\w+)', content)]
    return _success_result(fp, "typescript", mod, derive_package(fp), classes, functions, imports)


def _parse_fallback(fp, content, mod):
    """Fallback parser for unsupported languages."""
    imports = [m.group(1).strip("'\";") for m in re.finditer(r'(?:import\s+|require\s*\(\s*[\'"])(\S+)', content)]
    return _success_result(fp, "unknown", mod, "", [], [], imports)


# --- Parameter parsers ---

def _params_colon(raw: str) -> List[dict]:
    """Parse 'name: Type' style parameters."""
    if not raw or not raw.strip():
        return []
    result = []
    for p in raw.split(","):
        p = p.strip()
        if not p:
            continue
        parts = p.split(":", 1)
        result.append(_param(parts[0].strip(), parts[1].strip() if len(parts) > 1 else "Any"))
    return result


def _params_python(raw: str) -> List[dict]:
    """Parse Python-style parameters, skipping self/cls."""
    if not raw or not raw.strip():
        return []
    result = []
    for p in raw.split(","):
        p = p.strip()
        if not p or p in ("self", "cls"):
            continue
        parts = p.split(":", 1)
        result.append(_param(parts[0].strip(), parts[1].strip() if len(parts) > 1 else "Any"))
    return result
