"""KSA-161: Language-specific counters."""
from __future__ import annotations
from ..base_counter import BaseNodeCounter


class TypeScriptCounter(BaseNodeCounter):
    language = "typescript"
    branch_node_types = {"if_statement", "switch_case", "ternary_expression", "conditional_expression"}
    loop_node_types = {"for_statement", "for_in_statement", "while_statement", "do_statement"}
    logical_operators = {"&&", "||", "??"}
    exception_node_types = {"catch_clause"}


class PythonCounter(BaseNodeCounter):
    language = "python"
    branch_node_types = {"if_statement", "elif_clause", "conditional_expression"}
    loop_node_types = {"for_statement", "while_statement"}
    logical_operators = {"and", "or"}
    exception_node_types = {"except_clause"}


class JavaCounter(BaseNodeCounter):
    language = "java"
    branch_node_types = {"if_statement", "switch_expression", "ternary_expression"}
    loop_node_types = {"for_statement", "enhanced_for_statement", "while_statement", "do_statement"}
    logical_operators = {"&&", "||"}
    exception_node_types = {"catch_clause"}


class KotlinCounter(BaseNodeCounter):
    language = "kotlin"
    branch_node_types = {"if_expression", "when_entry", "elvis_expression"}
    loop_node_types = {"for_statement", "while_statement", "do_while_statement"}
    logical_operators = {"&&", "||"}
    exception_node_types = {"catch_block"}

    def _get_return_node_types(self) -> set[str]:
        return {"jump_expression"}


class GoCounter(BaseNodeCounter):
    language = "go"
    branch_node_types = {"if_statement", "expression_case", "type_case"}
    loop_node_types = {"for_statement"}
    logical_operators = {"&&", "||"}
    exception_node_types = {"defer_statement"}
