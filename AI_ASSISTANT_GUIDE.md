# AI Assistant Guide — Blinkit Workspace

> **Read this first.** If you are an AI assistant (Claude Code, Copilot, Cursor, anything else) and you have just been opened in this workspace, this file plus [PLATFORM_CONTEXT.md](PLATFORM_CONTEXT.md) and [SERVICE_SUMMARIES.md](SERVICE_SUMMARIES.md) contain everything you need to work productively without scanning the entire repo.

---

## 0. Mental model in one paragraph

Five Spring Boot 3 microservices (`auth-service`, `product-service`, `cart-service`, `order-service`, `payment-service`) sharing one HS512 JWT secret, one envelope shape (`ApiResponse<T>`), one Postgres-per-service pattern, and one set of conventions. They talk over HTTP via `WebClient`, forwarding the inbound `Authorization: Bearer …` header on every cross-service hop. Auth-service signs; everyone else verifies. There is no service account.

If a task changes any of: the JWT model, the envelope shape, or the cross-service auth-forwarding pattern — **stop and ask**. Everything else, you can usually ship in one service.

---

## 1. How to scope a change to one service

Before opening a folder, ask yourself: *which service owns this concern?*

- "Where does product data come from?" → product-service.
- "Why is `userId` null in cart?" → JWT issuance (auth-service) or claim extraction (cart-service `JwtTokenProvider`/`SecurityUtils`).
- "Why is checkout slow?" → order-service orchestration; check the WebClient timeouts and the cart→product fan-out.
- "Why is payment idempotency broken?" → payment-service `/process`.

If your answer touches more than one service, **first** make the change inside the owning service and verify it; only then patch consumers.

The single biggest source of churn we've seen is making "while I'm here" changes in adjacent services. Resist it.

---

## 2. How to avoid unnecessary refactoring

This codebase has been deliberately kept boring. **Do not** introduce:

- A new HTTP client (no OpenFeign, no RestTemplate, no native HTTP client). Use `WebClient`.
- A new auth library (no Spring Authorization Server, no Keycloak, no Auth0). Use the existing `JwtTokenProvider`.
- A new cache layer beyond the one described in [REDIS_INTEGRATION_PLAN.md](REDIS_INTEGRATION_PLAN.md).
- A message broker (no Kafka, no RabbitMQ) unless the work item is *explicitly* "introduce an event bus".
- A new ORM (no jOOQ, no MyBatis). Use Spring Data JPA + Flyway.
- A new test framework (no Spock, no Cucumber). Use JUnit 5 + Mockito.

If you are *certain* a new framework is needed, raise it as a discussion item rather than adding it as a side-effect of another change.

---

## 3. Architecture invariants

These are non-negotiable. If a task seems to require breaking one, you've misunderstood the task.

1. **One HS512 JWT secret across all services**, sourced from `JWT_SECRET` env var.
2. **Token claims:** `sub=email, userId, email, role, iat, exp`. `userId` is required.
3. **Authorization-header propagation** on every WebClient call via `RequestContextHolder`.
4. **Database-per-service.** No service reads another service's tables.
5. **HTTP is the only inter-service contract.** Not Redis, not Postgres, not shared DTO jars.
6. **`ApiResponse<T>` is the only public response shape.**
7. **Schema changes via Flyway only**, `ddl-auto=validate`.

---

## 4. Security model (do not change)

```
client ──Bearer──► any service
                    │
                    ▼
                JwtAuthenticationFilter (verifies HS512 with shared secret)
                    │
                    ▼
                SecurityContext = AuthenticatedUser{userId, email, role}
                    │
                    ▼
                Controller reads userId via SecurityUtils.getCurrentUserId()
```

- ADMIN-only endpoints use `@PreAuthorize("hasRole('ADMIN')")`.
- Owner checks (e.g. an order belongs to the calling user) are done in the service layer, *not* the controller.
- BCrypt for passwords. `password` is never returned in any response DTO.
- All endpoints are bearer-protected by default in `SecurityConfig`. Public exceptions: `/api/auth/signup`, `/api/auth/login`, `/actuator/health*`, `/v3/api-docs/**`, `/swagger-ui/**` where applicable.

