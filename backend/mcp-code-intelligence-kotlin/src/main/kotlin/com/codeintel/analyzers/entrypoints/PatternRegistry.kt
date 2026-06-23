/**
 * KSA-162: Pattern Registry — Manages framework detection patterns.
 */
package com.codeintel.analyzers.entrypoints

class PatternRegistry {
    private val frameworks: Map<String, FrameworkPatterns> = mapOf(
        "fastapi" to FrameworkPatterns(
            language = "python",
            imports = listOf("fastapi", "from fastapi"),
            decorators = DecoratorPatterns(
                handler = listOf("app.get", "app.post", "app.put", "app.delete", "app.patch",
                    "router.get", "router.post", "router.put", "router.delete", "router.patch"),
                prefix = listOf("APIRouter(prefix="),
            ),
            authIndicators = listOf("Depends(get_current_user)", "Security(", "Depends(auth"),
        ),
        "express" to FrameworkPatterns(
            language = "typescript",
            imports = listOf("express", "from 'express'", "from \"express\""),
            callPatterns = CallPatterns(
                handler = listOf("app.get", "app.post", "app.put", "app.delete", "app.patch",
                    "router.get", "router.post", "router.put", "router.delete", "router.patch"),
                mount = listOf("app.use"),
            ),
            authIndicators = listOf("authenticate", "passport", "authMiddleware", "requireAuth"),
        ),
        "nestjs" to FrameworkPatterns(
            language = "typescript",
            imports = listOf("@nestjs/common", "@nestjs/core"),
            decorators = DecoratorPatterns(
                handler = listOf("Get", "Post", "Put", "Delete", "Patch", "Head", "Options", "All"),
                prefix = listOf("Controller"),
            ),
            authIndicators = listOf("UseGuards", "AuthGuard", "@Auth", "JwtAuthGuard"),
        ),
        "spring" to FrameworkPatterns(
            language = "java",
            imports = listOf("org.springframework.web", "org.springframework.boot"),
            decorators = DecoratorPatterns(
                handler = listOf("GetMapping", "PostMapping", "PutMapping", "DeleteMapping", "PatchMapping", "RequestMapping"),
                prefix = listOf("RequestMapping", "RestController"),
            ),
            authIndicators = listOf("@PreAuthorize", "@Secured", "@RolesAllowed"),
        ),
        "ktor" to FrameworkPatterns(
            language = "kotlin",
            imports = listOf("io.ktor.server", "io.ktor.routing"),
            callPatterns = CallPatterns(
                handler = listOf("get(", "post(", "put(", "delete(", "patch(", "route("),
                mount = listOf("routing {", "install("),
            ),
            authIndicators = listOf("authenticate(", "principal", "jwt {"),
        ),
        "gin" to FrameworkPatterns(
            language = "go",
            imports = listOf("github.com/gin-gonic/gin"),
            callPatterns = CallPatterns(
                handler = listOf("GET(", "POST(", "PUT(", "DELETE(", "PATCH(", "Handle("),
                mount = listOf("Group("),
            ),
            authIndicators = listOf("AuthMiddleware", "authRequired", "JWTAuth"),
        ),
    )

    private val mainPatterns: Map<String, Pair<String, String>> = mapOf(
        "python" to ("if __name__ == \"__main__\":" to "MAIN"),
        "typescript" to ("process.argv" to "MAIN"),
        "javascript" to ("process.argv" to "MAIN"),
        "java" to ("public static void main(String" to "MAIN"),
        "kotlin" to ("fun main(" to "MAIN"),
        "go" to ("func main()" to "MAIN"),
    )

    fun getFramework(name: String): FrameworkPatterns? = frameworks[name]

    fun getFrameworkNames(): List<String> = frameworks.keys.toList()

    fun getFrameworksForLanguage(language: String): List<Pair<String, FrameworkPatterns>> =
        frameworks.filter { it.value.language == language }.map { it.key to it.value }

    fun getMainPattern(language: String): Pair<String, String>? = mainPatterns[language]
}
