"""Read Python system test files for the repository checks.

Prints a JSON list with the same shape as `TestFile` in tools/checks/lib/tests.ts: scenarios with their
given/when/then steps, imports, skip markers and environment variables. Uses only the standard library.
"""

from __future__ import annotations

import ast
import json
import sys
from typing import Any

STEP_KEYWORDS = {"given": "Given", "when": "When", "then": "Then"}
SKIP_ATTRIBUTES = {"skip", "skipif", "xfail"}
SOURCES = {"sut", "fakes"}


def dotted(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return f"{dotted(node.value)}.{node.attr}"
    if isinstance(node, ast.Call):
        return dotted(node.func)
    return ""


def string_arg(call: ast.Call) -> str | None:
    if call.args and isinstance(call.args[0], ast.Constant) and isinstance(call.args[0].value, str):
        return call.args[0].value
    return None


def names_in(node: ast.AST) -> set[str]:
    return {child.id for child in ast.walk(node) if isinstance(child, ast.Name)}


def target_names(node: ast.AST) -> set[str]:
    return names_in(node)


def taint(function: ast.AST) -> set[str]:
    tainted = set(SOURCES)
    changed = True
    while changed:
        changed = False
        for node in ast.walk(function):
            pairs: list[tuple[ast.AST, ast.AST]] = []
            if isinstance(node, ast.Assign):
                pairs = [(target, node.value) for target in node.targets]
            elif isinstance(node, (ast.AnnAssign, ast.AugAssign, ast.NamedExpr)) and node.value is not None:
                pairs = [(node.target, node.value)]
            elif isinstance(node, (ast.With, ast.AsyncWith)):
                pairs = [(item.optional_vars, item.context_expr) for item in node.items if item.optional_vars]
            for target, value in pairs:
                if names_in(value) & tainted:
                    new = target_names(target) - tainted
                    if new:
                        tainted |= new
                        changed = True
    return tainted


def read_scenario(function: ast.FunctionDef | ast.AsyncFunctionDef, decorator: ast.Call) -> dict[str, Any]:
    tainted = taint(function)
    steps: list[dict[str, Any]] = []
    withs = [node for node in ast.walk(function) if isinstance(node, (ast.With, ast.AsyncWith))]
    for node in sorted(withs, key=lambda item: (item.lineno, item.col_offset)):
        for item in node.items:
            call = item.context_expr
            if not isinstance(call, ast.Call) or not isinstance(call.func, ast.Name):
                continue
            keyword = STEP_KEYWORDS.get(call.func.id)
            if keyword is None:
                continue
            asserts = [
                child for statement in node.body for child in ast.walk(statement) if isinstance(child, ast.Assert)
            ]
            steps.append(
                {
                    "keyword": keyword,
                    "label": string_arg(call),
                    "line": node.lineno,
                    "assertions": len(asserts),
                    "assertsOnSut": any(names_in(assertion.test) & tainted for assertion in asserts),
                }
            )
    return {"id": string_arg(decorator), "line": decorator.lineno, "steps": steps}


def scan(path: str) -> dict[str, Any]:
    with open(path, encoding="utf-8") as handle:
        tree = ast.parse(handle.read(), filename=path)
    result: dict[str, Any] = {"file": path, "isTest": True, "scenarios": [], "imports": [], "skips": [], "env": []}
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            result["imports"] += [{"name": alias.name, "line": node.lineno} for alias in node.names]
        elif isinstance(node, ast.ImportFrom):
            result["imports"].append({"name": "." * node.level + (node.module or ""), "line": node.lineno})
        elif isinstance(node, ast.Attribute) and node.attr in SKIP_ATTRIBUTES:
            if dotted(node).split(".")[0] in {"pytest", "unittest"}:
                result["skips"].append({"name": dotted(node), "line": node.lineno})
        elif isinstance(node, ast.Call):
            name = dotted(node.func)
            label = string_arg(node)
            if name.endswith(".setenv") and label:
                result["env"].append({"name": label, "line": node.lineno})
            for keyword in node.keywords:
                if keyword.arg == "env" and isinstance(keyword.value, ast.Dict):
                    for key in keyword.value.keys:
                        if isinstance(key, ast.Constant) and isinstance(key.value, str):
                            result["env"].append({"name": key.value, "line": key.lineno})
        elif isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Subscript) and dotted(target.value) == "os.environ":
                    key = target.slice
                    if isinstance(key, ast.Constant) and isinstance(key.value, str):
                        result["env"].append({"name": key.value, "line": node.lineno})
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for decorator in node.decorator_list:
                if isinstance(decorator, ast.Call) and dotted(decorator.func).split(".")[-1] == "scenario":
                    result["scenarios"].append(read_scenario(node, decorator))
    return result


if __name__ == "__main__":
    json.dump([scan(path) for path in sys.argv[1:]], sys.stdout)
