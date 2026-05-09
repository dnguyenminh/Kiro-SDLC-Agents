"""Project type detection — identifies build system, language, and framework."""

import os
from typing import Dict, Optional, Tuple

from config import SOURCE_EXTENSIONS

BUILD_FILE_PRIORITY = [
    ("build.gradle.kts", "gradle-kotlin"), ("build.gradle", "gradle-java"),
    ("pom.xml", "maven-java"), ("package.json", "npm"),
    ("Cargo.toml", "cargo-rust"), ("go.mod", "go-module"),
    ("pyproject.toml", "python"), ("setup.py", "python"),
]

PROJECT_TYPE_LANGUAGE = {
    "gradle-kotlin": "kotlin", "gradle-java": "java", "maven-java": "java",
    "npm-typescript": "typescript", "npm-javascript": "javascript",
    "cargo-rust": "rust", "go-module": "go", "python": "python",
    "dotnet": "csharp", "generic": "unknown"
}

FRAMEWORK_PATTERNS = {
    "gradle-kotlin": [("spring-boot-starter", "Spring Boot"), ("io.ktor", "Ktor"), ("ktor-", "Ktor")],
    "gradle-java": [("spring-boot-starter", "Spring Boot"), ("io.ktor", "Ktor")],
    "maven-java": [("spring-boot-starter", "Spring Boot"), ("io.quarkus", "Quarkus")],
    "npm-typescript": [('"react"', "React"), ('"next"', "Next.js"), ('"@angular/core"', "Angular"),
                       ('"vue"', "Vue.js"), ('"express"', "Express.js"), ('"@nestjs/core"', "NestJS")],
    "npm-javascript": [('"react"', "React"), ('"express"', "Express.js")],
    "python": [("django", "Django"), ("flask", "Flask"), ("fastapi", "FastAPI")],
    "cargo-rust": [("actix-web", "Actix Web"), ("axum", "Axum"), ("rocket", "Rocket")],
    "go-module": [("github.com/gin-gonic/gin", "Gin"), ("github.com/gofiber/fiber", "Fiber")],
}


def detect_project_type(root_dir: str) -> dict:
    """Detect project type, primary language, and framework."""
    project_type, build_file = _find_build_file(root_dir)
    project_type = _refine_npm(root_dir, project_type)
    primary_language = _determine_language(root_dir, project_type)
    framework = _detect_framework(root_dir, build_file, project_type)

    print(f"[Code-Index] INFO: Project detected — type={project_type}, "
          f"language={primary_language}, framework={framework}, buildFile={build_file}")
    return {"projectType": project_type, "primaryLanguage": primary_language,
            "framework": framework, "buildFile": build_file}


def _find_build_file(root_dir: str) -> Tuple[str, str]:
    """Find the primary build file in priority order."""
    for filename, ptype in BUILD_FILE_PRIORITY:
        if os.path.isfile(os.path.join(root_dir, filename)):
            return ptype, filename
    # Check .sln / .csproj
    for f in os.listdir(root_dir):
        if f.endswith(".sln") or f.endswith(".csproj"):
            return "dotnet", f
    return "generic", "none"


def _refine_npm(root_dir: str, project_type: str) -> str:
    """Refine npm to npm-typescript or npm-javascript."""
    if project_type != "npm":
        return project_type
    tsconfig = os.path.join(root_dir, "tsconfig.json")
    return "npm-typescript" if os.path.isfile(tsconfig) else "npm-javascript"


def _determine_language(root_dir: str, project_type: str) -> str:
    """Determine primary language from file counts and project type."""
    lang_counts = _count_source_files(root_dir, max_depth=3)
    implied = PROJECT_TYPE_LANGUAGE.get(project_type, "unknown")
    if implied != "unknown" and lang_counts.get(implied, 0) > 0:
        return implied
    if lang_counts:
        return max(lang_counts, key=lang_counts.get)
    return implied


def _detect_framework(root_dir: str, build_file: str, project_type: str) -> Optional[str]:
    """Detect framework from build file content."""
    if build_file == "none":
        return None
    build_path = os.path.join(root_dir, build_file)
    try:
        content = open(build_path, "r", encoding="utf-8", errors="ignore").read()
    except OSError:
        return None
    for pattern, fw in FRAMEWORK_PATTERNS.get(project_type, []):
        if pattern in content:
            return fw
    return None


def _count_source_files(directory: str, max_depth: int, depth: int = 0) -> Dict[str, int]:
    """Recursively count source files by language."""
    counts: Dict[str, int] = {}
    if depth > max_depth:
        return counts
    skip = {"node_modules", ".git", "build", "dist", "out", "target", ".gradle", "vendor"}
    try:
        entries = os.scandir(directory)
    except OSError:
        return counts
    for entry in entries:
        if entry.is_dir(follow_symlinks=False):
            if entry.name in skip:
                continue
            for lang, count in _count_source_files(entry.path, max_depth, depth + 1).items():
                counts[lang] = counts.get(lang, 0) + count
        elif entry.is_file():
            ext = os.path.splitext(entry.name)[1].lower()
            lang = SOURCE_EXTENSIONS.get(ext)
            if lang:
                counts[lang] = counts.get(lang, 0) + 1
    return counts
