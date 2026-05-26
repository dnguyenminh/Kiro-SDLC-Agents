"""Git history mining — semantic search over commit history."""

from .git_miner import GitMiner, IndexingSummary
from .git_log_parser import GitLogParser, Commit
from .commit_embedder import CommitEmbedder
from .git_vector_index import GitVectorIndex
from .semantic_searcher import SemanticSearcher, CommitResult

__all__ = [
    "GitMiner",
    "IndexingSummary",
    "GitLogParser",
    "Commit",
    "CommitEmbedder",
    "GitVectorIndex",
    "SemanticSearcher",
    "CommitResult",
]
