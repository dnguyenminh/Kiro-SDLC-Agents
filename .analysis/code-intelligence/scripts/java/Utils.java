import java.io.*;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import java.util.regex.*;

/**
 * Shared utility functions — hashing, path helpers, file writing.
 */
public class Utils {

    public static String computeHash(Path file) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] bytes = Files.readAllBytes(file);
            byte[] hash = md.digest(bytes);
            StringBuilder sb = new StringBuilder("sha256:");
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return "sha256:error";
        }
    }

    public static String mapExtension(String fileName) {
        String lower = fileName.toLowerCase();
        if (lower.endsWith(".gradle.kts")) return "gradle";
        int dot = lower.lastIndexOf('.');
        if (dot < 0) return "unknown";
        String ext = lower.substring(dot);
        return Config.EXTENSION_MAP.getOrDefault(ext, "unknown");
    }

    public static boolean globMatch(String text, String pattern) {
        String regex = "^" + pattern.replace(".", "\\.").replace("*", "[^/]*") + "$";
        return text.matches(regex);
    }

    public static void atomicWrite(Path filePath, String content) {
        try {
            Files.createDirectories(filePath.getParent());
            Path tmp = Path.of(filePath + ".tmp");
            Files.writeString(tmp, content);
            Files.move(tmp, filePath, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            System.err.println("[Code-Index] ERROR: Write failed — " + filePath + " — " + e.getMessage());
        }
    }

    public static String inferResponsibility(String className) {
        String[][] mapping = {
            {"Controller", "HTTP request handling"}, {"Handler", "HTTP request handling"},
            {"Service", "Business logic"}, {"Repository", "Data access"},
            {"Config", "Configuration"}, {"Entity", "Domain model"},
            {"Model", "Domain model"}, {"Dto", "Data transfer object"},
            {"DTO", "Data transfer object"}, {"Exception", "Error handling"},
            {"Test", "Test class"}, {"Utils", "Utility functions"},
            {"Helper", "Utility functions"}, {"Client", "External service client"},
            {"Factory", "Object creation"},
        };
        for (String[] entry : mapping) {
            if (className.endsWith(entry[0])) return entry[1];
        }
        return "Application component";
    }

    public static String inferPackagePurpose(String pkgName) {
        String lower = pkgName.toLowerCase();
        String[][] mapping = {
            {"controller", "HTTP request handling"}, {"api", "HTTP request handling"},
            {"service", "Business logic"}, {"repository", "Data access"},
            {"model", "Domain model"}, {"domain", "Domain model"},
            {"dto", "Data transfer objects"}, {"config", "Configuration"},
            {"util", "Utility functions"}, {"security", "Security"},
            {"test", "Testing"},
        };
        for (String[] entry : mapping) {
            if (lower.contains(entry[0])) return entry[1];
        }
        return "Application logic";
    }
}
