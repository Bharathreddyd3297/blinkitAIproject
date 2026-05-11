import { api } from '@services/api';
import { mapRecommendation } from '@services/mappers';
import type { Recommendation } from '@app-types/domain';
import {
  mockForYouRecommendations,
  mockSimilarRecommendations,
  mockTrendingRecommendations,
  withMockFallback,
} from '@utils/mock';

/**
 * Talks to the gateway's `/api/recommendations` surface (ai-recommendation-service).
 *
 * Backend is FastAPI and returns the platform-wide `ApiResponse<List<RecommendationItem>>`
 * envelope. Items are flat product summaries with score + reason fields; the
 * mapper rebuilds them into the frontend `Recommendation { product, score, reason }`
 * shape so the UI tile component is unchanged.
 *
 * Endpoint map:
 *   - GET /api/recommendations/trending?limit=N
 *   - GET /api/recommendations/related/{productId}?limit=N
 *   - GET /api/recommendations/user/{userId}?limit=N
 *
 * `forUser()` requires the authenticated user's id; we pull it from the stored
 * AuthSession via the frontend storage util so the call site stays simple.
 */

import { storage } from '@utils/storage';
import { config } from '@app/config';
import type { AuthSession } from '@app-types/domain';

const currentUserId = (): string | null => {
  const session = storage.get<AuthSession>(config.auth.storageKey);
  return session?.user?.id ?? null;
};

const mapList = (raw: unknown): Recommendation[] =>
  Array.isArray(raw)
    ? raw.map((r) => mapRecommendation(r as Parameters<typeof mapRecommendation>[0]))
    : [];

export const recommendationService = {
  forUser: (limit = 12) =>
    withMockFallback(
      async () => {
        const userId = currentUserId();
        if (!userId) {
          // No JWT yet — give the homepage a recommendations strip from trending.
          const list = await api.get<unknown[]>('/recommendations/trending', { params: { limit } });
          return mapList(list);
        }
        const list = await api.get<unknown[]>(`/recommendations/user/${userId}`, { params: { limit } });
        return mapList(list);
      },
      () => mockForYouRecommendations.slice(0, limit),
    ),

  similar: (productId: string, limit = 8) =>
    withMockFallback(
      async () => {
        const list = await api.get<unknown[]>(`/recommendations/related/${productId}`, { params: { limit } });
        return mapList(list);
      },
      () => mockSimilarRecommendations(productId).slice(0, limit),
    ),

  trending: (limit = 12) =>
    withMockFallback(
      async () => {
        const list = await api.get<unknown[]>('/recommendations/trending', { params: { limit } });
        return mapList(list);
      },
      () => mockTrendingRecommendations.slice(0, limit),
    ),
};
