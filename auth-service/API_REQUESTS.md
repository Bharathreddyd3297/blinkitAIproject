### Auth Service API - Sample Requests

## Base URL
http://localhost:8081

---

## 1. HEALTH CHECK

### Get Service Health
GET http://localhost:8081/actuator/health

---

## 2. AUTHENTICATION APIs

### Sign Up - Create New User
POST http://localhost:8081/api/auth/signup
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123"
}

**Response (201 Created):**
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "role": "USER",
  "message": "User registered successfully"
}
```

---

### Sign Up - User Already Exists Error
POST http://localhost:8081/api/auth/signup
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "john@example.com",
  "password": "SecurePass123"
}

**Response (409 Conflict):**
```json
{
  "code": "USER_ALREADY_EXISTS",
  "message": "User already exists with email: john@example.com",
  "status": 409,
  "timestamp": "2024-05-07T10:30:45",
  "path": "/api/auth/signup"
}
```

---

### Sign Up - Validation Error
POST http://localhost:8081/api/auth/signup
Content-Type: application/json

{
  "name": "J",
  "email": "invalid-email",
  "password": "short"
}

**Response (400 Bad Request):**
```json
{
  "timestamp": "2024-05-07T10:30:45",
  "status": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "errors": {
    "name": "Name must be between 2 and 100 characters",
    "email": "Email should be valid",
    "password": "Password must be between 8 and 50 characters"
  }
}
```

---

### Login - Generate JWT Token
POST http://localhost:8081/api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123"
}

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzUxMiJ9.eyJyb2xlIjoiVVNFUiIsInN1YiI6ImpvaG5AZXhhbXBsZS5jb20iLCJpYXQiOjE3MTQ2MjM0NDUsImV4cCI6MTcxNDcwOTg0NX0.Yz...",
  "tokenType": "Bearer",
  "expiresIn": 86400,
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "USER"
  }
}
```

---

### Login - Invalid Credentials
POST http://localhost:8081/api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "WrongPassword"
}

**Response (401 Unauthorized):**
```json
{
  "code": "INVALID_CREDENTIALS",
  "message": "Invalid credentials",
  "status": 401,
  "timestamp": "2024-05-07T10:30:45",
  "path": "/api/auth/login"
}
```

---

## 3. PROTECTED APIs

### Get Current User Info
GET http://localhost:8081/api/auth/me
Authorization: Bearer eyJhbGciOiJIUzUxMiJ9.eyJyb2xlIjoiVVNFUiIsInN1YiI6ImpvaG5AZXhhbXBsZS5jb20iLCJpYXQiOjE3MTQ2MjM0NDUsImV4cCI6MTcxNDcwOTg0NX0.Yz...

---

### Get User By ID
GET http://localhost:8081/api/auth/user/1
Authorization: Bearer eyJhbGciOiJIUzUxMiJ9.eyJyb2xlIjoiVVNFUiIsInN1YiI6ImpvaG5AZXhhbXBsZS5jb20iLCJpYXQiOjE3MTQ2MjM0NDUsImV4cCI6MTcxNDcwOTg0NX0.Yz...

**Response (200 OK):**
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "role": "USER"
}
```

---

### Access Protected Resource Without Token
GET http://localhost:8081/api/auth/user/1

**Response (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

---

## Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Request validation failed |
| INVALID_CREDENTIALS | 401 | Invalid email or password |
| USER_NOT_FOUND | 404 | User does not exist |
| USER_ALREADY_EXISTS | 409 | User with email already exists |
| INTERNAL_SERVER_ERROR | 500 | Unexpected server error |

---

## cURL Examples

### Sign Up
```bash
curl -X POST http://localhost:8081/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123"
  }'
```

### Login
```bash
curl -X POST http://localhost:8081/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123"
  }'
```

### Get User (Protected)
```bash
curl -X GET http://localhost:8081/api/auth/user/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Health Check
```bash
curl http://localhost:8081/actuator/health
```

---

## Environment Setup

**Set JWT Secret (Recommended for production):**
```bash
export JWT_SECRET="your-very-long-secret-key-minimum-32-characters"
```

**Run with Docker Compose:**
```bash
docker-compose up -d
```

**Access PostgreSQL:**
```bash
psql -h localhost -U postgres -d blinkit_auth
```

---
