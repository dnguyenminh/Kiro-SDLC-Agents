"""
KSA-164: Taint Analyzer — Main taint analysis engine.
Combines CFG, data flow, and taint propagation to find source-to-sink paths.
"""

from __future__ import annotations
from typing import Any, Optional
from ..cfg.cfg_builder import CFGBuilder
from ..dataflow.data_flow_analyzer import DataFlowAnalyzer
from .taint_registry import TaintRegistry
from .taint_propagator import TaintPropagator, TaintState, _node_text
from ..types import TaintResult, TaintPath, TaintSource, TaintSink, TaintOptions


class TaintAnalyzer:
    def __init__(self, registry: Optional[TaintRegistry] = None) -> None:
        self._cfg_builder = CFGBuilder()
        self._data_flow_analyzer = DataFlowAnalyzer()
        self._registry = registry or TaintRegistry()
        self._propagator = TaintPropagator(self._registry)

    def analyze(self, function_node: Any, language: str, options: Optional[TaintOptions] = None) -> TaintResult:
        """Perform taint analysis on a function node."""
        opts = options or TaintOptions()
        max_path_length = opts.max_path_length

        # Build CFG
        cfg = self._cfg_builder.build(function_node, language)

        # Propagate taint through CFG blocks in topological order
        block_states: dict[int, dict[str, TaintState]] = {}
        initial_state: dict[str, TaintState] = {}
        block_states[cfg.entry.id] = initial_state

        # Identify sources from function parameters
        self._identify_param_sources(function_node, language, initial_state)

        # Forward propagation through CFG
        for block in cfg.reverse_post_order():
            predecessors = cfg.get_predecessors(block)

            if not predecessors:
                merged_state = dict(block_states.get(block.id, initial_state))
            else:
                merged_state: dict[str, TaintState] = {}
                for pred in predecessors:
                    pred_state = block_states.get(pred.id, {})
                    for key, val in pred_state.items():
                        if key not in merged_state:
                            merged_state[key] = val

            out_state = self._propagator.propagate_block(block, merged_state)
            block_states[block.id] = out_state

        # Collect taint paths
        paths: list[TaintPath] = []
        sources: list[TaintSource] = []
        sinks: list[TaintSink] = []

        for block in cfg.blocks:
            state = block_states.get(block.id)
            if not state:
                continue

            for stmt in block.statements:
                sink_info = self._find_sink(stmt.node, state, language)
                if sink_info:
                    sinks.append(sink_info["sink"])
                    if sink_info.get("taint_state"):
                        ts = sink_info["taint_state"]
                        path = TaintPath(
                            source=TaintSource(
                                variable=ts.variable,
                                type=ts.source_type,
                                line=ts.source_line,
                                expression=ts.variable,
                            ),
                            sink=sink_info["sink"],
                            chain=ts.steps[:max_path_length],
                            sanitized=False,
                            length=len(ts.steps),
                        )
                        paths.append(path)

                        if not any(s.variable == path.source.variable and s.line == path.source.line for s in sources):
                            sources.append(path.source)

        # Filter by options
        filtered_paths = paths
        if opts.sink_types:
            filtered_paths = [p for p in filtered_paths if p.sink.type in opts.sink_types]
        if opts.source_types:
            filtered_paths = [p for p in filtered_paths if p.source.type in opts.source_types]
        if not opts.include_sanitized:
            filtered_paths = [p for p in filtered_paths if not p.sanitized]

        return TaintResult(paths=filtered_paths, sources=sources, sinks=sinks, sanitizers=[])

    def get_registry(self) -> TaintRegistry:
        return self._registry

    def _identify_param_sources(self, function_node: Any, language: str, state: dict[str, TaintState]) -> None:
        params = function_node.child_by_field_name("parameters")
        if not params:
            return

        http_params = {"req", "request", "ctx", "context"}

        for param in params.named_children:
            param_name: Optional[str] = None

            if param.type == "identifier":
                param_name = _node_text(param)
            elif param.type in ("required_parameter", "optional_parameter"):
                name_node = param.child_by_field_name("pattern") or param.child_by_field_name("name")
                if name_node:
                    param_name = _node_text(name_node)
            elif param.type == "formal_parameters":
                continue

            if not param_name:
                continue

            if param_name in http_params:
                state[param_name] = TaintState(
                    variable=param_name,
                    tainted=True,
                    source_type="http_param",
                    source_line=param.start_point[0] + 1,
                    steps=[],
                )

    def _find_sink(self, node: Any, state: dict[str, TaintState], language: str) -> Optional[dict]:
        if node.type in ("call_expression", "expression_statement"):
            call_node = node.named_children[0] if node.type == "expression_statement" and node.named_child_count > 0 else node
            if not call_node or call_node.type != "call_expression":
                return None

            fn = call_node.child_by_field_name("function")
            if not fn:
                return None

            sink_match = self._registry.match_sink(_node_text(fn), language)
            if not sink_match:
                return None

            sink = TaintSink(
                function=_node_text(fn),
                type=sink_match.type,
                line=call_node.start_point[0] + 1,
                expression=_node_text(call_node)[:100],
                param_index=sink_match.param_index,
            )

            args = call_node.child_by_field_name("arguments")
            if args and len(args.named_children) > sink_match.param_index:
                target_arg = args.named_children[sink_match.param_index]
                taint_info = self._propagator.evaluate_expression(target_arg, state)
                if taint_info.tainted:
                    return {
                        "sink": sink,
                        "taint_state": TaintState(
                            variable=_node_text(target_arg)[:50],
                            tainted=True,
                            source_type=taint_info.source_type,
                            source_line=taint_info.source_line,
                            steps=taint_info.steps,
                        ),
                    }

            return {"sink": sink, "taint_state": None}

        # Recurse into child expressions
        for child in node.named_children:
            result = self._find_sink(child, state, language)
            if result and result.get("taint_state"):
                return result

        return None
