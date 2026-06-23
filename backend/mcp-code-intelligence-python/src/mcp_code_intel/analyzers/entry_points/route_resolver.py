"""KSA-162: Route Resolver."""
from __future__ import annotations
import re


class RouteResolver:
    def resolve(self, controller_prefix: str | None, method_path: str) -> str:
        prefix = self._normalize(controller_prefix or "")
        path = self._normalize(method_path)
        if not prefix:
            return path or "/"
        if not path or path == "/":
            return prefix
        return f"{prefix}{path}"

    def normalize_params(self, path: str) -> str:
        # Flask-style first (more specific): <type:param> → {param}
        path = re.sub(r"<(?:[a-z]+:)?([a-zA-Z_]\w*)>", r"{\1}", path)
        # Express-style: :param → {param} (but not inside {})
        path = re.sub(r":([a-zA-Z_]\w*)", r"{\1}", path)
        return path

    def extract_path_from_arg(self, arg: str) -> str:
        path = arg.strip().strip("\"'`")
        return self.normalize_params(path)

    def _normalize(self, path: str) -> str:
        if not path:
            return ""
        if not path.startswith("/"):
            path = "/" + path
        if len(path) > 1 and path.endswith("/"):
            path = path[:-1]
        return path
