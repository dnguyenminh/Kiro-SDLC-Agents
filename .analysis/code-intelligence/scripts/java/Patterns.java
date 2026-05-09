import java.util.*;
import java.util.stream.*;

/**
 * Pattern detection — identifies DI style, error handling, naming conventions.
 */
public class Patterns {

    public record DetectedPatterns(String diStyle, String errorHandling, String naming, String logging, String testing) {}

    public static DetectedPatterns detect(List<String> classes, List<String> functions, List<String> imports) {
        String impText = String.join(" ", imports);
        String classText = String.join(" ", classes);
        return new DetectedPatterns(
            detectDi(impText, functions),
            detectErrorHandling(impText, classText),
            detectNaming(classes),
            detectLogging(impText),
            detectTesting(impText)
        );
    }

    public static String inferModulePurpose(String name, List<String> classes) {
        String all = (name + " " + String.join(" ", classes)).toLowerCase();
        String[][] purposes = {
            {"api", "API layer"}, {"controller", "API layer"},
            {"service", "Business logic"}, {"repository", "Data access"},
            {"config", "Configuration"}, {"shared", "Shared utilities"},
            {"common", "Shared utilities"}, {"model", "Domain model"},
            {"domain", "Domain model"}, {"test", "Testing"},
        };
        for (String[] p : purposes) {
            if (all.contains(p[0])) return p[1];
        }
        return "Application module";
    }

    private static String detectDi(String impText, List<String> functions) {
        if (impText.contains("@Inject") || impText.contains("@Autowired")) return "field injection";
        if (functions.contains("constructor") || functions.contains("__init__")) return "constructor injection";
        return "none";
    }

    private static String detectErrorHandling(String impText, String classText) {
        String all = impText + " " + classText;
        if (all.contains("Result") || all.contains("Either")) return "Result type";
        if (all.contains("ExceptionHandler") || all.contains("ControllerAdvice")) return "exception handler";
        if (all.contains("Exception")) return "try-catch";
        return "unknown";
    }

    private static String detectNaming(List<String> classes) {
        String[] suffixes = {"Controller", "Service", "Repository"};
        List<String> found = new ArrayList<>();
        for (String s : suffixes) {
            if (classes.stream().anyMatch(c -> c.endsWith(s))) found.add("*" + s);
        }
        return found.isEmpty() ? "unknown" : String.join(", ", found);
    }

    private static String detectLogging(String impText) {
        if (impText.contains("slf4j") || impText.contains("SLF4J")) return "SLF4J";
        if (impText.contains("log4j")) return "Log4j";
        if (impText.contains("logging")) return "logging";
        return "unknown";
    }

    private static String detectTesting(String impText) {
        if (impText.contains("junit") || impText.contains("org.junit")) return "JUnit";
        if (impText.contains("pytest") || impText.contains("unittest")) return "pytest";
        if (impText.contains("kotest")) return "kotest";
        if (impText.contains("jest")) return "Jest";
        return "unknown";
    }
}
