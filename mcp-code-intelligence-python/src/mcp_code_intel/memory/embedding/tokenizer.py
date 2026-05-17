"""Simple WordPiece tokenizer for all-MiniLM-L6-v2 model."""

import sys
from pathlib import Path

import numpy as np


class Tokenizer:
    """WordPiece tokenizer — port of Kotlin Tokenizer.kt."""

    def __init__(self, vocab_path: Path) -> None:
        if not vocab_path.exists():
            raise FileNotFoundError(f"Vocab file not found: {vocab_path}")
        self._vocab = self._load_vocab(vocab_path)
        self._cls_id = self._vocab.get("[CLS]", 101)
        self._sep_id = self._vocab.get("[SEP]", 102)
        self._unk_id = self._vocab.get("[UNK]", 100)
        self._pad_id = self._vocab.get("[PAD]", 0)
        _log(f"Tokenizer loaded: {len(self._vocab)} tokens")

    def encode(self, text: str, max_length: int = 128) -> dict[str, np.ndarray]:
        """Tokenize text into input_ids, attention_mask, token_type_ids."""
        tokens = self._tokenize(text)
        truncated = tokens[: max_length - 2]
        ids = [self._cls_id]
        ids.extend(self._vocab.get(t, self._unk_id) for t in truncated)
        ids.append(self._sep_id)
        mask = [1] * len(ids)
        type_ids = [0] * len(ids)
        # Pad to max_length
        pad_count = max_length - len(ids)
        ids.extend([self._pad_id] * pad_count)
        mask.extend([0] * pad_count)
        type_ids.extend([0] * pad_count)
        return {
            "input_ids": np.array(ids, dtype=np.int64),
            "attention_mask": np.array(mask, dtype=np.int64),
            "token_type_ids": np.array(type_ids, dtype=np.int64),
        }

    def _tokenize(self, text: str) -> list[str]:
        """Split text into WordPiece tokens."""
        words = text.lower().split()
        tokens: list[str] = []
        for word in words:
            tokens.extend(self._wordpiece_tokenize(word))
        return tokens

    def _wordpiece_tokenize(self, word: str) -> list[str]:
        """Greedy longest-match WordPiece for a single word."""
        pieces: list[str] = []
        start = 0
        while start < len(word):
            end = len(word)
            found: str | None = None
            while start < end:
                sub = word[start:end] if start == 0 else f"##{word[start:end]}"
                if sub in self._vocab:
                    found = sub
                    break
                end -= 1
            if found is None:
                pieces.append("[UNK]")
                break
            pieces.append(found)
            start = end
        return pieces

    @staticmethod
    def _load_vocab(path: Path) -> dict[str, int]:
        """Load vocab.txt — line index = token id."""
        vocab: dict[str, int] = {}
        with open(path, encoding="utf-8") as f:
            for idx, line in enumerate(f):
                vocab[line.strip()] = idx
        return vocab


def _log(msg: str) -> None:
    print(f"[tokenizer] {msg}", file=sys.stderr, flush=True)
