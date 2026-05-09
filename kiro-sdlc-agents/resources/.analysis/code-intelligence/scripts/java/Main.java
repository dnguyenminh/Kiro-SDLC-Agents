import java.io.*;
import java.nio.file.*;
import java.time.*;
import java.util.*;

/**
 * Code Intelligence System — Full Indexer (Java Edition)
 *
 * Zero external dependencies — uses only Java 17+ standard library.
 * Usage: Compile all .java files, then run Main with project root path.
 */
public class Main {

    public static void main(String[] args) {
        String rootDir = args.length > 0 ? args[0] : System.getProperty("user.dir");
        Path root = Path.of(rootDir).toAbsolutePath();
        long start = System.currentTimeMillis();

        Path outputDir = root.resolve(".analysis/code-intelligence");
        Config config = Config.load(outputDir.resolve("index-config.json").toString());
        var detection = Detector.detect(root);
        var modules = Discovery.discover(root, detection);

        List<Map<String, Object>> modulesData = processModules(modules, config, root, detection);
        writeMetadata(root, outputDir, detection, modulesData);
        writeAnalysis(outputDir, detection, modulesData, root);
        writeKbPayloads(outputDir, modulesData, root);

        long elapsed = System.currentTimeMillis() - start;
        int totalFiles = modulesData.stream().mapToInt(m -> (int) m.get("sourceFileCount")).sum();
        int totalClasses = modulesData.stream().mapToInt(m -> ((List<?>) m.get("classes")).size()).sum();
        int totalFunctions = modulesData.stream().mapToInt(m -> ((List<?>) m.get("functions")).size()).sum();

        System.out.printf("%n[Code-Index] INFO: Full index complete — %d files, %d modules, %d classes, %d functions, %dms%n",
            totalFiles, modulesData.size(), totalClasses, totalFunctions, elapsed);
        System.out.printf("{\"totalFiles\":%d,\"totalModules\":%d,\"totalClasses\":%d,\"totalFunctions\":%d,\"elapsedMs\":%d}%n",
            totalFiles, modulesData.size(), totalClasses, totalFunctions, elapsed);
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> processModules(List<Discovery.Module> modules,
            Config config, Path root, Detector.DetectionResult detection) {
        List<Map<String, Object>> result = new ArrayList<>();
        int total = 0;

        for (var mod : modules) {
            var scanned = Scanner.scanFiles(config, mod.sourceDirectories(), root);
            List<String> allClasses = new ArrayList<>(), allFunctions = new ArrayList<>(), allImports = new ArrayList<>();

            for (var file : scanned) {
                total++;
                System.out.printf("\r[Code-Index] INFO: Indexing — %d files (%s)", total, mod.name());
                var parsed = Parser.parse(root.resolve(file.filePath()), file.language(), mod.name());
                allClasses.addAll(parsed.classes());
                allFunctions.addAll(parsed.functions());
                allImports.addAll(parsed.imports());
            }

            var patterns = Patterns.detect(allClasses, allFunctions, allImports);
            String purpose = Patterns.inferModulePurpose(mod.name(), allClasses);
            String lang = mod.language() != null ? mod.language() : detection.primaryLanguage();

            Map<String, Object> moduleData = new HashMap<>();
            moduleData.put("name", mod.name());
            moduleData.put("path", mod.path());
            moduleData.put("language", lang);
            moduleData.put("framework", detection.framework());
            moduleData.put("sourceFileCount", scanned.size());
            moduleData.put("classes", allClasses);
            moduleData.put("functions", allFunctions);
            moduleData.put("patterns", patterns);
            moduleData.put("purpose", purpose);
            result.add(moduleData);
        }
        return result;
    }

    private static void writeMetadata(Path root, Path outputDir, Detector.DetectionResult det, List<Map<String, Object>> modules) {
        int total = modules.stream().mapToInt(m -> (int) m.get("sourceFileCount")).sum();
        String json = String.format(
            "{\"version\":\"1.0\",\"lastFullIndexTimestamp\":\"%s\",\"projectName\":\"%s\",\"projectType\":\"%s\",\"totalFiles\":%d}",
            Instant.now(), root.getFileName(), det.projectType(), total);
        Utils.atomicWrite(outputDir.resolve("index-metadata.json"), json);
    }

    private static void writeAnalysis(Path outputDir, Detector.DetectionResult det, List<Map<String, Object>> modules, Path root) {
        Map<String, String> projectInfo = Map.of(
            "projectName", root.getFileName().toString(),
            "projectType", det.projectType(),
            "primaryLanguage", det.primaryLanguage(),
            "framework", String.valueOf(det.framework()));
        Generator.generateProjectStructure(modules, projectInfo, outputDir);
        for (var mod : modules) Generator.generateModuleAnalysis(mod, outputDir);
    }

    @SuppressWarnings("unchecked")
    private static void writeKbPayloads(Path outputDir, List<Map<String, Object>> modules, Path root) {
        var sb = new StringBuilder("[\n");
        for (int i = 0; i < modules.size(); i++) {
            var mod = modules.get(i);
            if (i > 0) sb.append(",\n");
            sb.append(String.format("  {\"title\":\"Code Index — %s\",\"content\":\"Module: %s, Files: %s, Classes: %d\",\"tags\":\"code-index, %s\",\"project\":\"%s\"}",
                mod.get("name"), mod.get("name"), mod.get("sourceFileCount"),
                ((List<?>) mod.get("classes")).size(), mod.get("name"), root.getFileName()));
        }
        sb.append("\n]");
        Utils.atomicWrite(outputDir.resolve("kb-payloads.json"), sb.toString());
    }
}
