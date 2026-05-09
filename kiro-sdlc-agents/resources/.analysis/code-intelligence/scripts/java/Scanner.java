import java.io.*;
import java.nio.file.*;
import java.util.*;

/**
 * File scanner — discovers and filters source files for indexing.
 */
public class Scanner {

    public record ScannedFile(String filePath, String contentHash, String language) {}

    public static List<ScannedFile> scanFiles(Config config, List<String> sourceDirs, Path rootDir) {
        List<ScannedFile> results = new ArrayList<>();
        for (String srcDir : sourceDirs) {
            Path absDir = rootDir.resolve(srcDir);
            if (Files.isDirectory(absDir)) {
                walkDirectory(absDir, rootDir, config, results);
            }
        }
        return results;
    }

    private static void walkDirectory(Path dir, Path rootDir, Config config, List<ScannedFile> results) {
        try (var stream = Files.list(dir)) {
            stream.forEach(path -> {
                if (Files.isDirectory(path)) {
                    String name = path.getFileName().toString();
                    if (!config.excludedDirectories.contains(name)) {
                        walkDirectory(path, rootDir, config, results);
                    }
                } else if (Files.isRegularFile(path)) {
                    String relPath = rootDir.relativize(path).toString().replace("\\", "/");
                    if (shouldInclude(relPath, config)) {
                        String hash = Utils.computeHash(path);
                        String lang = Utils.mapExtension(path.getFileName().toString());
                        results.add(new ScannedFile(relPath, hash, lang));
                    }
                }
            });
        } catch (IOException ignored) {}
    }

    private static boolean shouldInclude(String filePath, Config config) {
        String basename = Path.of(filePath).getFileName().toString();
        boolean hasExt = config.includedExtensions.stream().anyMatch(basename::endsWith);
        if (!hasExt) return false;
        for (String seg : filePath.split("/")) {
            if (config.excludedDirectories.contains(seg)) return false;
        }
        for (String pattern : config.excludedFilePatterns) {
            if (Utils.globMatch(basename, pattern)) return false;
        }
        return true;
    }
}
