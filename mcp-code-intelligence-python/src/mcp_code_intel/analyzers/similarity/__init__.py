"""Similarity analysis — duplicate detection, dead code, clustering."""

from .duplicate_detector import DuplicateDetector, DuplicateReport, SimilarityPair
from .cluster_builder import ClusterBuilder
from .suggestion_generator import SuggestionGenerator
from .dead_code_detector import DeadCodeDetector, DeadCodeReport
from .reachability import ReachabilityAnalyzer
from .confidence_scorer import ConfidenceScorer

__all__ = [
    "DuplicateDetector",
    "DuplicateReport",
    "SimilarityPair",
    "ClusterBuilder",
    "SuggestionGenerator",
    "DeadCodeDetector",
    "DeadCodeReport",
    "ReachabilityAnalyzer",
    "ConfidenceScorer",
]
