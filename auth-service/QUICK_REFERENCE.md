# Quick Reference Guide

## Start Development Environment

### Option 1: Local PostgreSQL + Maven
```bash
# 1. Start PostgreSQL
createdb blinkit_auth

# 2. Set JWT Secret
export JWT_SECRET="dev-secret-minimum-32-chars"

# 3. Run application
mvn clean install
mvn spring-boot:run

# Service available at: http://localhost:8081
```

### Option 2: Docker Compose (Recommended)
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f auth-service

# Stop services
docker-compose down
```

## API Quick Commands

### Register User
```bash
curl -X POST http://localhost:8081/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "Password123"
  }'
```

### Login & Get Token
```bash
curl -X POST http://localhost:8081/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "Password123"
  }'

# Response includes: accessToken, tokenType: "Bearer", expiresIn
```

### Access Protected Endpoint
```bash
curl -X GET http://localhost:8081/api/auth/user/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Health Check
```bash
curl http://localhost:8081/actuator/health
```

## Common Tasks

### View Database
```bash
psql -h localhost -U postgres -d blinkit_auth

# Tables
\dt

# Users
SELECT * FROM users;
```

### Build JAR
```bash
mvn clean package -DskipTests
# Output: target/auth-service-1.0.0.jar
```

### Run Tests
```bash
mvn test
```

### View Logs
```bash
# Docker
docker-compose logs -f auth-service

# Local (if running with Maven)
# Check console output
```

### Clean & Rebuild
```bash
mvn clean
rm -rf target/
mvn install
```

### Docker Commands
```bash
# Build image
docker build -t auth-service:1.0.0 .

# Run container
docker run -p 8081:8081 -e JWT_SECRET=... auth-service:1.0.0

# View running containers
docker ps

# Stop container
docker stop <container_id>

# View logs
docker logs <container_id>
```

## Environment Setup

### Windows
```powershell
$env:JWT_SECRET = "your-secret-32-chars"
mvn spring-boot:run
```

### Linux/Mac
```bash
export JWT_SECRET="your-secret-32-chars"
mvn spring-boot:run
```

### Docker Compose
```bash
# .env file (auto-loaded)
SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/blinkit_auth
JWT_SECRET=your-secret-32-chars
```

## Default Credentials (Docker Compose)

- **Database:** PostgreSQL
  - Host: localhost
  - Port: 5432
  - Username: postgres
  - Password: postgres
  - Database: blinkit_auth

- **Application:**
  - URL: http://localhost:8081
  - Context: /

## Port Mappings

| Service | Port | Use |
|---------|------|-----|
| Auth Service | 8081 | REST API |
| PostgreSQL | 5432 | Database |
| Actuator | 8081 | /actuator/health |

## Key Files Reference

| File | Purpose |
|------|---------|
| `pom.xml` | Maven dependencies |
| `AuthServiceApplication.java` | Main entry point |
| `application.yml` | Main config |
| `application-dev.yml` | Dev profile config |
| `SecurityConfig.java` | Spring Security setup |
| `AuthService.java` | Business logic |
| `AuthController.java` | REST endpoints |
| `JwtTokenProvider.java` | JWT handling |
| `UserRepository.java` | Database queries |
| `Dockerfile` | Container build |
| `docker-compose.yml` | Multi-container setup |

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 8081
lsof -i :8081

# Kill process
kill -9 <PID>

# Or use different port
export SERVER_PORT=8082
```

### Database Connection Error
```bash
# Check PostgreSQL is running
psql -h localhost -U postgres -c "SELECT 1;"

# Create database if missing
createdb blinkit_auth

# Check connection URL
# Default: jdbc:postgresql://localhost:5432/blinkit_auth
```

### JWT Token Error
```bash
# Token too short? Set longer JWT_SECRET
# Must be at least 32 characters for HS512

# Test token expiration
# Default: 86400000 ms = 24 hours
```

### Build Failures
```bash
# Clean build
mvn clean install

# Skip tests
mvn clean install -DskipTests

# Update dependencies
mvn dependency:resolve
```

## Performance Tips

### Local Development
```yaml
# application-dev.yml
spring.jpa.properties.hibernate.jdbc.batch_size: 20
spring.jpa.properties.hibernate.jdbc.fetch_size: 50
```

### Production
```yaml
# Increase pool size
spring.datasource.hikari.maximum-pool-size: 30
spring.datasource.hikari.minimum-idle: 10

# JVM tuning
-Xmx2048m -Xms1024m -XX:+UseG1GC
```

## Security Checklist

- ✅ Change default JWT_SECRET
- ✅ Use strong database password
- ✅ Enable HTTPS/TLS
- ✅ Set SPRING_PROFILES_ACTIVE=prod
- ✅ Remove default credentials
- ✅ Configure CORS properly
- ✅ Enable security headers
- ✅ Use encrypted connections
- ✅ Set up monitoring
- ✅ Configure backups

## Useful URLs

- **API Base:** `http://localhost:8081/api/auth`
- **Health:** `http://localhost:8081/actuator/health`
- **Metrics:** `http://localhost:8081/actuator/metrics`
- **API Docs:** See `API_REQUESTS.md`

## Documentation Files

- `README.md` - Project overview
- `DEPLOYMENT.md` - Production deployment
- `STRUCTURE.md` - Project structure details
- `API_REQUESTS.md` - API examples
- `QUICK_REFERENCE.md` - This file

---

**Quick Start:** `docker-compose up -d` → `curl http://localhost:8081/actuator/health`

**Test Service:** See `API_REQUESTS.md` for cURL examples
