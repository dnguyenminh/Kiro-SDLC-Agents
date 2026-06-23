/**
 * KSA-165: Injection Pattern Matchers — All 6 categories.
 */
package com.codeintel.analyzers.security.injection.patterns

import com.codeintel.analyzers.security.InjectionPattern
import com.codeintel.analyzers.security.Severity
import com.codeintel.analyzers.security.injection.PatternMatcher

class SQLInjectionMatcher : PatternMatcher() {
    override val category = "sql_injection"
    override val patterns = listOf(
        InjectionPattern(1, "String Concatenation in SQL Query", "sql_injection", "CWE-89", Severity.CRITICAL,
            listOf("query(", "execute(", "raw(", "knex.raw", "sequelize.query", "db.run(", "cursor.execute"),
            listOf("concat", "template_literal", "format_string"), listOf("?", "\$1", "%s", "prepare", "parameterize"),
            "Use parameterized queries instead of string concatenation."),
        InjectionPattern(2, "Template Literal in SQL Query", "sql_injection", "CWE-89", Severity.CRITICAL,
            listOf("query(", "execute(", "raw(", "knex.raw", "sequelize.query"),
            listOf("template_literal"), listOf("?", "\$1", "tagged_template", "sql`"),
            "Use tagged template literals or parameterized queries."),
        InjectionPattern(3, "Dynamic Table/Column Name in SQL", "sql_injection", "CWE-89", Severity.HIGH,
            listOf("query(", "execute(", "raw("),
            listOf("concat", "template_literal", "format_string"), listOf("whitelist", "allowedColumns", "allowedTables", "includes("),
            "Validate table/column names against a whitelist."),
        InjectionPattern(4, "ORM Raw Query with User Input", "sql_injection", "CWE-89", Severity.HIGH,
            listOf("raw(", "rawQuery(", "literal(", "\$queryRaw"),
            listOf("concat", "template_literal", "format_string", "pass_through"), listOf("bind", "replacements", "Prisma.sql"),
            "Use ORM binding parameters."),
    )
}

class XSSMatcher : PatternMatcher() {
    override val category = "xss"
    override val patterns = listOf(
        InjectionPattern(5, "innerHTML Assignment with User Input", "xss", "CWE-79", Severity.HIGH,
            listOf("innerHTML", "outerHTML", "dangerouslySetInnerHTML"),
            listOf("concat", "template_literal", "assign", "pass_through"), listOf("DOMPurify", "sanitize", "textContent", "innerText"),
            "Use textContent/innerText or sanitize with DOMPurify."),
        InjectionPattern(6, "document.write with User Input", "xss", "CWE-79", Severity.CRITICAL,
            listOf("document.write(", "document.writeln("),
            listOf("concat", "template_literal", "pass_through"), listOf("encode", "escape", "sanitize"),
            "Avoid document.write entirely."),
        InjectionPattern(7, "Reflected XSS in Server Response", "xss", "CWE-79", Severity.HIGH,
            listOf("res.send(", "res.write(", "response.write(", "render("),
            listOf("concat", "template_literal", "format_string"), listOf("escape", "encode", "sanitize", "helmet", "csp"),
            "Use template engines with auto-escaping."),
        InjectionPattern(8, "DOM-based XSS via URL Fragment", "xss", "CWE-79", Severity.HIGH,
            listOf("innerHTML", "eval(", "document.write(", "location.href"),
            listOf("pass_through", "assign"), listOf("encodeURIComponent", "sanitize", "DOMPurify"),
            "Sanitize URL fragments before DOM insertion."),
    )
}