---

## 5. Response patterns (API + errors)

Every response — success and failure — uses `ApiResponse<T>`:

```json
{ "success": true,  "message": "...", "data": <T>,    "timestamp": "ISO-8601" }
{ "success": false, "message": "...", "error": "CODE", "status": 4xx, "path": "...", "timestamp": "..." }
```

- Stable error codes (uppercase, snake-style): `UNAUTHORIZED`, `ACCESS_DENIED`, `INVALID_TOKEN`, `VALIDATION_ERROR`, `BAD_REQUEST`, `EMPTY_CART`, `INSUFFICIENT_STOCK`, `PRODUCT_NOT_FOUND`, `ORDER_NOT_FOUND`, `CART_SERVICE_ERROR`, `PRODUCT_SERVICE_ERROR`, `INTERNAL_SERVER_ERROR`.
- Validation errors (400) include field-level details from Spring's `MethodArgumentNotValidException`.
- HTTP status is set explicitly in `GlobalExceptionHandler`. Don't set it in controllers.

**Cross-service consumer rule:** when calling another service from a `WebClient`, deserialize as `ApiResponse<DTO>` using `ParameterizedTypeReference`, then `.getData()`. Doing `.bodyToMono(DTO.class)` will compile, run, and silently produce a DTO with all-null fields because of the envelope wrap.

---

## 6. DTO conventions

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)   // on response DTOs
public class FooResponse { ... }

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FooRequest {
    @NotBlank private String name;            // validation on requests only
    @Min(1)   private Integer quantity;
}
```

- One package per direction: `dto.request`, `dto.response`. (Some older services have a flat `dto`. New code follows the split.)
- `BigDecimal` for money, `Integer`/`Long` for counts and IDs, `LocalDateTime` for timestamps.
- Never expose entity classes directly. Map to a DTO.

---

## 7. Exception handling conventions

- One typed domain exception per failure mode (`ProductNotFoundException`, `EmptyCartException`, …) extending a service-local base.
- Single `GlobalExceptionHandler` per service maps domain → HTTP status + `ApiResponse` error.
- Catch-all (`Exception.class`) returns 500 + `INTERNAL_SERVER_ERROR` + a generic message. **Do not** leak stack traces or framework internals in user-facing messages.
- Logging level rules:
  - `WARN` for expected user-driven failures (validation, not-found).
  - `ERROR` for infrastructure / unexpected.
  - Always log the request path and userId where available.

---

## 8. WebClient patterns

Every cross-service client follows the same shape:

```java
@Component
public class FooServiceClient {

    private final WebClient fooServiceWebClient;

    public FooResponse getFooById(Long id) {
        try {
            ApiResponse<FooResponse> envelope = fooServiceWebClient.get()
                .uri("/api/foos/{id}", id)
                .accept(MediaType.APPLICATION_JSON)
                .headers(this::applyAuthorizationHeader)
                .retrieve()
                .onStatus(s -> s.value() == 404, r -> Mono.error(new FooNotFoundException(id)))
                .onStatus(HttpStatusCode::is4xxClientError, /* map to FooServiceException */)
                .onStatus(HttpStatusCode::is5xxServerError, /* map to FooServiceException */)
                .bodyToMono(new ParameterizedTypeReference<ApiResponse<FooResponse>>() {})
                .timeout(Duration.ofSeconds(5))
                .block();
            return envelope != null ? envelope.getData() : null;
        } catch (FooNotFoundException | FooServiceException ex) {
            throw ex;
        } catch (WebClientRequestException ex) {
            throw new FooServiceException("Unable to reach foo-service: " + ex.getMessage(), ex);
        } catch (Exception ex) {
            throw new FooServiceException("Unexpected error: " + ex.getMessage(), ex);
        }
    }

