"""KSA-165: Command Injection Matcher."""
from ..pattern_matcher import PatternMatcher
from ...types import InjectionPattern


class CommandInjectionMatcher(PatternMatcher):
    @property
    def category(self) -> str:
        return "command_injection"

    @property
    def patterns(self) -> list[InjectionPattern]:
        return [
            InjectionPattern(id=9, name="Shell Command with String Concatenation", category="command_injection", cwe="CWE-78", severity="Critical",
                sink_patterns=["exec(", "execSync(", "system(", "popen(", "subprocess.run", "child_process.exec"],
                dangerous_ops=["concat", "template_literal", "format_string"],
                safe_patterns=["execFile", "spawn", "shell=False", "shellescape"],
                description="Use execFile/spawn with array arguments instead of exec with shell string."),
            InjectionPattern(id=10, name="Shell=True with User Input", category="command_injection", cwe="CWE-78", severity="Critical",
                sink_patterns=["subprocess.run", "subprocess.Popen", "subprocess.call"],
                dangerous_ops=["concat", "template_literal", "pass_through"],
                safe_patterns=["shell=False", "shlex.quote", "shellescape"],
                description="Use shell=False and pass command as list."),
            InjectionPattern(id=11, name="eval() with User Input", category="command_injection", cwe="CWE-95", severity="Critical",
                sink_patterns=["eval(", "Function(", "vm.runInContext", "vm.runInNewContext"],
                dangerous_ops=["concat", "template_literal", "pass_through", "assign"],
                safe_patterns=["JSON.parse", "parseInt", "sandbox"],
                description="Never use eval() with user input."),
            InjectionPattern(id=12, name="Dynamic Require/Import with User Input", category="command_injection", cwe="CWE-94", severity="High",
                sink_patterns=["require(", "import(", "__import__"],
                dangerous_ops=["concat", "template_literal", "pass_through"],
                safe_patterns=["whitelist", "allowedModules", "includes("],
                description="Validate module names against a whitelist."),
        ]
