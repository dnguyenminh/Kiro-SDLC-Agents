"""KSA-169: Embedding module — Body extraction and chunking."""
from .body_extractor import BodyExtractor, FunctionBody
from .chunker import Chunker, Chunk

__all__ = ["BodyExtractor", "FunctionBody", "Chunker", "Chunk"]
