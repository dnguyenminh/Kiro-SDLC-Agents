/**
 * KSA-162: CLI Command Detector.
 */
package com.codeintel.analyzers.entrypoints.detectors

import com.codeintel.analyzers.entrypoints.*

private val CLI_PATTERNS = listOf(
    "commander" to ".command(",
    "yargs" to ".command(",
    "click" to "@click.command",
    "argparse" to "add_subparsers",
    "cobra" to "cobra.Command",
    "clap" to "#[command",
)

class CLIDetector {

    fun detect(symbols: List<SymbolInput>, source: String): List<EntryPoint> {
        val cliFramework = CLI_PATTERNS.find { source.contains(it.first) } ?: return emptyList()
        return symbols.filter { sym ->
            val decorators = sym.decorators ?: emptyList()
            decorators.any { "command" in it || "cli" in it } ||
                "command" in sym.name || "cmd" in sym.name || sym.name.startsWith("cli_")
        }.map { sym ->
            EntryPoint(
                symbolId = sym.id, symbolName = sym.name,
                filePath = sym.filePath, startLine = sym.startLine,
                entryType = EntryType.CLI_COMMAND, framework = cliFramework.first,
                eventName = sym.name, confidence = Confidence.Medium,
            )
        }
    }
}
