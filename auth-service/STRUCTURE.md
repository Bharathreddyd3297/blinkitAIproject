# Project Structure Documentation

## Complete Directory Layout

```
auth-service/
│
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/blinkit/authservice/
│   │   │       ├── AuthServiceApplication.java        [Main Spring Boot Application]
│   │   │       │
│   │   │       ├── controller/
│   │   │       │   └── AuthController.java            [REST API Endpoints]
│   │   │       │
│   │   │       ├── service/
│   │   │       │   └── AuthService.java               [Business Logic Layer]
│   │   │       │
│   │   │       ├── repository/
│   │   │       │   └── UserRepository.java            [Data Access Layer - JPA Repository]
│   │   │       │
│   │   │       ├── entity/
│   │   │       │   ├── User.java                      [JPA Entity - Database Model]
│   │   │       │   └── Role.java                      [Enum - User Roles]
│   │   │       │
│   │   │       ├── dto/
│   │   │       │   ├── SignUpRequest.java             [Signup Request DTO]
│   │   │       │   ├── LoginRequest.java              [Login Request DTO]
│   │   │       │   ├── LoginResponse.java             [Login Response DTO with JWT]
│   │   │       │   ├── SignUpResponse.java            [Signup Response DTO]
│   │   │       │   └── UserResponse.java              [User Info Response DTO]
│   │   │       │
│   │   │       ├── security/
│   │   │       │   ├── JwtTokenProvider.java          [JWT Token Generation & Validation]
│   │   │       │   ├── CustomUserDetailsService.java  [Spring Security UserDetailsService]
│   │   │       │   └── JwtAuthenticationFilter.java   [JWT Authentication Filter]
│   │   │       │
│   │   │       ├── config/
│   │   │       │   └── SecurityConfig.java            [Spring Security Configuration]
│   │   │       │
│   │   │       └── exception/
│   │   │           ├── GlobalExceptionHandler.java    [Centralized Exception Handler]
│   │   │           ├── ErrorResponse.java             [Error Response DTO]
│   │   │           ├── AuthenticationException.java   [Custom Auth Exception]
│   │   │           ├── ResourceNotFoundException.java [Custom 404 Exception]
│   │   │           └── ResourceAlreadyExistsException.java [Custom 409 Exception]
│   │   │
│   │   └── resources/
│   │       ├── application.yml                        [Main Configuration]
│   │       ├── application-dev.yml                    [Development Profile]
│   │       └── db/
│   │           └── migration/
│   │               └── V1__Initial_Schema.sql         [Flyway Database Migration]
│   │
│   └── test/
│       └── java/
│           └── com/blinkit/authservice/
│               └── service/
│                   └── AuthServiceTest.java           [Unit Tests for AuthService]
│
├── pom.xml                                            [Maven Build Configuration]
├── Dockerfile                                         [Docker Image Build]
├── docker-compose.yml                                 [Docker Compose Multi-Container Setup]
├── .gitignore                                         [Git Ignore Rules]
├── .env.example                                       [Environment Variables Template]
│
├── README.md                                          [Project Overview & Quick Start]
├── DEPLOYMENT.md                                      [Production Deployment Guide]
├── API_REQUESTS.md                                    [API Documentation & Examples]
└── STRUCTURE.md                                       [This File - Directory Layout]
```

## Layer-by-Layer Breakdown

### 1. Controller Layer (`controller/`)
**Purpose:** Handle HTTP requests and route to services
- `AuthController.java`
  - `POST /api/auth/signup` - User registration
  - `POST /api/auth/login` - User login
  - `GET /api/auth/me` - Get current user
  - `GET /api/auth/user/{userId}` - Get user by ID

### 2. Service Layer (`service/`)
**Purpose:** Business logic implementation
- `AuthService.java`
  - `signup()` - Register new user with validation
  - `login()` - Authenticate and generate JWT
  - `getUserById()` - Retrieve user information

### 3. Repository Layer (`repository/`)
**Purpose:** Database access abstraction
- `UserRepository.java` (JPA Repository)
  - `findByEmail()` - Query user by email
  - `existsByEmail()` - Check email existence
  - Extends `JpaRepository<User, Long>`

### 4. Entity Layer (`entity/`)
**Purpose:** Database model representation
- `User.java` - JPA Entity (maps to 'users' table)
  - Fields: id, name, email, password, role, isActive, createdAt, updatedAt
  - Annotations: @Entity, @Table, @Column, @Enumerated
  - Lifecycle hooks: @PrePersist, @PreUpdate

- `Role.java` - Enum for roles (USER, ADMIN, MANAGER)

### 5. DTO Layer (`dto/`)
**Purpose:** API request/response data transfer objects
- `SignUpRequest.java` - Signup input validation
- `LoginRequest.java` - Login input validation
- `LoginResponse.java` - JWT token and user info response
- `SignUpResponse.java` - Signup success response
- `UserResponse.java` - User info response

### 6. Security Layer (`security/`)
**Purpose:** JWT and authentication implementation
- `JwtTokenProvider.java`
  - `generateToken()` - Create JWT tokens
  - `validateToken()` - Verify JWT validity
  - `getEmailFromJWT()` - Extract email from token
  - `getRoleFromJWT()` - Extract role from token

- `CustomUserDetailsService.java`
  - Implements Spring's UserDetailsService
  - Loads user from database for authentication

- `JwtAuthenticationFilter.java`
  - Extends OncePerRequestFilter
  - Validates JWT and sets SecurityContext

