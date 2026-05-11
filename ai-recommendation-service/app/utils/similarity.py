"""Cosine similarity helpers.

Operates on plain numpy arrays — independent of whichever embedding backend
produced them. Vectors are L2-normalised once at insert time, so similarity
reduces to a single matrix multiply (the dominant cost of related-product
lookups at scale).
"""

from __future__ import annotations

from typing import Iterable, List, Sequence, Tuple

import numpy as np


def normalize(matrix: np.ndarray) -> np.ndarray:
    """Row-wise L2 normalise. Zero rows are left as zero (no NaN)."""
    if matrix.size == 0:
        return matrix
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms = np.where(norms == 0.0, 1.0, norms)
    return matrix / norms


def cosine_similarity_matrix(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Cosine similarity for two already-L2-normalised matrices.

    Caller must pass normalised inputs — that's what the embedding service
    stores internally. Returns shape (a.shape[0], b.shape[0]).
    """
    if a.size == 0 or b.size == 0:
        return np.zeros((a.shape[0], b.shape[0]), dtype=np.float32)
    return a @ b.T


def top_k_indices(
    scores: np.ndarray,
    k: int,
    exclude: Iterable[int] = (),
) -> List[Tuple[int, float]]:
    """Return up to k (index, score) pairs in descending score order.

    Handles k larger than len(scores) and pre-filters excluded indices —
    the caller uses this to drop the source product from its own related
    list. Falls back to argpartition when k << n for O(n) selection.
    """
    if scores.size == 0 or k <= 0:
        return []

    excluded = set(exclude)
    n = scores.shape[0]
    capped_k = min(k + len(excluded), n)

    if capped_k < n:
        partition_idx = np.argpartition(-scores, capped_k - 1)[:capped_k]
        ordered = partition_idx[np.argsort(-scores[partition_idx])]
    else:
        ordered = np.argsort(-scores)

    out: List[Tuple[int, float]] = []
    for idx in ordered:
        i = int(idx)
        if i in excluded:
            continue
        out.append((i, float(scores[i])))
        if len(out) >= k:
            break
    return out


def clip_score(score: float) -> float:
    """Clamp a similarity score into [0, 1] for response payload sanity."""
    if score != score:  # NaN guard
        return 0.0
    return max(0.0, min(1.0, float(score)))


def to_float32(values: Sequence[Sequence[float]]) -> np.ndarray:
    return np.asarray(values, dtype=np.float32)
