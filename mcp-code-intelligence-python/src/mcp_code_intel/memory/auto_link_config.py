"""AutoLinkConfig — configurable thresholds for auto-linking strategies (KSA-190)."""

from dataclasses import dataclass, field


@dataclass
class SemanticConfig:
    """Configuration for semantic (vector cosine) linking."""
    enabled: bool = True
    min_score: float = 0.75
    max_edges: int = 5


@dataclass
class EntityConfig:
    """Configuration for entity Jaccard linking."""
    enabled: bool = True
    min_jaccard: float = 0.3
    max_edges: int = 5


@dataclass
class TagConfig:
    """Configuration for tag overlap linking."""
    enabled: bool = True
    min_overlap: int = 2
    max_edges: int = 3


@dataclass
class FtsConfig:
    """Configuration for FTS fallback linking."""
    enabled: bool = True
    max_edges: int = 3
    fallback_threshold: int = 2


@dataclass
class AutoLinkConfig:
    """Master configuration for all auto-linking strategies."""
    enabled: bool = True
    semantic: SemanticConfig = field(default_factory=SemanticConfig)
    entity: EntityConfig = field(default_factory=EntityConfig)
    tag: TagConfig = field(default_factory=TagConfig)
    fts: FtsConfig = field(default_factory=FtsConfig)
    total_max_edges: int = 10
