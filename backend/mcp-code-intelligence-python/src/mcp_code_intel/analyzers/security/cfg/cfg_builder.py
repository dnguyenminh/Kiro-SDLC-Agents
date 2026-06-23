"""
KSA-164: CFG Builder — Constructs control flow graphs from AST function nodes.
Handles if/else, loops, try/catch, switch, and early returns.
"""

from __future__ import annotations
from typing import Any, Optional
from .basic_block import BasicBlock
from .control_flow_graph import ControlFlowGraph


class CFGBuilder:
    def __init__(self) -> None:
        self._block_counter = 0
        self._cfg: Optional[ControlFlowGraph] = None

    def build(self, function_node: Any, language: str) -> ControlFlowGraph:
        """Build CFG from a function AST node."""
        self._block_counter = 0

        entry = self._new_block("entry")
        self._cfg = ControlFlowGraph(entry)

        exit_block = self._new_block("exit")
        self._cfg.add_block(exit_block)

        body = self._get_function_body(function_node, language)
        if not body:
            self._cfg.add_edge(entry, exit_block, "sequential")
            return self._cfg

        last_block = self._process_statements(body, entry, exit_block)
        if last_block and last_block is not exit_block:
            self._cfg.add_edge(last_block, exit_block, "sequential")

        return self._cfg

    def _get_function_body(self, node: Any, language: str) -> Optional[Any]:
        body = node.child_by_field_name("body")
        if body:
            return body
        for child in node.named_children:
            if child.type in ("statement_block", "block"):
                return child
        return None

    def _process_statements(self, block_node: Any, current_block: BasicBlock, exit_block: BasicBlock) -> Optional[BasicBlock]:
        active: Optional[BasicBlock] = current_block
        for child in block_node.named_children:
            if not active:
                break
            active = self._process_statement(child, active, exit_block)
        return active

    def _process_statement(self, stmt: Any, current_block: BasicBlock, exit_block: BasicBlock) -> Optional[BasicBlock]:
        stype = stmt.type
        if stype == "if_statement":
            return self._handle_if(stmt, current_block, exit_block)
        elif stype in ("while_statement", "do_statement"):
            return self._handle_while(stmt, current_block, exit_block)
        elif stype in ("for_statement", "for_in_statement"):
            return self._handle_for(stmt, current_block, exit_block)
        elif stype == "try_statement":
            return self._handle_try_catch(stmt, current_block, exit_block)
        elif stype == "switch_statement":
            return self._handle_switch(stmt, current_block, exit_block)
        elif stype == "return_statement":
            current_block.add_statement(stmt)
            self._cfg.add_edge(current_block, exit_block, "return")
            return None
        elif stype == "throw_statement":
            current_block.add_statement(stmt)
            self._cfg.add_edge(current_block, exit_block, "exception")
            return None
        elif stype in ("break_statement", "continue_statement"):
            current_block.add_statement(stmt)
            return None
        else:
            current_block.add_statement(stmt)
            return current_block

    def _handle_if(self, node: Any, current_block: BasicBlock, exit_block: BasicBlock) -> Optional[BasicBlock]:
        cond_node = node.child_by_field_name("condition")
        if cond_node:
            current_block.add_statement(cond_node)

        merge_block = self._new_block("normal")
        self._cfg.add_block(merge_block)

        consequence = node.child_by_field_name("consequence")
        then_block = self._new_block("normal")
        self._cfg.add_block(then_block)
        self._cfg.add_edge(current_block, then_block, "branch-true")

        then_end: Optional[BasicBlock] = then_block
        if consequence:
            then_end = self._process_block_or_statement(consequence, then_block, exit_block)
        if then_end:
            self._cfg.add_edge(then_end, merge_block, "sequential")

        alternative = node.child_by_field_name("alternative")
        if alternative:
            else_block = self._new_block("normal")
            self._cfg.add_block(else_block)
            self._cfg.add_edge(current_block, else_block, "branch-false")

            else_body = alternative.named_children[0] if alternative.type == "else_clause" and alternative.named_child_count > 0 else alternative
            else_end: Optional[BasicBlock] = else_block
            if else_body:
                if else_body.type == "if_statement":
                    else_end = self._handle_if(else_body, else_block, exit_block)
                else:
                    else_end = self._process_block_or_statement(else_body, else_block, exit_block)
            if else_end:
                self._cfg.add_edge(else_end, merge_block, "sequential")
        else:
            self._cfg.add_edge(current_block, merge_block, "branch-false")

        return merge_block

    def _handle_while(self, node: Any, current_block: BasicBlock, exit_block: BasicBlock) -> Optional[BasicBlock]:
        header_block = self._new_block("loop-header")
        self._cfg.add_block(header_block)
        self._cfg.add_edge(current_block, header_block, "sequential")

        cond_node = node.child_by_field_name("condition")
        if cond_node:
            header_block.add_statement(cond_node)

        post_loop = self._new_block("normal")
        self._cfg.add_block(post_loop)

        body = node.child_by_field_name("body")
        body_block = self._new_block("normal")
        self._cfg.add_block(body_block)
        self._cfg.add_edge(header_block, body_block, "branch-true")
        self._cfg.add_edge(header_block, post_loop, "loop-exit")

        body_end: Optional[BasicBlock] = body_block
        if body:
            body_end = self._process_block_or_statement(body, body_block, exit_block)
        if body_end:
            self._cfg.add_edge(body_end, header_block, "loop-back")

        return post_loop

    def _handle_for(self, node: Any, current_block: BasicBlock, exit_block: BasicBlock) -> Optional[BasicBlock]:
        init = node.child_by_field_name("initializer")
        if init:
            current_block.add_statement(init)

        header_block = self._new_block("loop-header")
        self._cfg.add_block(header_block)
        self._cfg.add_edge(current_block, header_block, "sequential")

        cond_node = node.child_by_field_name("condition")
        if cond_node:
            header_block.add_statement(cond_node)

        post_loop = self._new_block("normal")
        self._cfg.add_block(post_loop)

        body = node.child_by_field_name("body")
        body_block = self._new_block("normal")
        self._cfg.add_block(body_block)
        self._cfg.add_edge(header_block, body_block, "branch-true")
        self._cfg.add_edge(header_block, post_loop, "loop-exit")

        body_end: Optional[BasicBlock] = body_block
        if body:
            body_end = self._process_block_or_statement(body, body_block, exit_block)

        increment = node.child_by_field_name("increment")
        if increment and body_end:
            body_end.add_statement(increment)
        if body_end:
            self._cfg.add_edge(body_end, header_block, "loop-back")

        return post_loop

    def _handle_try_catch(self, node: Any, current_block: BasicBlock, exit_block: BasicBlock) -> Optional[BasicBlock]:
        merge_block = self._new_block("normal")
        self._cfg.add_block(merge_block)

        try_body = node.child_by_field_name("body")
        try_block = self._new_block("normal")
        self._cfg.add_block(try_block)
        self._cfg.add_edge(current_block, try_block, "sequential")

        try_end: Optional[BasicBlock] = try_block
        if try_body:
            try_end = self._process_block_or_statement(try_body, try_block, exit_block)
        if try_end:
            self._cfg.add_edge(try_end, merge_block, "sequential")

        handler = node.child_by_field_name("handler")
        if handler:
            catch_block = self._new_block("catch")
            self._cfg.add_block(catch_block)
            self._cfg.add_edge(try_block, catch_block, "exception")

            catch_body = handler.child_by_field_name("body")
            catch_end: Optional[BasicBlock] = catch_block
            if catch_body:
                catch_end = self._process_block_or_statement(catch_body, catch_block, exit_block)
            if catch_end:
                self._cfg.add_edge(catch_end, merge_block, "sequential")

        finalizer = node.child_by_field_name("finalizer")
        if finalizer:
            finally_block = self._new_block("normal")
            self._cfg.add_block(finally_block)
            self._cfg.add_edge(merge_block, finally_block, "sequential")
            finally_body = finalizer.named_children[0] if finalizer.named_child_count > 0 else None
            if finally_body:
                self._process_block_or_statement(finally_body, finally_block, exit_block)
            return finally_block

        return merge_block

    def _handle_switch(self, node: Any, current_block: BasicBlock, exit_block: BasicBlock) -> Optional[BasicBlock]:
        value = node.child_by_field_name("value")
        if value:
            current_block.add_statement(value)

        merge_block = self._new_block("normal")
        self._cfg.add_block(merge_block)

        body = node.child_by_field_name("body")
        if not body:
            return merge_block

        for case_node in body.named_children:
            case_block = self._new_block("normal")
            self._cfg.add_block(case_block)
            self._cfg.add_edge(current_block, case_block, "branch-true")

            case_end: Optional[BasicBlock] = case_block
            for child in case_node.named_children:
                if not case_end:
                    break
                if child.type in ("switch_case", "switch_default"):
                    continue
                case_end = self._process_statement(child, case_end, exit_block)
            if case_end:
                self._cfg.add_edge(case_end, merge_block, "sequential")

        return merge_block

    def _process_block_or_statement(self, node: Any, current_block: BasicBlock, exit_block: BasicBlock) -> Optional[BasicBlock]:
        if node.type in ("statement_block", "block"):
            return self._process_statements(node, current_block, exit_block)
        return self._process_statement(node, current_block, exit_block)

    def _new_block(self, block_type: str) -> BasicBlock:
        block = BasicBlock(self._block_counter, block_type)
        self._block_counter += 1
        return block
