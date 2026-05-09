import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.regex.*;

/**
 * Source file parser — extracts classes, functions, imports using regex.
 */
public class Parser {

    public record ParseResult(String filePath, String language, String moduleName,
        String packageName, List<String> classes, List<String> functions,
        List<String> imports, String status) {}

    public static ParseResult parse(Path filePath, String language, String moduleName) {
        String content;
        try {
            content = Files.readString(filePath);
        } catch (IOException e) {
            return new ParseResult(filePath.toString(), language, moduleName, "",
                List.of(), List.of(), List.of(), "read_error");
        }
        return switch (language) {
            case "kotlin" -> parseKotlin(filePath.toString(), content, moduleName);
            case "java" -> parseJava(filePath.toString(), content, moduleName);
            case "python" -> parsePython(filePath.toString(), content, moduleName);
            case "go" -> parseGo(filePath.toString(), content, moduleName);
            case "typescript", "javascript" -> parseTypeScript(filePath.toString(), content, moduleName);
            case "rust" -> parseRust(filePath.toString(), content, moduleName);
            case "csharp" -> parseCSharp(filePath.toString(), content, moduleName);
            default -> new ParseResult(filePath.toString(), language, moduleName, "",
                List.of(), List.of(), List.of(), "success");
        };
    }

    private static ParseResult parseKotlin(String fp, String content, String mod) {
        String pkg = extractFirst(content, "^package\\s+([\\w.]+)", Pattern.MULTILINE);
        List<String> imports = extractAll(content, "^import\\s+([\\w.*]+)", Pattern.MULTILINE);
        List<String> classes = extractAll(content, "(?:class|object|interface|enum class)\\s+(\\w+)", 0);
        List<String> functions = extractAll(content, "fun\\s+(\\w+)\\s*\\(", 0);
        return new ParseResult(fp, "kotlin", mod, pkg, classes, functions, imports, "success");
    }

    private static ParseResult parseJava(String fp, String content, String mod) {
        String pkg = extractFirst(content, "^package\\s+([\\w.]+);", Pattern.MULTILINE);
        List<String> imports = extractAll(content, "^import\\s+([\\w.*]+);", Pattern.MULTILINE);
        List<String> classes = extractAll(content, "(?:class|interface|enum)\\s+(\\w+)", 0);
        List<String> functions = extractAll(content, "(?:public|private|protected)\\s+\\w+\\s+(\\w+)\\s*\\(", 0);
        return new ParseResult(fp, "java", mod, pkg, classes, functions, imports, "success");
    }

    private static ParseResult parsePython(String fp, String content, String mod) {
        List<String> imports = extractAll(content, "^(?:import|from)\\s+(\\S+)", Pattern.MULTILINE);
        List<String> classes = extractAll(content, "^class\\s+(\\w+)", Pattern.MULTILINE);
        List<String> functions = extractAll(content, "^def\\s+(\\w+)", Pattern.MULTILINE);
        return new ParseResult(fp, "python", mod, "", classes, functions, imports, "success");
    }

    private static ParseResult parseGo(String fp, String content, String mod) {
        String pkg = extractFirst(content, "^package\\s+(\\w+)", Pattern.MULTILINE);
        List<String> imports = extractAll(content, "\"([\\w./]+)\"", 0);
        List<String> classes = extractAll(content, "type\\s+(\\w+)\\s+struct", 0);
        List<String> functions = extractAll(content, "func\\s+(\\w+)\\s*\\(", 0);
        return new ParseResult(fp, "go", mod, pkg, classes, functions, imports, "success");
    }

    private static ParseResult parseTypeScript(String fp, String content, String mod) {
        List<String> imports = extractAll(content, "(?:from|require\\()\\s*['\"]([^'\"]+)['\"]", 0);
        List<String> classes = extractAll(content, "class\\s+(\\w+)", 0);
        List<String> functions = extractAll(content, "(?:export\\s+)?(?:async\\s+)?function\\s+(\\w+)", 0);
        return new ParseResult(fp, "typescript", mod, "", classes, functions, imports, "success");
    }

    private static ParseResult parseRust(String fp, String content, String mod) {
        List<String> imports = extractAll(content, "^use\\s+([\\w:*]+);", Pattern.MULTILINE);
        List<String> classes = extractAll(content, "(?:pub\\s+)?(?:struct|enum)\\s+(\\w+)", 0);
        List<String> functions = extractAll(content, "(?:pub\\s+)?fn\\s+(\\w+)", 0);
        return new ParseResult(fp, "rust", mod, "", classes, functions, imports, "success");
    }

    private static ParseResult parseCSharp(String fp, String content, String mod) {
        String pkg = extractFirst(content, "namespace\\s+([\\w.]+)", 0);
        List<String> imports = extractAll(content, "^using\\s+([\\w.]+);", Pattern.MULTILINE);
        List<String> classes = extractAll(content, "(?:class|interface)\\s+(\\w+)", 0);
        List<String> functions = extractAll(content, "(?:public|private)\\s+\\w+\\s+(\\w+)\\s*\\(", 0);
        return new ParseResult(fp, "csharp", mod, pkg, classes, functions, imports, "success");
    }

    private static String extractFirst(String content, String regex, int flags) {
        Matcher m = Pattern.compile(regex, flags).matcher(content);
        return m.find() ? m.group(1) : "";
    }

    private static List<String> extractAll(String content, String regex, int flags) {
        List<String> results = new ArrayList<>();
        Matcher m = Pattern.compile(regex, flags).matcher(content);
        while (m.find()) results.add(m.group(1));
        return results;
    }
}
