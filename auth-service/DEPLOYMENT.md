# Auth Service - Deployment Guide

## Production Deployment

### 1. Pre-Deployment Checklist

- [ ] Java 21 JDK installed
- [ ] PostgreSQL 16+ running
- [ ] Docker & Docker Compose installed (if using containers)
- [ ] Environment variables configured
- [ ] JWT secret generated (32+ characters)
- [ ] Database backup strategy in place
- [ ] Monitoring tools configured

### 2. Environment Setup

#### Generate Secure JWT Secret
```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object {[byte](Get-Random -Maximum 256)}))
```

#### Set Production Environment Variables
```bash
export SPRING_DATASOURCE_URL="jdbc:postgresql://db-host:5432/blinkit_auth"
export SPRING_DATASOURCE_USERNAME="db_user"
export SPRING_DATASOURCE_PASSWORD="strong_password"
export JWT_SECRET="your-secure-32-character-secret"
export JWT_EXPIRATION="86400000"
export JAVA_OPTS="-Xmx1024m -Xms512m"
```

### 3. Database Setup

#### Create Database
```sql
CREATE DATABASE blinkit_auth;
GRANT ALL PRIVILEGES ON DATABASE blinkit_auth TO postgres;
```

#### Connection Pooling (in application.yml)
```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000
```

### 4. Build and Package

#### Maven Build
```bash
mvn clean package -DskipTests
```

#### JAR Output
```
target/auth-service-1.0.0.jar
```

### 5. Container Deployment

#### Build Docker Image
```bash
docker build -t blinkit/auth-service:1.0.0 .
docker tag blinkit/auth-service:1.0.0 blinkit/auth-service:latest
```

#### Push to Registry
```bash
docker login
docker push blinkit/auth-service:1.0.0
docker push blinkit/auth-service:latest
```

#### Run with Docker Compose
```bash
docker-compose -f docker-compose.yml up -d
```

### 6. Kubernetes Deployment

#### Create Namespace
```bash
kubectl create namespace auth-service
```

#### Deploy Secrets
```bash
kubectl create secret generic auth-service-secrets \
  --from-literal=jwt-secret='your-secret' \
  --from-literal=db-password='password' \
  -n auth-service
```

#### Apply Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  namespace: auth-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
    spec:
      containers:
      - name: auth-service
        image: blinkit/auth-service:1.0.0
        ports:
        - containerPort: 8081
        env:
        - name: SPRING_DATASOURCE_URL
          value: "jdbc:postgresql://postgres-service:5432/blinkit_auth"
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: auth-service-secrets
              key: jwt-secret
        livenessProbe:
          httpGet:
            path: /actuator/health
            port: 8081
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /actuator/health/readiness
            port: 8081
          initialDelaySeconds: 10
          periodSeconds: 5
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1024Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: auth-service
  namespace: auth-service
spec:
  type: ClusterIP
  ports:
  - port: 8081
    targetPort: 8081
  selector:
    app: auth-service
```

### 7. Linux Service Setup

#### Create systemd Service
```bash
sudo tee /etc/systemd/system/auth-service.service > /dev/null <<EOF
[Unit]
Description=Auth Service
After=network.target

[Service]
Type=simple
User=appuser
WorkingDirectory=/opt/auth-service
Environment="JWT_SECRET=your-secret"
Environment="SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/blinkit_auth"
ExecStart=/usr/bin/java -jar auth-service-1.0.0.jar
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
```

#### Start Service
```bash
sudo systemctl start auth-service
sudo systemctl enable auth-service
sudo systemctl status auth-service
```

### 8. Reverse Proxy Setup (Nginx)

```nginx
upstream auth_service {
    server localhost:8081;
}

server {
    listen 80;
    server_name auth.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name auth.example.com;

    ssl_certificate /etc/ssl/certs/certificate.crt;
    ssl_certificate_key /etc/ssl/private/private.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://auth_service;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### 9. Monitoring & Logging

#### Prometheus Metrics
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'auth-service'
    static_configs:
      - targets: ['localhost:8081']
    metrics_path: '/actuator/prometheus'
```

#### ELK Stack Integration
```yaml
spring:
  cloud:
    config:
      server:
        git:
          uri: https://github.com/your-org/config-repo

logging:
  level:
    root: INFO
  pattern:
    json: '{"timestamp":"%d","level":"%p","logger":"%c","message":"%m"}'
```

### 10. Health Checks

#### Health Endpoint
```bash
curl -X GET http://localhost:8081/actuator/health
```

#### Readiness Probe
```bash
curl -X GET http://localhost:8081/actuator/health/readiness
```

#### Liveness Probe
```bash
curl -X GET http://localhost:8081/actuator/health/liveness
```

### 11. Backup & Recovery

#### Database Backup
```bash
pg_dump -h localhost -U postgres -d blinkit_auth > backup.sql
```

#### Restore Database
```bash
psql -h localhost -U postgres -d blinkit_auth < backup.sql
```

### 12. Performance Tuning

#### JVM Tuning
```bash
-Xmx2048m          # Maximum heap size
-Xms1024m          # Initial heap size
-XX:+UseG1GC       # Use G1 garbage collector
-XX:+ParallelRefProcEnabled
-XX:+UnlockDiagnosticVMOptions
-XX:G1SummarizeRSetStatsPeriod=1
```

#### Connection Pool
```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 30
      minimum-idle: 10
      connection-timeout: 30000
      idle-timeout: 600000
```

### 13. Security Hardening

#### Enable CORS (if needed)
```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
            .allowedOrigins("https://example.com")
            .allowedMethods("GET", "POST", "PUT", "DELETE")
            .allowCredentials(true)
            .maxAge(3600);
    }
}
```

#### Rate Limiting
```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics
```

### 14. Troubleshooting

#### View Logs
```bash
# Docker
docker-compose logs -f auth-service

# Systemd
journalctl -u auth-service -f

# File
tail -f /var/log/auth-service/app.log
```

#### Check Database Connection
```bash
psql -h localhost -U postgres -d blinkit_auth -c "SELECT 1;"
```

#### Test JWT Token
```bash
curl -X POST http://localhost:8081/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

### 15. Rollback Plan

#### Keep Previous Version
```bash
docker tag blinkit/auth-service:1.0.0 blinkit/auth-service:1.0.0-backup
docker pull blinkit/auth-service:0.9.0
docker-compose up -d
```

#### Database Rollback
```bash
psql -f /backups/pre-deploy.sql
```

---

## Deployment Checklist

- [ ] Environment variables set
- [ ] Database created and migrated
- [ ] JWT secret configured (32+ chars)
- [ ] Application built successfully
- [ ] Docker image created and tested
- [ ] Health checks responding
- [ ] API endpoints accessible
- [ ] Monitoring configured
- [ ] Backups scheduled
- [ ] SSL/TLS certificates installed
- [ ] Logging configured
- [ ] Performance tuning applied
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Rollback plan documented

---

**Version:** 1.0.0
**Last Updated:** 2024-05-07
