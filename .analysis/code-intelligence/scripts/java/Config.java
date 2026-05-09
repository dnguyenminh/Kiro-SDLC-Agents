import java.io.*;
import java.nio.file.*;
import java.util.*;

/**
 * Configuration loading for the Code Intelligence indexer.
 * Reads index-config.json or provides sensible defaults.
 */
public class Config {

    public List<String> includedExtensions;
    public List<String> excludedDirectories;
    public List<String> excludedFilePatterns;

    public static final Map<String, String> EXTENSION_MAP = Map.ofEntries(
        Map.entry(".kt", "kotlin"), Map.entry(".java", "java"),
        Map.entry(".ts", "typescript"), Map.entry(".tsx", "typescript"),
        Map.entry(".js", "javascript"), Map.entry(".jsx", "javascript"),
        Map.entry(".py", "python"), Map.entry(".go", "go"),
        Map.entry(".rs", "rust"), Map.entry(".cs", "csharp"),
        Map.entry(".gradle", "gradle"), Map.entry(".yml", "yaml"),
        Map.entry(".yaml", "yaml"), Map.entry(".xml", "xml"),
        Map.entry(".sql", "sql"), Map.entry(".json", "json"),
        Map.entry(".properties", "properties"), Map.entry(".toml", "config"),
        Map.entry(".cfg", "config"), Map.entry(".ini", "config")
    );

    public static final Map<String, String> SOURCE_EXTENSIONS = Map.ofEntries(
        Map.entry(".kt", "kotlin"), Map.entry(".java", "java"),
        Map.entry(".ts", "typescript"), Map.entry(".tsx", "typescript"),
        Map.entry(".js", "javascript"), Map.entry(".jsx", "javascript"),
        Map.entry(".py", "python"), Map.entry(".go", "go"),
        Map.entry(".rs", "rust"), Map.entry(".cs", "csharp")
    );

    public static Config loadDefaults() {
        Config c = new Config();
        c.includedExtensions = List.of(
            ".kt", ".java", ".ts", ".tsx", ".js", ".jsx", ".py", ".go",
            ".rs", ".cs", ".gradle.kts", ".gradle", ".yml", ".yaml",
            ".properties", ".xml", ".json", ".sql", ".toml", ".cfg", ".ini");
        c.excludedDirectories = List.of(
            "build", "dist", "out", "target", ".gradle", ".git", ".analysis",
            "node_modules", ".idea", ".kiro", ".vscode", "__pycache__",
            ".mypy_cache", "vendor", "bin", "obj");
        c.excludedFilePatterns = List.of(
            "*.generated.*", "*.min.*", "*.map", "*.lock", "*.sum");
        return c;
    }

    public static Config load(String configPath) {
        try {
            String content = Files.readString(Path.of(configPath));
            return parseJson(content);
        } catch (Exception e) {
            return loadDefaults();
        }
    }

    private static Config parseJson(String json) {
        Config c = loadDefaults();
        c.includedExtensions = extractJsonArray(json, "includedExtensions");
        c.excludedDirectories = extractJsonArray(json, "excludedDirectories");
        c.excludedFilePatterns = extractJsonArray(json, "excludedFilePatterns");
        return c;
    }

    static List<String> extractJsonArray(String json, String key) {
        int idx = json.indexOf("\"" + key + "\"");
        if (idx < 0) return List.of();
        int start = json.indexOf('[', idx);
        int end = json.indexOf(']', start);
        if (start < 0 || end < 0) return List.of();
        String arr = json.substring(start + 1, end);
        List<String> result = new ArrayList<>();
        var matcher = java.util.regex.Pattern.compile("\"([^\"]+)\"").matcher(arr);
        while (matcher.find()) result.add(matcher.group(1));
        return result;
    }
}