### 7. Configuration Layer (`config/`)
**Purpose:** Spring application configuration
- `SecurityConfig.java`
  - Spring Security setup
  - JWT filter configuration
  - Password encoder (BCrypt)
  - CORS and CSRF policies
  - Authorization rules

### 8. Exception Handling (`exception/`)
**Purpose:** Centralized error handling
- `GlobalExceptionHandler.java` (@RestControllerAdvice)
  - Catches all exceptions
  - Returns consistent error format
  - Logs errors appropriately

- Custom Exception Classes:
  - `AuthenticationException` (401)
  - `ResourceNotFoundException` (404)
  - `ResourceAlreadyExistsException` (409)

- `ErrorResponse.java` - Standard error format

## Configuration Files

### `pom.xml`
Maven project configuration with dependencies:
- Spring Boot 3.2.3
- Spring Security
- Spring Data JPA
- PostgreSQL Driver
- JJWT for JWT
- Lombok for annotations
- Flyway for migrations

### `application.yml`
Production/default configuration:
- PostgreSQL connection
- JPA/Hibernate settings
- Flyway migrations
- JWT configuration
- Actuator endpoints
- Logging levels

### `application-dev.yml`
Development profile configuration:
- Local PostgreSQL setup
- Enhanced logging
- DDL auto creation
- Flyway disabled

### Database Migration
`db/migration/V1__Initial_Schema.sql`
- Creates users table
- Adds indexes on email and is_active
- Defines primary key and unique constraints

## Docker Configuration

### `Dockerfile`
Multi-stage build:
- Build stage: Maven compilation
- Runtime stage: JRE with Alpine Linux
- Health checks configured
- Non-root user for security

### `docker-compose.yml`
Multi-container orchestration:
- PostgreSQL service
- Auth Service application
- Volume management
- Health checks
- Environment variables

## Testing

### `src/test/java/...`
Unit and integration tests:
- AuthServiceTest.java - Service layer tests
- Mock UserRepository and dependencies
- Test signup success/failure
- Test login success/failure

## Development Workflow

```
User Request
    ↓
@RestController (AuthController)
    ↓
@Service (AuthService) - Business Logic
    ↓
@Repository (UserRepository) - Data Access
    ↓
JPA Entity (User) → Database (PostgreSQL)

Reverse: Response flows back through layers
```

## Security Flow

```
HTTP Request with JWT
    ↓
JwtAuthenticationFilter
    ↓
JwtTokenProvider.validateToken()
    ↓
Extract claims & email
    ↓
CustomUserDetailsService.loadUserByUsername()
    ↓
Load authorities
    ↓
SecurityContext set
    ↓
@RestController processes request with authentication
```

## Key Patterns Used

### 1. DTO Pattern
- Separates API contracts from entities
- Validates input/output
- Prevents data exposure

### 2. Layered Architecture
- Separation of concerns
- Independent testing
- Maintainability

### 3. Exception Handling
- Global exception handler
- Consistent error format
- Proper HTTP status codes

### 4. Dependency Injection
- Spring manages dependencies
- Loose coupling
- Easy to mock in tests

### 5. Configuration Externalization
- Environment-specific configs
- Secrets management
- Easy deployment

## Dependencies Overview

| Dependency | Purpose | Version |
|-----------|---------|---------|
| Spring Boot Web | REST API | 3.2.3 |
| Spring Data JPA | Database ORM | 3.2.3 |
| Spring Security | Authentication | 3.2.3 |
| PostgreSQL Driver | Database connectivity | 42.7.3 |
| JJWT | JWT handling | 0.12.3 |
| Lombok | Boilerplate reduction | Latest |
| Flyway | DB migrations | Latest |
| Jakarta Validation | Input validation | Latest |

## Configuration Properties Reference

```yaml
# Database
spring.datasource.url: PostgreSQL JDBC URL
spring.datasource.username: DB user
spring.datasource.password: DB password

# JWT
auth.jwt.secret: Signing key (32+ chars)
auth.jwt.expiration: Token lifetime (ms)

# Server
server.port: Application port
server.servlet.context-path: Base path

# JPA
spring.jpa.hibernate.ddl-auto: Schema generation
spring.jpa.show-sql: SQL logging

# Actuator
management.endpoints.web.exposure.include: Metrics endpoints
```

## File Naming Conventions

- **Entities:** `User.java` (domain model)
- **DTOs:** `UserRequest.java`, `UserResponse.java`
- **Services:** `UserService.java` (@Service)
- **Repositories:** `UserRepository.java` extends JpaRepository
- **Controllers:** `UserController.java` (@RestController)
- **Config:** `SecurityConfig.java` (@Configuration)
- **Exceptions:** `UserNotFoundException.java` extends Exception
- **Tests:** `UserServiceTest.java` in `src/test/java`

## Best Practices Implemented

✅ DTO pattern for API contracts
✅ Layered architecture with clear separation
✅ Exception handling with custom exceptions
✅ Input validation with Jakarta
✅ Password encryption with BCrypt
✅ JWT for stateless authentication
✅ Role-based access control
✅ Database migrations with Flyway
✅ Comprehensive logging
✅ Health check endpoints
✅ Docker & Docker Compose support
✅ Environment-based configuration
✅ Unit testing with Mockito
✅ Lombok for reducing boilerplate
✅ PostgreSQL for reliability

---

**Version:** 1.0.0
**Last Updated:** 2024-05-07
