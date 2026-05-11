"""Cosine similarity utilities.

Scope: pure-math correctness for the helpers in app/utils/similarity.py.
No network, no Redis, no FastAPI here.
"""

from __future__ import annotations

import numpy as np
import pytest

from app.utils.similarity import (
    clip_score,
    cosine_similarity_matrix,
    normalize,
    top_k_indices,
)


class TestNormalize:
    def test_unit_norm_rows(self):
        m = np.array([[3.0, 4.0], [0.0, 1.0]], dtype=np.float32)
        out = normalize(m)
        assert np.allclose(np.linalg.norm(out, axis=1), [1.0, 1.0])

    def test_zero_row_stays_zero(self):
        m = np.array([[0.0, 0.0], [1.0, 0.0]], dtype=np.float32)
        out = normalize(m)
        assert np.allclose(out[0], 0.0)

    def test_empty_matrix(self):
        m = np.empty((0, 5), dtype=np.float32)
        assert normalize(m).shape == (0, 5)


class TestCosineSimilarity:
    def test_identity_pair_is_one(self):
        v = normalize(np.array([[1.0, 2.0, 3.0]], dtype=np.float32))
        sim = cosine_similarity_matrix(v, v)
        assert np.isclose(sim[0, 0], 1.0, atol=1e-6)

    def test_orthogonal_is_zero(self):
        a = normalize(np.array([[1.0, 0.0]], dtype=np.float32))
        b = normalize(np.array([[0.0, 1.0]], dtype=np.float32))
        assert np.isclose(cosine_similarity_matrix(a, b)[0, 0], 0.0, atol=1e-6)

    def test_negative_pair(self):
        a = normalize(np.array([[1.0, 0.0]], dtype=np.float32))
        b = normalize(np.array([[-1.0, 0.0]], dtype=np.float32))
        assert np.isclose(cosine_similarity_matrix(a, b)[0, 0], -1.0, atol=1e-6)

    def test_empty_inputs_return_empty(self):
        a = np.zeros((0, 3), dtype=np.float32)
        b = np.zeros((4, 3), dtype=np.float32)
        assert cosine_similarity_matrix(a, b).shape == (0, 4)


class TestTopK:
    def test_returns_descending_order(self):
        scores = np.array([0.1, 0.9, 0.5, 0.7], dtype=np.float32)
        result = top_k_indices(scores, k=3)
        idx_order = [i for i, _ in result]
        score_order = [s for _, s in result]
        assert idx_order == [1, 3, 2]
        assert score_order == sorted(score_order, reverse=True)

    def test_excludes_specified_indices(self):
        scores = np.array([0.9, 0.8, 0.7], dtype=np.float32)
        result = top_k_indices(scores, k=2, exclude=[0])
        assert [i for i, _ in result] == [1, 2]

    def test_k_larger_than_n(self):
        scores = np.array([0.5, 0.4], dtype=np.float32)
        result = top_k_indices(scores, k=10)
        assert len(result) == 2

    def test_k_zero_returns_empty(self):
        scores = np.array([0.5, 0.4], dtype=np.float32)
        assert top_k_indices(scores, k=0) == []

    def test_empty_scores_returns_empty(self):
        scores = np.empty((0,), dtype=np.float32)
        assert top_k_indices(scores, k=5) == []


class TestClipScore:
    @pytest.mark.parametrize(
        "input_,expected",
        [
            (1.5, 1.0),
            (-0.2, 0.0),
            (0.5, 0.5),
            (float("nan"), 0.0),
        ],
    )
    def test_clip(self, input_, expected):
        assert clip_score(input_) == expected
