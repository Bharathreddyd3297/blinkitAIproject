# =============================================================================
# Blinkit API Gateway — multi-stage image
# Builder: maven:3.9-eclipse-temurin-21
# Runtime: eclipse-temurin:21-jre-alpine, non-root user
# Mirrors the pattern used by every other Blinkit service.
# =============================================================================
FROM maven:3.9.6-eclipse-temurin-21 AS builder

WORKDIR /app

COPY pom.xml .
COPY src ./src

RUN mvn clean package -DskipTests

# -----------------------------------------------------------------------------
# Runtime
# -----------------------------------------------------------------------------
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY --from=builder /app/target/api-gateway-1.0.0.jar app.jar

# Non-root runtime user, matching the rest of the platform.
RUN addgroup -g 1001 appuser && \
    adduser -D -u 1001 -G appuser appuser && \
    chown -R appuser:appuser /app

USER appuser

# AKS / docker-compose probes hit /actuator/health.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8080/actuator/health || exit 1

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