    private void applyAuthorizationHeader(HttpHeaders headers) {
        String h = currentAuthorizationHeader();
        if (h != null) headers.set(HttpHeaders.AUTHORIZATION, h);
    }

    private String currentAuthorizationHeader() {
        ServletRequestAttributes attrs =
            (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        return attrs != null ? attrs.getRequest().getHeader(HttpHeaders.AUTHORIZATION) : null;
    }
}
```

Conventions:

- One client class per upstream service, named `XxxServiceClient`.
- Bean name `xxxServiceWebClient` defined in `WebClientConfig` with explicit base URL + timeouts.
- 5-second timeout default; tune per call.
- Forward Authorization header. Always.
- Error handling translates HTTP into typed domain exceptions; the global handler maps those back to 4xx / 5xx + envelope.

---

## 9. Docker patterns

- Multi-stage Dockerfile: builder (`maven:3.9-eclipse-temurin-21`) → runtime (`eclipse-temurin:21-jre-alpine`).
- Non-root user inside the runtime image.
- One Compose file per service for isolated runs.
- `docker-compose.platform.yml` at the repo root for the full stack on `blinkit-net`.
- All env vars sourced from a workspace-root `.env`. `.env.example` is the template.
- Postgres host ports differ per service (5432–5436) to avoid collisions when running standalone files alongside the platform file.

---

## 10. Flyway standards

- Migrations in `src/main/resources/db/migration/V<n>__<snake_name>.sql`.
- Sequential `V` numbers per service. They are independent across services.
- `IF NOT EXISTS` on table + index DDL so migrations remain replayable in dev.
- Idempotent seeds use `INSERT ... WHERE NOT EXISTS (SELECT 1 ...)`.
- `spring.jpa.hibernate.ddl-auto=validate` — Hibernate must never be allowed to auto-create or auto-update.
- Schema name `public` everywhere.

---

## 11. Quick recipes

### "Add a new field to a DTO"

1. Update the DTO in the **owning** service.
2. Add a Flyway migration if the field is persisted.
3. Update the entity / mapper.
4. Update any consumer's local DTO copy if they read that field. Consumers using `@JsonIgnoreProperties(ignoreUnknown=true)` keep working without change if they don't *need* the new field.

### "Add a new endpoint"

1. Add it to the controller of the owning service. Thin: extract userId, call service, return `ApiResponse`.
2. Update [PLATFORM_CONTEXT.md §5](PLATFORM_CONTEXT.md) and the matching service summary in [SERVICE_SUMMARIES.md](SERVICE_SUMMARIES.md).
3. Don't add a consumer until at least one consumer actually needs it.

### "Add Redis caching to service X"

Follow [REDIS_INTEGRATION_PLAN.md](REDIS_INTEGRATION_PLAN.md). One service at a time. Cache failures must never fail the request.

### "Service Y needs to call service X"

1. Add a `WebClient` bean for X in Y's `WebClientConfig` (separate base URL + timeouts).
2. Add `XServiceClient` in `client/` following the template above.
3. Forward the Authorization header.
4. Deserialize as `ApiResponse<…>`, unwrap `.getData()`.
5. Map HTTP failures to typed exceptions in Y's `exception/` package.
6. Add an env var for the base URL (`X_SERVICE_BASE_URL`) with a localhost fallback.

### "Add a new microservice"

1. Match the layered package structure exactly.
2. Reuse the same `application.yml` shape (env-driven, HS512-fallback, actuator probes, springdoc).
3. Wire it into `docker-compose.platform.yml` with its own Postgres + a dedicated host port.
4. Add an entry to [PLATFORM_CONTEXT.md](PLATFORM_CONTEXT.md) and [SERVICE_SUMMARIES.md](SERVICE_SUMMARIES.md) **as part of the same change**.

---

## 12. What to do when the docs disagree with the code

- The code is the source of truth. Update the doc to match.
- If the code itself is wrong (bug), fix the code. The doc may already describe the desired contract.
- Ask before changing the doc to describe a *new* contract — that's a design change, not a doc change.
