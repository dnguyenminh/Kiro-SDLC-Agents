import java.io.*;
import java.nio.file.*;
import java.util.*;

/**
 * Project type detection — identifies build system, language, and framework.
 */
public class Detector {

    private static final String[][] BUILD_FILES = {
        {"build.gradle.kts", "gradle-kotlin"}, {"build.gradle", "gradle-java"},
        {"pom.xml", "maven-java"}, {"package.json", "npm"},
        {"Cargo.toml", "cargo-rust"}, {"go.mod", "go-module"},
        {"pyproject.toml", "python"}, {"setup.py", "python"},
    };

    private static final Map<String, String> TYPE_LANGUAGE = Map.ofEntries(
        Map.entry("gradle-kotlin", "kotlin"), Map.entry("gradle-java", "java"),
        Map.entry("maven-java", "java"), Map.entry("npm-typescript", "typescript"),
        Map.entry("npm-javascript", "javascript"), Map.entry("cargo-rust", "rust"),
        Map.entry("go-module", "go"), Map.entry("python", "python"),
        Map.entry("dotnet", "csharp"), Map.entry("generic", "unknown")
    );

    public record DetectionResult(String projectType, String primaryLanguage, String framework, String buildFile) {}

    public static DetectionResult detect(Path rootDir) {
        String[] buildInfo = findBuildFile(rootDir);
        String projectType = buildInfo[0];
        String buildFile = buildInfo[1];

        projectType = refineNpm(rootDir, projectType);
        String language = determineLanguage(rootDir, projectType);
        String framework = detectFramework(rootDir, buildFile, projectType);

        System.out.printf("[Code-Index] INFO: Project detected — type=%s, language=%s, framework=%s, buildFile=%s%n",
            projectType, language, framework, buildFile);
        return new DetectionResult(projectType, language, framework, buildFile);
    }

    private static String[] findBuildFile(Path root) {
        for (String[] entry : BUILD_FILES) {
            if (Files.isRegularFile(root.resolve(entry[0]))) {
                return new String[]{entry[1], entry[0]};
            }
        }
        try (var stream = Files.list(root)) {
            var sln = stream.filter(p -> p.toString().endsWith(".sln")).findFirst();
            if (sln.isPresent()) return new String[]{"dotnet", sln.get().getFileName().toString()};
        } catch (IOException ignored) {}
        return new String[]{"generic", "none"};
    }

    private static String refineNpm(Path root, String type) {
        if (!"npm".equals(type)) return type;
        return Files.isRegularFile(root.resolve("tsconfig.json")) ? "npm-typescript" : "npm-javascript";
    }

    private static String determineLanguage(Path root, String projectType) {
        String implied = TYPE_LANGUAGE.getOrDefault(projectType, "unknown");
        Map<String, Integer> counts = countSourceFiles(root, 3, 0);
        if (!"unknown".equals(implied) && counts.getOrDefault(implied, 0) > 0) return implied;
        return counts.entrySet().stream()
            .max(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey).orElse(implied);
    }

    private static String detectFramework(Path root, String buildFile, String projectType) {
        if ("none".equals(buildFile)) return null;
        try {
            String content = Files.readString(root.resolve(buildFile));
            String[][] patterns = getFrameworkPatterns(projectType);
            for (String[] p : patterns) {
                if (content.contains(p[0])) return p[1];
            }
        } catch (IOException ignored) {}
        return null;
    }

    private static String[][] getFrameworkPatterns(String type) {
        return switch (type) {
            case "gradle-kotlin", "gradle-java" -> new String[][]{
                {"spring-boot-starter", "Spring Boot"}, {"io.ktor", "Ktor"}, {"ktor-", "Ktor"}};
            case "maven-java" -> new String[][]{
                {"spring-boot-starter", "Spring Boot"}, {"io.quarkus", "Quarkus"}};
            case "npm-typescript", "npm-javascript" -> new String[][]{
                {"\"react\"", "React"}, {"\"next\"", "Next.js"}, {"\"express\"", "Express.js"}};
            case "python" -> new String[][]{
                {"django", "Django"}, {"fastapi", "FastAPI"}, {"flask", "Flask"}};
            default -> new String[][]{};
        };
    }

    private static Map<String, Integer> countSourceFiles(Path dir, int maxDepth, int depth) {
        Map<String, Integer> counts = new HashMap<>();
        if (depth > maxDepth) return counts;
        Set<String> skip = Set.of("node_modules", ".git", "build", "dist", "target", ".gradle", "vendor");
        try (var stream = Files.list(dir)) {
            stream.forEach(path -> {
                if (Files.isDirectory(path)) {
                    if (!skip.contains(path.getFileName().toString())) {
                        countSourceFiles(path, maxDepth, depth + 1).forEach((k, v) -> counts.merge(k, v, Integer::sum));
                    }
                } else {
                    String ext = getExtension(path.getFileName().toString());
                    String lang = Config.SOURCE_EXTENSIONS.get(ext);
                    if (lang != null) counts.merge(lang, 1, Integer::sum);
                }
            });
        } catch (IOException ignored) {}
        return counts;
    }

    private static String getExtension(String name) {
        int dot = name.lastIndexOf('.');
        return dot >= 0 ? name.substring(dot).toLowerCase() : "";
    }
}
