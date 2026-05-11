# product-service

Product catalog and inventory microservice for the Blinkit clone, built with Spring Boot 3.2 / Java 21 / PostgreSQL.

## Overview

| Concern        | Choice                                      |
|----------------|---------------------------------------------|
| Framework      | Spring Boot 3.2.3                           |
| Language       | Java 21                                     |
| Persistence    | Spring Data JPA + Hibernate + PostgreSQL 16 |
| Migrations     | Flyway                                      |
| Auth           | Stateless JWT (HS512), shared secret with `auth-service` |
| Port           | `8082`                                      |
| DB name        | `blinkit_products`                          |

## Authentication model

`product-service` does **not** call `auth-service` per-request. Tokens are
validated locally using the same HS512 secret (`JWT_SECRET`) that `auth-service`
signs with. The `role` claim drives Spring Security authorization.

| HTTP method | Path                       | Required role |
|-------------|----------------------------|---------------|
| `GET`       | `/api/products/**`         | authenticated |
| `POST`      | `/api/products`            | `ADMIN`       |
| `PUT`       | `/api/products/{id}`       | `ADMIN`       |
| `PATCH`     | `/api/products/{id}/inventory` | `ADMIN`   |
| `DELETE`    | `/api/products/{id}`       | `ADMIN`       |
| `GET`       | `/actuator/health`, `/`    | public        |

## Package layout

```
com.blinkit.productservice
├── ProductServiceApplication
├── config        # SecurityConfig
├── controller    # ProductController, HomeController
├── dto           # request/response/page/api wrappers
├── entity        # Product
├── exception     # ErrorResponse + GlobalExceptionHandler + typed exceptions
├── repository    # ProductRepository (JPA)
├── security      # JwtTokenProvider, JwtAuthenticationFilter, EntryPoint
└── service       # ProductService (+ impl), ProductMapper
```

## Run locally

```bash
# 1. Start PostgreSQL + service
docker-compose up --build

# 2. (Or) start just Postgres and run the JAR
docker run --rm -p 5432:5432 \
  -e POSTGRES_DB=blinkit_products \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  postgres:16-alpine

mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

Health check: `curl http://localhost:8082/actuator/health`

## Sample requests

See [API_REQUESTS.md](./API_REQUESTS.md).

## Configuration

Override via env vars (see `.env.example`):

| Variable                     | Default                                |
|------------------------------|----------------------------------------|
| `SERVER_PORT`                | `8082`                                 |
| `SPRING_DATASOURCE_URL`      | `jdbc:postgresql://localhost:5432/blinkit_products` |
| `SPRING_DATASOURCE_USERNAME` | `postgres`                             |
| `SPRING_DATASOURCE_PASSWORD` | `postgres`                             |
| `JWT_SECRET`                 | dev value — **must** match `auth-service` |

> The default secret in `application.yml` is for development only.
> In production set `JWT_SECRET` via secrets management (>= 64 bytes for HS512).
