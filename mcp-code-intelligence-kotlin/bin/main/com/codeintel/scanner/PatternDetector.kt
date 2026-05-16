/** Pattern detection — identifies DI style, error handling, naming, logging, testing. */
package com.codeintel.scanner

data class DetectedPatterns(
    val diStyle: String,
    val errorHandling: String,
    val naming: String,
    val logging: String,
    val testing: String
)

/** Detect all coding patterns from aggregated module data. */
fun detectPatterns(
    classes: List<Symbol>,
    functions: List<Symbol>,
    imports: List<String>
): DetectedPatterns = DetectedPatterns(
    diStyle = detectDiStyle(classes, functions, imports),
    errorHandling = detectErrorHandling(classes, imports),
    naming = detectNaming(classes),
    logging = detectLogging(imports),
    testing = detectTesting(imports)
)

/** Infer module purpose from name, classes, and packages. */
fun inferModulePurpose(
    moduleName: String,
    classes: List<Symbol>,
    packages: List<String>
): String {
    val allNames = (listOf(moduleName) + classes.map { it.name } + packages)
        .joinToString(" ").lowercase()
    val purposes = listOf(
        "api" to "API layer", "controller" to "API layer",
        "service" to "Business logic", "business" to "Business logic",
        "repository" to "Data access", "dao" to "Data access",
        "data" to "Data access",
        "config" to "Configuration", "configuration" to "Configuration",
        "common" to "Shared utilities", "shared" to "Shared utilities",
        "test" to "Testing", "spec" to "Testing",
        "web" to "Web/UI layer", "ui" to "Web/UI layer",
        "model" to "Domain model", "domain" to "Domain model",
    )
    for ((keyword, purpose) in purposes) {
        if (keyword in allNames) return purpose
    }
    return "Application module"
}

private fun detectDiStyle(
    classes: List<Symbol>, functions: List<Symbol>, imports: List<String>
): String {
    val allText = imports.joinToString(" ")
    if ("@Inject" in allText || "@Autowired" in allText) return "field injection"
    if (functions.any { it.name in listOf("constructor", "__init__") }) {
        return "constructor injection"
    }
    return "none"
}

private fun detectErrorHandling(classes: List<Symbol>, imports: List<String>): String {
    val allText = (imports + classes.map { it.name }).joinToString(" ")
    if ("Result" in allText || "Either" in allText) return "Result type"
    if ("ExceptionHandler" in allText || "ControllerAdvice" in allText) {
        return "exception handler"
    }
    if ("Exception" in allText || "Error" in allText) return "try-catch"
    return "unknown"
}

private fun detectNaming(classes: List<Symbol>): String {
    val suffixes = listOf("Controller", "Service", "Repository")
    val found = suffixes.filter { suffix ->
        classes.any { it.name.endsWith(suffix) }
    }.map { "*$it" }
    return if (found.isEmpty()) "unknown" else found.joinToString(", ")
}

private fun detectLogging(imports: List<String>): String {
    val allImports = imports.joinToString(" ")
    if ("slf4j" in allImports || "SLF4J" in allImports) return "SLF4J"
    if ("log4j" in allImports || "Log4j" in allImports) return "Log4j"
    if ("logging" in allImports) return "logging"
    return "unknown"
}

private fun detectTesting(imports: List<String>): String {
    val allImports = imports.joinToString(" ")
    if ("junit" in allImports || "org.junit" in allImports) return "JUnit"
    if ("pytest" in allImports || "unittest" in allImports) return "pytest"
    if ("jest" in allImports) return "Jest"
    if ("kotest" in allImports) return "kotest"
    if ("vitest" in allImports) return "vitest"
    return "unknown"
}
