"""Generate refactoring suggestions for duplicate clusters."""

from __future__ import annotations

from dataclasses import dataclass
from .cluster_builder import Cluster


@dataclass
class RefactoringSuggestion:
    """A suggestion to refactor duplicates."""
    cluster_id: str
    suggestion_type: str  # "extract_function", "extract_base_class", "use_template"
    description: str
    members: list[str]
    estimated_lines_saved: int


class SuggestionGenerator:
    """Generate actionable refactoring suggestions from duplicate clusters."""

    def generate(self, clusters: list[Cluster], symbol_info: dict[str, dict]) -> list[RefactoringSuggestion]:
        """Generate suggestions for each cluster."""
        suggestions: list[RefactoringSuggestion] = []
        for cluster in clusters:
            suggestion = self._suggest_for_cluster(cluster, symbol_info)
            if suggestion:
                suggestions.append(suggestion)
        return suggestions

    def _suggest_for_cluster(
        self, cluster: Cluster, symbol_info: dict[str, dict]
    ) -> RefactoringSuggestion | None:
        """Determine best refactoring strategy for a cluster."""
        members = cluster.members
        if len(members) < 2:
            return None

        # Gather info about members
        infos = [symbol_info.get(m, {}) for m in members]
        same_file = len(set(i.get("file", "") for i in infos)) == 1
        kinds = set(i.get("kind", "function") for i in infos)
        avg_lines = self._avg_lines(infos)

        # Determine suggestion type
        if "method" in kinds and not same_file:
            suggestion_type = "extract_base_class"
            desc = (
                f"Extract common logic from {len(members)} similar methods into a shared base class or mixin."
            )
        elif same_file:
            suggestion_type = "extract_function"
            desc = (
                f"Extract {len(members)} near-duplicate functions in the same file into a single parameterized function."
            )
        else:
            suggestion_type = "extract_function"
            desc = (
                f"Extract common logic from {len(members)} similar functions into a shared utility function."
            )

        lines_saved = max(0, (len(members) - 1) * avg_lines)

        return RefactoringSuggestion(
            cluster_id=cluster.representative,
            suggestion_type=suggestion_type,
            description=desc,
            members=members,
            estimated_lines_saved=lines_saved,
        )

    @staticmethod
    def _avg_lines(infos: list[dict]) -> int:
        """Average line count across members."""
        line_counts = []
        for info in infos:
            start = info.get("start_line", 0)
            end = info.get("end_line", 0)
            if end > start:
                line_counts.append(end - start)
        return int(sum(line_counts) / len(line_counts)) if line_counts else 10
