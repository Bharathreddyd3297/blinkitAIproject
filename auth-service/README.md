# Auth Service - Blinkit Clone

Production-grade Spring Boot 3 authentication microservice with JWT, PostgreSQL, and role-based access control.

## 📋 Features

- ✅ User registration with email validation
- ✅ Secure login with JWT token generation
- ✅ Password encryption using BCrypt
- ✅ Role-based access control (USER, ADMIN, MANAGER)
- ✅ JWT token validation and refresh
- ✅ PostgreSQL integration with Flyway migrations
- ✅ Global exception handling
- ✅ Input validation using Jakarta Bean Validation
- ✅ Health check endpoint
- ✅ Docker & Docker Compose support
- ✅ Production-ready logging
- ✅ Layered architecture (Controller → Service → Repository)

## 🏗️ Project Structure

```
auth-service/
├── src/main/java/com/blinkit/authservice/
│   ├── controller/
│   │   └── AuthController.java
│   ├── service/
│   │   └── AuthService.java
│   ├── repository/
│   │   └── UserRepository.java
│   ├── entity/
│   │   ├── User.java
│   │   └── Role.java
│   ├── dto/
│   │   ├── SignUpRequest.java
│   │   ├── LoginRequest.java
│   │   ├── LoginResponse.java
│   │   ├── SignUpResponse.java
│   │   └── UserResponse.java
│   ├── security/
│   │   ├── JwtTokenProvider.java
│   │   ├── CustomUserDetailsService.java
│   │   └── JwtAuthenticationFilter.java
│   ├── config/
│   │   └── SecurityConfig.java
│   ├── exception/
│   │   ├── GlobalExceptionHandler.java
│   │   ├── ErrorResponse.java
│   │   ├── AuthenticationException.java
│   │   ├── ResourceNotFoundException.java
│   │   └── ResourceAlreadyExistsException.java
│   └── AuthServiceApplication.java
├── src/main/resources/
│   ├── application.yml
│   └── db/migration/
│       └── V1__Initial_Schema.sql
├── pom.xml
├── Dockerfile
├── docker-compose.yml
├── .gitignore
└── API_REQUESTS.md
```

## 🚀 Quick Start

### Prerequisites
- Java 21
- Maven 3.9+
- PostgreSQL 16+
- Docker & Docker Compose (optional)

### Local Development

1. **Clone and navigate to project:**
   ```bash
   cd auth-service
   ```

2. **Create PostgreSQL database:**
   ```bash
   createdb blinkit_auth
   ```

3. **Configure environment variables:**
   ```bash
   export JWT_SECRET="your-secret-key-minimum-32-characters-long"
   ```

4. **Build and run:**
   ```bash
   mvn clean install
   mvn spring-boot:run
   ```

   Service starts on `http://localhost:8081`

### Docker Deployment

1. **Start all services:**
   ```bash
   docker-compose up -d
   ```

2. **Check service health:**
   ```bash
   curl http://localhost:8081/actuator/health
   ```

3. **Stop services:**
   ```bash
   docker-compose down
   ```

## 📝 API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user (requires token)
- `GET /api/auth/user/{userId}` - Get user by ID (requires token)

### Health
- `GET /actuator/health` - Service health check
- `GET /actuator/metrics` - Metrics endpoint

## 🔐 Security

- JWT tokens expire in 24 hours (configurable)
- BCrypt password encryption with strength 12
- CSRF protection disabled (for stateless API)
- Role-based access control
- Input validation on all endpoints
- Exception handling with error codes

## 🗄️ Database

**Users Table:**
```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'USER',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 📦 Dependencies

- Spring Boot 3.2.3
- Spring Security
- Spring Data JPA
- PostgreSQL Driver
- JJWT 0.12.3 (JWT)
- Lombok
- Flyway (Database Migrations)
- Jakarta Bean Validation

## 🔧 Configuration

### application.yml
```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/blinkit_auth
    username: postgres
    password: postgres
  
auth:
  jwt:
    secret: your-secret-key-32-chars-minimum
    expiration: 86400000  # 24 hours in ms

server:
  port: 8081
```

### Environment Variables
```bash
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/blinkit_auth
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=postgres
JWT_SECRET=your-secret-key
JWT_EXPIRATION=86400000
```

## 🧪 Testing

### Run Tests
```bash
mvn test
```

### API Testing
Use provided `API_REQUESTS.md` for cURL examples and Postman collection

## 📊 Logging

Default log level: INFO
Auth-service log level: DEBUG

View logs:
```bash
docker-compose logs -f auth-service
```

## 🐳 Docker Build

### Build Image
```bash
docker build -t auth-service:1.0.0 .
```

### Run Container
```bash
docker run -p 8081:8081 \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5432/blinkit_auth \
  -e JWT_SECRET=your-secret-key \
  auth-service:1.0.0
```

## 📈 Monitoring

Health check endpoint with readiness and liveness probes:
```bash
curl http://localhost:8081/actuator/health
```

Metrics available at:
```bash
curl http://localhost:8081/actuator/metrics
```

## 🔐 Production Checklist

- [ ] Set strong JWT_SECRET (minimum 32 characters)
- [ ] Use encrypted passwords in PostgreSQL credentials
- [ ] Enable HTTPS/TLS
- [ ] Configure database backups
- [ ] Set up monitoring and alerting
- [ ] Enable rate limiting
- [ ] Configure CORS if needed
- [ ] Review security headers
- [ ] Set up centralized logging
- [ ] Configure database connection pooling

## 📄 Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| VALIDATION_ERROR | 400 | Request validation failed |
| INVALID_CREDENTIALS | 401 | Invalid email/password |
| USER_NOT_FOUND | 404 | User doesn't exist |
| USER_ALREADY_EXISTS | 409 | Email already registered |
| INTERNAL_SERVER_ERROR | 500 | Server error |

## 🤝 Contributing

Follow enterprise coding standards:
- Use DTO pattern for API contracts
- Implement proper exception handling
- Add validation on all inputs
- Use Lombok for boilerplate reduction
- Follow layered architecture
- Add meaningful logging

## 📝 License

Internal - Blinkit Clone Project

## 📞 Support

For issues or questions, contact the development team.

---

**Last Updated:** 2024-05-07
**Version:** 1.0.0
**Java:** 21
**Spring Boot:** 3.2.3
