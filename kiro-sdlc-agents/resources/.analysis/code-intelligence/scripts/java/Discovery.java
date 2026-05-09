import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.regex.*;

/**
 * Module discovery — finds subprojects based on build system.
 */
public class Discovery {

    public record Module(String name, String path, List<String> sourceDirectories, String buildFile, String language) {}

    public static List<Module> discover(Path rootDir, Detector.DetectionResult detection) {
        List<Module> modules = switch (detection.projectType()) {
            case "gradle-kotlin", "gradle-java" -> discoverGradle(rootDir);
            case "maven-java" -> discoverMaven(rootDir);
            case "npm-typescript", "npm-javascript" -> discoverNpm(rootDir);
            default -> List.of();
        };
        if (modules.isEmpty()) {
            modules = List.of(createRootModule(rootDir, detection));
        }
        System.out.printf("[Code-Index] INFO: Module discovery — found %d module(s)%n", modules.size());
        return modules;
    }

    private static Module createRootModule(Path root, Detector.DetectionResult det) {
        List<String> srcDirs = new ArrayList<>();
        for (String dir : List.of("src", "lib")) {
            if (Files.isDirectory(root.resolve(dir))) { srcDirs.add(dir); break; }
        }
        if (srcDirs.isEmpty()) srcDirs.add(".");
        String bf = "none".equals(det.buildFile()) ? null : det.buildFile();
        return new Module("root", ".", srcDirs, bf, null);
    }

    private static List<Module> discoverGradle(Path root) {
        List<Module> modules = new ArrayList<>();
        for (String sf : List.of("settings.gradle.kts", "settings.gradle")) {
            Path path = root.resolve(sf);
            if (!Files.isRegularFile(path)) continue;
            try {
                String content = Files.readString(path);
                Set<String> seen = new HashSet<>();
                Matcher m = Pattern.compile("[\"']([^\"']+)[\"']").matcher(content);
                while (m.find()) {
                    String name = m.group(1).replaceFirst("^:", "").replace(":", "/");
                    if (seen.contains(name) || !Files.isDirectory(root.resolve(name))) continue;
                    seen.add(name);
                    modules.add(new Module(name.replace("/", "-"), name, gradleSrcDirs(root, name), null, null));
                }
            } catch (IOException ignored) {}
            break;
        }
        return modules;
    }

    private static List<Module> discoverMaven(Path root) {
        List<Module> modules = new ArrayList<>();
        Path pom = root.resolve("pom.xml");
        if (!Files.isRegularFile(pom)) return modules;
        try {
            String content = Files.readString(pom);
            Matcher m = Pattern.compile("<module>\\s*([^<]+?)\\s*</module>").matcher(content);
            while (m.find()) {
                String name = m.group(1).trim();
                if (Files.isDirectory(root.resolve(name))) {
                    modules.add(new Module(name, name, gradleSrcDirs(root, name), name + "/pom.xml", null));
                }
            }
        } catch (IOException ignored) {}
        return modules;
    }

    private static List<Module> discoverNpm(Path root) {
        List<Module> modules = new ArrayList<>();
        Path pkgPath = root.resolve("package.json");
        if (!Files.isRegularFile(pkgPath)) return modules;
        try {
            String content = Files.readString(pkgPath);
            List<String> workspaces = Config.extractJsonArray(content, "workspaces");
            for (String pattern : workspaces) {
                if (pattern.contains("*")) {
                    String parent = pattern.replaceAll("/\\*\\*?$", "").replaceAll("/\\*$", "");
                    Path parentDir = root.resolve(parent);
                    if (Files.isDirectory(parentDir)) {
                        try (var stream = Files.list(parentDir)) {
                            stream.filter(Files::isDirectory).forEach(dir -> {
                                String modPath = parent + "/" + dir.getFileName();
                                modules.add(new Module(dir.getFileName().toString(), modPath,
                                    npmSrcDirs(root, modPath), modPath + "/package.json", null));
                            });
                        }
                    }
                } else if (Files.isDirectory(root.resolve(pattern))) {
                    modules.add(new Module(Path.of(pattern).getFileName().toString(), pattern,
                        npmSrcDirs(root, pattern), pattern + "/package.json", null));
                }
            }
        } catch (IOException ignored) {}
        return modules;
    }

    private static List<String> gradleSrcDirs(Path root, String modPath) {
        List<String> dirs = new ArrayList<>();
        for (String sd : List.of("src/main/kotlin", "src/main/java", "src/test/kotlin", "src/test/java")) {
            if (Files.isDirectory(root.resolve(modPath).resolve(sd))) dirs.add(modPath + "/" + sd);
        }
        return dirs.isEmpty() ? List.of(modPath) : dirs;
    }

    private static List<String> npmSrcDirs(Path root, String modPath) {
        for (String sd : List.of("src", "lib", "app")) {
            if (Files.isDirectory(root.resolve(modPath).resolve(sd))) return List.of(modPath + "/" + sd);
        }
        return List.of(modPath);
    }
}
