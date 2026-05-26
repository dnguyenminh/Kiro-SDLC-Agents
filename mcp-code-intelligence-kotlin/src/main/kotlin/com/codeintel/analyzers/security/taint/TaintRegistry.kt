/**
 * KSA-164: Taint Registry — Configuration of taint sources, sinks, and sanitizers.
 */
package com.codeintel.analyzers.security.taint

import com.codeintel.analyzers.security.TaintSinkType
import com.codeintel.analyzers.security.TaintSourceType

data class SourcePattern(
    val type: TaintSourceType,
    val patterns: List<String>,
    val language: String? = null
)

data class SinkPattern(
    val type: TaintSinkType,
    val functions: List<String>,
    val paramIndex: Int,
    val language: String? = null
)

data class SanitizerPattern(
    val function: String,
    val sanitizes: List<TaintSinkType>,
    val language: String? = null
)

class TaintRegistry {
    val sources: MutableList<SourcePattern> = mutableListOf()
    val sinks: MutableList<SinkPattern> = mutableListOf()
    val sanitizers: MutableList<SanitizerPattern> = mutableListOf()

    init { loadDefaults() }

    fun matchSource(expression: String, language: String? = null): SourcePattern? {
        for (source in sources) {
            if (source.language != null && language != null && source.language != language) continue
            for (pattern in source.patterns) {
                if (pattern in expression) return source
            }
        }
        return null
    }

    fun matchSink(functionName: String, language: String? = null): SinkPattern? {
        for (sink in sinks) {
            if (sink.language != null && language != null && sink.language != language) continue
            for (fn in sink.functions) {
                if (fn in functionName) return sink
            }
        }
        return null
    }

    fun isSanitizer(functionName: String, sinkType: TaintSinkType, language: String? = null): Boolean {
        for (san in sanitizers) {
            if (san.language != null && language != null && san.language != language) continue
            if (san.function in functionName && sinkType in san.sanitizes) return true
        }
        return false
    }

    private fun loadDefaults() {
        sources.addAll(listOf(
            SourcePattern(TaintSourceType.HTTP_PARAM, listOf("req.query", "req.params", "request.args", "request.GET", "request.POST", "ctx.query", "ctx.params")),
            SourcePattern(TaintSourceType.HTTP_BODY, listOf("req.body", "request.json", "request.form", "request.data", "ctx.request.body")),
            SourcePattern(TaintSourceType.HTTP_HEADER, listOf("req.headers", "req.get(", "request.headers", "ctx.headers")),
            SourcePattern(TaintSourceType.HTTP_COOKIE, listOf("req.cookies", "request.cookies", "ctx.cookies")),
            SourcePattern(TaintSourceType.URL_PARAM, listOf("req.url", "req.originalUrl", "request.url", "window.location")),
            SourcePattern(TaintSourceType.FILE_READ, listOf("fs.readFile", "readFileSync", "open(", "fread")),
            SourcePattern(TaintSourceType.ENV_VAR, listOf("process.env", "os.environ", "getenv")),
            SourcePattern(TaintSourceType.USER_INPUT, listOf("prompt(", "readline", "input(", "stdin")),
            SourcePattern(TaintSourceType.CLI_ARG, listOf("process.argv", "sys.argv", "args[")),
            SourcePattern(TaintSourceType.DB_RESULT, listOf(".query(", ".findOne(", ".find(", ".execute(")),
            SourcePattern(TaintSourceType.WEBSOCKET, listOf("ws.on(", "socket.on(", "message.data")),
        ))

        sinks.addAll(listOf(
            SinkPattern(TaintSinkType.SQL_QUERY, listOf("query(", "execute(", "raw(", "sequelize.query", "knex.raw", "db.run(", "cursor.execute"), 0),
            SinkPattern(TaintSinkType.SHELL_EXEC, listOf("exec(", "execSync(", "spawn(", "system(", "popen(", "subprocess.run", "child_process"), 0),
            SinkPattern(TaintSinkType.FILE_WRITE, listOf("writeFile(", "writeFileSync(", "createWriteStream(", "fwrite"), 1),
            SinkPattern(TaintSinkType.FILE_PATH, listOf("readFile(", "readFileSync(", "open(", "path.join(", "path.resolve("), 0),
            SinkPattern(TaintSinkType.HTML_OUTPUT, listOf("innerHTML", "outerHTML", "document.write(", "res.send(", "render(", "dangerouslySetInnerHTML"), 0),
            SinkPattern(TaintSinkType.EVAL, listOf("eval(", "Function(", "setTimeout(", "setInterval(", "vm.runInContext"), 0),
            SinkPattern(TaintSinkType.DESERIALIZE, listOf("unserialize(", "pickle.loads(", "yaml.load(", "JSON.parse("), 0),
            SinkPattern(TaintSinkType.LDAP_QUERY, listOf("ldap.search(", "ldap.bind(", "ldapjs.search"), 0),
            SinkPattern(TaintSinkType.XML_PARSE, listOf("parseXML(", "DOMParser", "xml2js.parse", "libxml.parse", "etree.fromstring"), 0),
            SinkPattern(TaintSinkType.URL_FETCH, listOf("fetch(", "axios(", "axios.get(", "axios.post(", "http.get(", "request(", "urllib.request", "requests.get"), 0),
            SinkPattern(TaintSinkType.REDIRECT, listOf("res.redirect(", "response.redirect(", "window.location", "location.href"), 0),
            SinkPattern(TaintSinkType.LOG_OUTPUT, listOf("console.log(", "logger.info(", "logger.error(", "logging.info"), 0),
        ))

        sanitizers.addAll(listOf(
            SanitizerPattern("escape", listOf(TaintSinkType.HTML_OUTPUT, TaintSinkType.SQL_QUERY)),
            SanitizerPattern("sanitize", listOf(TaintSinkType.HTML_OUTPUT, TaintSinkType.SQL_QUERY, TaintSinkType.SHELL_EXEC)),
            SanitizerPattern("encodeURI", listOf(TaintSinkType.URL_FETCH, TaintSinkType.REDIRECT)),
            SanitizerPattern("encodeURIComponent", listOf(TaintSinkType.URL_FETCH, TaintSinkType.REDIRECT, TaintSinkType.HTML_OUTPUT)),
            SanitizerPattern("parseInt", listOf(TaintSinkType.SQL_QUERY, TaintSinkType.SHELL_EXEC, TaintSinkType.FILE_PATH)),
            SanitizerPattern("Number(", listOf(TaintSinkType.SQL_QUERY, TaintSinkType.SHELL_EXEC)),
            SanitizerPattern("validator.", listOf(TaintSinkType.SQL_QUERY, TaintSinkType.HTML_OUTPUT, TaintSinkType.SHELL_EXEC)),
            SanitizerPattern("DOMPurify", listOf(TaintSinkType.HTML_OUTPUT)),
            SanitizerPattern("xss(", listOf(TaintSinkType.HTML_OUTPUT)),
            SanitizerPattern("sqlstring.escape", listOf(TaintSinkType.SQL_QUERY)),
            SanitizerPattern("parameterize", listOf(TaintSinkType.SQL_QUERY)),
            SanitizerPattern("shellescape", listOf(TaintSinkType.SHELL_EXEC)),
            SanitizerPattern("path.basename", listOf(TaintSinkType.FILE_PATH)),
            SanitizerPattern("path.normalize", listOf(TaintSinkType.FILE_PATH)),
            SanitizerPattern("new URL(", listOf(TaintSinkType.URL_FETCH, TaintSinkType.REDIRECT)),
        ))
    }
}
