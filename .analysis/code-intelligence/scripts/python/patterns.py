"""Pattern detection — identifies DI style, error handling, naming, etc."""

from typing import Dict, List


def detect_patterns(classes: List[dict], functions: List[dict], imports: List[str]) -> dict:
    """Detect coding patterns from aggregated parse results."""
    return {
        "diStyle": _detect_di(classes, functions, imports),
        "errorHandling": _detect_error_handling(classes, imports),
        "naming": _detect_naming(classes),
        "logging": _detect_logging(imports),
        "testing": _detect_testing(imports),
    }


def infer_module_purpose(name: str, classes: List[dict], packages: List[str]) -> str:
    """Infer a module's purpose from its contents."""
    all_names = " ".join([name] + [c["name"] for c in classes] + packages).lower()
    purposes = [
        ("api", "API layer"), ("controller", "API layer"),
        ("service", "Business logic"), ("business", "Business logic"),
        ("repository", "Data access"), ("dao", "Data access"),
        ("config", "Configuration"), ("common", "Shared utilities"),
        ("shared", "Shared utilities"), ("test", "Testing"),
        ("web", "Web/UI layer"), ("ui", "Web/UI layer"),
        ("model", "Domain model"), ("domain", "Domain model"),
    ]
    for keyword, purpose in purposes:
        if keyword in all_names:
            return purpose
    return "Application module"


def _detect_di(classes, functions, imports):
    """Detect dependency injection style."""
    all_text = " ".join(imports)
    if "@Inject" in all_text or "@Autowired" in all_text:
        return "field injection"
    if any(f["name"] in ("constructor", "__init__") for f in functions):
        return "constructor injection"
    return "none"


def _detect_error_handling(classes, imports):
    """Detect error handling approach."""
    names_text = " ".join(imports + [c["name"] for c in classes])
    if "Result" in names_text or "Either" in names_text:
        return "Result type"
    if "ExceptionHandler" in names_text or "ControllerAdvice" in names_text:
        return "exception handler"
    if "Exception" in names_text or "Error" in names_text:
        return "try-catch"
    return "unknown"


def _detect_naming(classes):
    """Detect naming conventions from class suffixes."""
    suffixes = ["Controller", "Service", "Repository"]
    found = [f"*{s}" for s in suffixes if any(c["name"].endswith(s) for c in classes)]
    return ", ".join(found) if found else "unknown"


def _detect_logging(imports):
    """Detect logging framework from imports."""
    imp_text = " ".join(imports)
    if "slf4j" in imp_text or "SLF4J" in imp_text:
        return "SLF4J"
    if "log4j" in imp_text:
        return "Log4j"
    if "logging" in imp_text:
        return "logging"
    return "unknown"


def _detect_testing(imports):
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
