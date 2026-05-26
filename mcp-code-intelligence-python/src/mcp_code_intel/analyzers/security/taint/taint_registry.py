"""
KSA-164: Taint Registry — Configuration of taint sources, sinks, and sanitizers.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SourcePattern:
    type: str  # TaintSourceType
    patterns: list[str]
    language: Optional[str] = None


@dataclass
class SinkPattern:
    type: str  # TaintSinkType
    functions: list[str]
    param_index: int
    language: Optional[str] = None


@dataclass
class SanitizerPattern:
    function: str
    sanitizes: list[str]  # list of TaintSinkType
    language: Optional[str] = None


class TaintRegistry:
    def __init__(self) -> None:
        self.sources: list[SourcePattern] = []
        self.sinks: list[SinkPattern] = []
        self.sanitizers: list[SanitizerPattern] = []
        self._load_defaults()

    def match_source(self, expression: str, language: Optional[str] = None) -> Optional[dict]:
        """Check if an expression matches a taint source pattern."""
        for source in self.sources:
            if source.language and language and source.language != language:
                continue
            for pattern in source.patterns:
                if pattern in expression:
                    return {"type": source.type}
        return None

    def match_sink(self, function_name: str, language: Optional[str] = None) -> Optional[SinkPattern]:
        """Check if a function call matches a taint sink."""
        for sink in self.sinks:
            if sink.language and language and sink.language != language:
                continue
            for fn in sink.functions:
                if fn in function_name:
                    return sink
        return None

    def is_sanitizer(self, function_name: str, sink_type: str, language: Optional[str] = None) -> bool:
        """Check if a function is a sanitizer for a given sink type."""
        for san in self.sanitizers:
            if san.language and language and san.language != language:
                continue
            if san.function in function_name and sink_type in san.sanitizes:
                return True
        return False

    def add_source(self, source: SourcePattern) -> None:
        self.sources.append(source)

    def add_sink(self, sink: SinkPattern) -> None:
        self.sinks.append(sink)

    def add_sanitizer(self, sanitizer: SanitizerPattern) -> None:
        self.sanitizers.append(sanitizer)

    def _load_defaults(self) -> None:
        self.sources = [
            SourcePattern(type="http_param", patterns=["req.query", "req.params", "request.args", "request.GET", "request.POST", "ctx.query", "ctx.params"]),
            SourcePattern(type="http_body", patterns=["req.body", "request.json", "request.form", "request.data", "ctx.request.body"]),
            SourcePattern(type="http_header", patterns=["req.headers", "req.get(", "request.headers", "ctx.headers"]),
            SourcePattern(type="http_cookie", patterns=["req.cookies", "request.cookies", "ctx.cookies"]),
            SourcePattern(type="url_param", patterns=["req.url", "req.originalUrl", "request.url", "window.location"]),
            SourcePattern(type="file_read", patterns=["fs.readFile", "readFileSync", "open(", "fread"]),
            SourcePattern(type="env_var", patterns=["process.env", "os.environ", "getenv"]),
            SourcePattern(type="user_input", patterns=["prompt(", "readline", "input(", "stdin"]),
            SourcePattern(type="cli_arg", patterns=["process.argv", "sys.argv", "args["]),
            SourcePattern(type="db_result", patterns=[".query(", ".findOne(", ".find(", ".execute("]),
            SourcePattern(type="websocket", patterns=["ws.on(", "socket.on(", "message.data"]),
        ]

        self.sinks = [
            SinkPattern(type="sql_query", functions=["query(", "execute(", "raw(", "sequelize.query", "knex.raw", "db.run(", "cursor.execute"], param_index=0),
            SinkPattern(type="shell_exec", functions=["exec(", "execSync(", "spawn(", "system(", "popen(", "subprocess.run", "child_process"], param_index=0),
            SinkPattern(type="file_write", functions=["writeFile(", "writeFileSync(", "createWriteStream(", "fwrite"], param_index=1),
            SinkPattern(type="file_path", functions=["readFile(", "readFileSync(", "open(", "path.join(", "path.resolve("], param_index=0),
            SinkPattern(type="html_output", functions=["innerHTML", "outerHTML", "document.write(", "res.send(", "render(", "dangerouslySetInnerHTML"], param_index=0),
            SinkPattern(type="eval", functions=["eval(", "Function(", "setTimeout(", "setInterval(", "vm.runInContext"], param_index=0),
            SinkPattern(type="deserialize", functions=["unserialize(", "pickle.loads(", "yaml.load(", "JSON.parse("], param_index=0),
            SinkPattern(type="ldap_query", functions=["ldap.search(", "ldap.bind(", "ldapjs.search"], param_index=0),
            SinkPattern(type="xml_parse", functions=["parseXML(", "DOMParser", "xml2js.parse", "libxml.parse", "etree.fromstring"], param_index=0),
            SinkPattern(type="url_fetch", functions=["fetch(", "axios(", "axios.get(", "axios.post(", "http.get(", "request(", "urllib.request", "requests.get"], param_index=0),
            SinkPattern(type="redirect", functions=["res.redirect(", "response.redirect(", "window.location", "location.href"], param_index=0),
            SinkPattern(type="log_output", functions=["console.log(", "logger.info(", "logger.error(", "logging.info"], param_index=0),
        ]

        self.sanitizers = [
            SanitizerPattern(function="escape", sanitizes=["html_output", "sql_query"]),
            SanitizerPattern(function="sanitize", sanitizes=["html_output", "sql_query", "shell_exec"]),
            SanitizerPattern(function="encodeURI", sanitizes=["url_fetch", "redirect"]),
            SanitizerPattern(function="encodeURIComponent", sanitizes=["url_fetch", "redirect", "html_output"]),
            SanitizerPattern(function="parseInt", sanitizes=["sql_query", "shell_exec", "file_path"]),
            SanitizerPattern(function="Number(", sanitizes=["sql_query", "shell_exec"]),
            SanitizerPattern(function="validator.", sanitizes=["sql_query", "html_output", "shell_exec"]),
            SanitizerPattern(function="DOMPurify", sanitizes=["html_output"]),
            SanitizerPattern(function="xss(", sanitizes=["html_output"]),
            SanitizerPattern(function="sqlstring.escape", sanitizes=["sql_query"]),
            SanitizerPattern(function="parameterize", sanitizes=["sql_query"]),
            SanitizerPattern(function="shellescape", sanitizes=["shell_exec"]),
            SanitizerPattern(function="path.basename", sanitizes=["file_path"]),
            SanitizerPattern(function="path.normalize", sanitizes=["file_path"]),
            SanitizerPattern(function="new URL(", sanitizes=["url_fetch", "redirect"]),
        ]
