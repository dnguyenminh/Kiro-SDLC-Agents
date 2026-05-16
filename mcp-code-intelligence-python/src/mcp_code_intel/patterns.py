"""Pattern detection — identifies DI style, error handling, naming, logging, testing."""

from typing import TypedDict


class DetectedPatterns(TypedDict):
    """Detected coding patterns for a module."""

    di_style: str
    error_handling: str
    naming: str
    logging: str
    testing: str


def detect_patterns(
    classes: list[dict], functions: list[dict], imports: list[str]
) -> DetectedPatterns:
    """Detect coding patterns from aggregated parse results."""
    return {
        "di_style": _detect_di(classes, functions, imports),
        "error_handling": _detect_error_handling(classes, imports),
        "naming": _detect_naming(classes),
        "logging": _detect_logging(imports),
        "testing": _detect_testing(imports),
    }


def infer_module_purpose(
    name: str, classes: list[dict], packages: list[str]
) -> str:
    """Infer a module's purpose from its contents."""
    all_names = " ".join([name] + [c["name"] for c in classes] + packages).lower()
    purposes = [
        ("api", "API layer"), ("controller", "API layer"),
        ("service", "Business logic"), ("business", "Business logic"),
        ("repository", "Data access"), ("dao", "Data access"),
        ("data", "Data access"),
        ("config", "Configuration"), ("configuration", "Configuration"),
        ("common", "Shared utilities"), ("shared", "Shared utilities"),
        ("test", "Testing"), ("spec", "Testing"),
        ("web", "Web/UI layer"), ("ui", "Web/UI layer"),
        ("model", "Domain model"), ("domain", "Domain model"),
    ]
    for keyword, purpose in purposes:
        if keyword in all_names:
            return purpose
    return "Application module"


def _detect_di(
    classes: list[dict], functions: list[dict], imports: list[str]
) -> str:
    """Detect dependency injection style."""
    all_text = " ".join(imports)
    if "@Inject" in all_text or "@Autowired" in all_text:
        return "field injection"
    if any(f["name"] in ("constructor", "__init__") for f in functions):
        return "constructor injection"
    return "none"


def _detect_error_handling(classes: list[dict], imports: list[str]) -> str:
    """Detect error handling approach."""
    names_text = " ".join(imports + [c["name"] for c in classes])
    if "Result" in names_text or "Either" in names_text:
        return "Result type"
    if "ExceptionHandler" in names_text or "ControllerAdvice" in names_text:
        return "exception handler"
    if "Exception" in names_text or "Error" in names_text:
        return "try-catch"
    return "unknown"


def _detect_naming(classes: list[dict]) -> str:
    """Detect naming conventions from class suffixes."""
    suffixes = ["Controller", "Service", "Repository"]
    found = [
        f"*{s}" for s in suffixes
        if any(c["name"].endswith(s) for c in classes)
    ]
    return ", ".join(found) if found else "unknown"


def _detect_logging(imports: list[str]) -> str:
    """Detect logging framework from imports."""
    imp_text = " ".join(imports)
    if "slf4j" in imp_text or "SLF4J" in imp_text:
        return "SLF4J"
    if "log4j" in imp_text or "Log4j" in imp_text:
        return "Log4j"
    if "logging" in imp_text:
        return "logging"
    return "unknown"


def _detect_testing(imports: list[str]) -> str:
    """Detect testing framework from imports."""
    imp_text = " ".join(imports)
    if "junit" in imp_text or "org.junit" in imp_text:
        return "JUnit"
    if "pytest" in imp_text or "unittest" in imp_text:
        return "pytest"
    if "jest" in imp_text:
        return "Jest"
    if "kotest" in imp_text:
        return "kotest"
    if "vitest" in imp_text:
        return "vitest"
    return "unknown"
