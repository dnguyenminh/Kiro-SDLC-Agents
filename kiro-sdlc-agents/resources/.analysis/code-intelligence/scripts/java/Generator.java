import java.nio.file.*;
import java.time.*;
import java.time.format.*;
import java.util.*;

/**
 * Analysis file generator — produces markdown output files.
 */
public class Generator {

    public static void generateProjectStructure(List<Map<String, Object>> modulesData,
            Map<String, String> projectInfo, Path outputDir) {
        String timestamp = Instant.now().toString();
        var sb = new StringBuilder();
        sb.append("# Project Structure — ").append(projectInfo.get("projectName")).append("\n\n");
        sb.append("**Last Updated:** ").append(timestamp).append("\n");
        sb.append("**Project Type:** ").append(projectInfo.get("projectType")).append("\n\n");
        sb.append("## Modules\n\n");
        sb.append("| Module | Purpose | Language | Framework | Source Files |\n");
        sb.append("|--------|---------|----------|-----------|-------------|\n");

        for (var mod : modulesData) {
            Object fwObj = mod.get("framework");
            String fw = (fwObj == null || "null".equals(String.valueOf(fwObj))) ? "—" : fwObj.toString();
            sb.append(String.format("| %s | %s | %s | %s | %s |%n",
                mod.get("name"), mod.get("purpose"), mod.get("language"), fw, mod.get("sourceFileCount")));
        }
        Utils.atomicWrite(outputDir.resolve("project-structure.md"), sb.toString());
    }

    @SuppressWarnings("unchecked")
    public static void generateModuleAnalysis(Map<String, Object> moduleData, Path outputDir) {
        Path modulesDir = outputDir.resolve("modules");
        try { Files.createDirectories(modulesDir); } catch (Exception ignored) {}

        String timestamp = Instant.now().toString();
        var sb = new StringBuilder();
        sb.append("# Module Analysis — ").append(moduleData.get("name")).append("\n\n");
        sb.append("**Last Updated:** ").append(timestamp).append("\n");
        sb.append("**Language:** ").append(moduleData.get("language")).append("\n\n");
        sb.append("## Key Classes\n\n");
        sb.append("| Class | Responsibility |\n");
        sb.append("|-------|---------------|\n");

        List<String> classes = (List<String>) moduleData.getOrDefault("classes", List.of());
        for (String cls : classes.subList(0, Math.min(classes.size(), 30))) {
            sb.append("| ").append(cls).append(" | ").append(Utils.inferResponsibility(cls)).append(" |\n");
        }

        sb.append("\n## Detected Patterns\n\n");
        var patterns = (Patterns.DetectedPatterns) moduleData.get("patterns");
        if (patterns != null) {
            sb.append("- **DI Style**: ").append(patterns.diStyle()).append("\n");
            sb.append("- **Error Handling**: ").append(patterns.errorHandling()).append("\n");
            sb.append("- **Naming**: ").append(patterns.naming()).append("\n");
            sb.append("- **Logging**: ").append(patterns.logging()).append("\n");
            sb.append("- **Testing**: ").append(patterns.testing()).append("\n");
        }

        String name = moduleData.get("name").toString();
        Utils.atomicWrite(modulesDir.resolve(name + ".md"), sb.toString());
    }
}