class CommandInjectionMatcher : PatternMatcher() {
    override val category = "command_injection"
    override val patterns = listOf(
        InjectionPattern(9, "Shell Command with String Concatenation", "command_injection", "CWE-78", Severity.CRITICAL,
            listOf("exec(", "execSync(", "system(", "popen(", "subprocess.run", "child_process.exec"),
            listOf("concat", "template_literal", "format_string"), listOf("execFile", "spawn", "shell=False", "shellescape"),
            "Use execFile/spawn with array arguments."),
        InjectionPattern(10, "Shell=True with User Input", "command_injection", "CWE-78", Severity.CRITICAL,
            listOf("subprocess.run", "subprocess.Popen", "subprocess.call"),
            listOf("concat", "template_literal", "pass_through"), listOf("shell=False", "shlex.quote", "shellescape"),
            "Use shell=False and pass command as list."),
        InjectionPattern(11, "eval() with User Input", "command_injection", "CWE-95", Severity.CRITICAL,
            listOf("eval(", "Function(", "vm.runInContext", "vm.runInNewContext"),
            listOf("concat", "template_literal", "pass_through", "assign"), listOf("JSON.parse", "parseInt", "sandbox"),
            "Never use eval() with user input."),
        InjectionPattern(12, "Dynamic Require/Import with User Input", "command_injection", "CWE-94", Severity.HIGH,
            listOf("require(", "import(", "__import__"),
            listOf("concat", "template_literal", "pass_through"), listOf("whitelist", "allowedModules", "includes("),
            "Validate module names against a whitelist."),
    )
}

class PathTraversalMatcher : PatternMatcher() {
    override val category = "path_traversal"
    override val patterns = listOf(
        InjectionPattern(13, "File Read with User-Controlled Path", "path_traversal", "CWE-22", Severity.HIGH,
            listOf("readFile(", "readFileSync(", "createReadStream(", "open(", "fopen("),
            listOf("concat", "template_literal", "pass_through"), listOf("path.basename", "path.normalize", "startsWith(", "resolve("),
            "Validate path against base directory."),
        InjectionPattern(14, "File Write with User-Controlled Path", "path_traversal", "CWE-22", Severity.CRITICAL,
            listOf("writeFile(", "writeFileSync(", "createWriteStream(", "fwrite("),
            listOf("concat", "template_literal", "pass_through"), listOf("path.basename", "startsWith(", "whitelist"),
            "Restrict write paths to a safe directory."),
        InjectionPattern(15, "Directory Listing with User Input", "path_traversal", "CWE-22", Severity.MEDIUM,
            listOf("readdir(", "readdirSync(", "listdir(", "scandir("),
            listOf("concat", "template_literal", "pass_through"), listOf("path.basename", "startsWith(", "resolve("),
            "Validate directory path against allowed base directories."),
    )
}

class DeserializationMatcher : PatternMatcher() {
    override val category = "deserialization"
    override val patterns = listOf(
        InjectionPattern(16, "Unsafe YAML Load with User Input", "deserialization", "CWE-502", Severity.CRITICAL,
            listOf("yaml.load(", "yaml.unsafe_load(", "YAML.load("),
            listOf("pass_through", "assign", "function_call"), listOf("yaml.safe_load", "yaml.SafeLoader", "Loader=SafeLoader"),
            "Use yaml.safe_load() or yaml.load(data, Loader=SafeLoader)."),
        InjectionPattern(17, "Pickle/Marshal Deserialization of User Data", "deserialization", "CWE-502", Severity.CRITICAL,
            listOf("pickle.loads(", "pickle.load(", "marshal.loads(", "unserialize("),
            listOf("pass_through", "assign", "function_call"), listOf("hmac", "signature", "verify"),
            "Never deserialize untrusted data with pickle/marshal."),
        InjectionPattern(18, "XML External Entity (XXE) Processing", "deserialization", "CWE-611", Severity.HIGH,
            listOf("parseXML(", "DOMParser", "xml2js.parse", "etree.fromstring", "etree.parse"),
            listOf("pass_through", "assign", "function_call"), listOf("resolve_entities=False", "disallow_doctype", "defusedxml", "noent: false"),
            "Disable external entity resolution."),
    )
}

class LDAPXMLMatcher : PatternMatcher() {
    override val category = "ldap_xml_injection"
    override val patterns = listOf(
        InjectionPattern(19, "LDAP Injection via String Concatenation", "ldap_xml_injection", "CWE-90", Severity.HIGH,
            listOf("ldap.search(", "ldap.bind(", "ldapjs.search", "search_s("),
            listOf("concat", "template_literal", "format_string"), listOf("ldap.filter.escape", "escape_filter_chars", "ldapEscape"),
            "Escape LDAP special characters."),
        InjectionPattern(20, "XPath Injection via User Input", "ldap_xml_injection", "CWE-643", Severity.HIGH,
            listOf("xpath(", "evaluate(", "selectNodes(", "xmlDoc.find("),
            listOf("concat", "template_literal", "format_string"), listOf("parameterize", "compile(", "XPathExpression"),
            "Use parameterized XPath queries."),
    )
}
