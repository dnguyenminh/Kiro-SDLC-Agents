"""KSA-162: Pattern Registry — Framework detection patterns."""
from __future__ import annotations
from . import FrameworkPatterns

DEFAULT_FRAMEWORKS: dict[str, FrameworkPatterns] = {
    "fastapi": FrameworkPatterns(
        language="python", imports=["fastapi", "from fastapi"],
        decorators={"handler": ["app.get", "app.post", "app.put", "app.delete", "app.patch",
                                "router.get", "router.post", "router.put", "router.delete", "router.patch"],
                    "prefix": ["APIRouter(prefix="]},
        auth_indicators=["Depends(get_current_user)", "Security(", "Depends(auth"],
    ),
    "express": FrameworkPatterns(
        language="typescript", imports=["express", "from 'express'", 'from "express"'],
        call_patterns={"handler": ["app.get", "app.post", "app.put", "app.delete", "app.patch",
                                   "router.get", "router.post", "router.put", "router.delete", "router.patch"],
                       "mount": ["app.use"]},
        auth_indicators=["authenticate", "passport", "authMiddleware", "requireAuth"],
    ),
    "nestjs": FrameworkPatterns(
        language="typescript", imports=["@nestjs/common", "@nestjs/core"],
        decorators={"handler": ["Get", "Post", "Put", "Delete", "Patch", "Head", "Options", "All"],
                    "prefix": ["Controller"]},
        auth_indicators=["UseGuards", "AuthGuard", "@Auth", "JwtAuthGuard"],
    ),
    "spring": FrameworkPatterns(
        language="java", imports=["org.springframework.web", "org.springframework.boot"],
        decorators={"handler": ["GetMapping", "PostMapping", "PutMapping", "DeleteMapping", "PatchMapping", "RequestMapping"],
                    "prefix": ["RequestMapping", "RestController"]},
        auth_indicators=["@PreAuthorize", "@Secured", "@RolesAllowed"],
    ),
    "ktor": FrameworkPatterns(
        language="kotlin", imports=["io.ktor.server", "io.ktor.routing"],
        call_patterns={"handler": ["get(", "post(", "put(", "delete(", "patch(", "route("],
                       "mount": ["routing {", "install("]},
        auth_indicators=["authenticate(", "principal", "jwt {"],
    ),
    "gin": FrameworkPatterns(
        language="go", imports=["github.com/gin-gonic/gin"],
        call_patterns={"handler": ["GET(", "POST(", "PUT(", "DELETE(", "PATCH(", "Handle("],
                       "mount": ["Group("]},
        auth_indicators=["AuthMiddleware", "authRequired", "JWTAuth"],
    ),
}

MAIN_PATTERNS: dict[str, tuple[str, str]] = {
    "python": ('if __name__ == "__main__":', "MAIN"),
    "typescript": ("process.argv", "MAIN"),
    "javascript": ("process.argv", "MAIN"),
    "java": ("public static void main(String", "MAIN"),
    "kotlin": ("fun main(", "MAIN"),
    "go": ("func main()", "MAIN"),
}


class PatternRegistry:
    def __init__(self) -> None:
        self._frameworks = DEFAULT_FRAMEWORKS
        self._main_patterns = MAIN_PATTERNS

    def get_framework(self, name: str) -> FrameworkPatterns | None:
        return self._frameworks.get(name)

    def get_frameworks_for_language(self, language: str) -> list[tuple[str, FrameworkPatterns]]:
        return [(n, p) for n, p in self._frameworks.items() if p.language == language]

    def get_main_pattern(self, language: str) -> tuple[str, str] | None:
        return self._main_patterns.get(language)
