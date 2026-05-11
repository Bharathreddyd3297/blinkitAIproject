package com.blinkit.paymentservice.security;

import com.blinkit.paymentservice.exception.InvalidTokenException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.UnsupportedJwtException;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.SignatureException;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

/**
 * Validates JWTs that were issued by auth-service.
 *
 * <p><b>Distributed authentication / microservice trust model</b>
 * <br>payment-service does not issue tokens; it only verifies them. The signing
 * key used for verification is loaded from the {@code JWT_SECRET} environment
 * variable, which is the SAME value auth-service uses to sign and the other
 * services (product-service / cart-service / order-service) use to verify.
 * This shared-secret model lets every microservice independently authenticate
 * a caller without contacting auth-service on each request.
 *
 * <p><b>JWT propagation:</b> the {@code Authorization: Bearer ...} header is
 * extracted by {@link JwtAuthenticationFilter} on every inbound request, and
 * forwarded verbatim by OrderServiceClient when payment-service calls
 * order-service on behalf of the user.
 *
 * <p><b>Future:</b> in AKS the {@code JWT_SECRET} env var will be projected
 * from a Kubernetes Secret / Azure Key Vault — no code change here.
 */
@Slf4j
@Component
public class JwtTokenProvider {

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    private SecretKey signingKey;

    @PostConstruct
    public void init() {
        byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
    }

    public Claims parseClaims(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (ExpiredJwtException ex) {
            log.warn("JWT token expired: {}", ex.getMessage());
            throw new InvalidTokenException("JWT token has expired", ex);
        } catch (UnsupportedJwtException ex) {
            log.warn("Unsupported JWT token: {}", ex.getMessage());
            throw new InvalidTokenException("Unsupported JWT token", ex);
        } catch (MalformedJwtException ex) {
            log.warn("Malformed JWT token: {}", ex.getMessage());
            throw new InvalidTokenException("Malformed JWT token", ex);
        } catch (SignatureException ex) {
            log.warn("Invalid JWT signature: {}", ex.getMessage());
            throw new InvalidTokenException("Invalid JWT signature", ex);
        } catch (IllegalArgumentException ex) {
            log.warn("JWT token is empty: {}", ex.getMessage());
            throw new InvalidTokenException("JWT token is empty or invalid", ex);
        } catch (JwtException ex) {
            log.warn("JWT validation error: {}", ex.getMessage());
            throw new InvalidTokenException("JWT validation failed", ex);
        }
    }

    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (InvalidTokenException ex) {
            return false;
        }
    }

    public Long extractUserId(Claims claims) {
        Object userIdClaim = claims.get("userId");
        if (userIdClaim == null) {
            userIdClaim = claims.get("id");
        }
        if (userIdClaim == null) {
            String subject = claims.getSubject();
            if (subject != null) {
                try {
                    return Long.parseLong(subject);
                } catch (NumberFormatException ignored) {
                    return null;
                }
            }
            return null;
        }
        if (userIdClaim instanceof Number n) {
            return n.longValue();
        }
        try {
            return Long.parseLong(userIdClaim.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public String extractEmail(Claims claims) {
        Object email = claims.get("email");
        if (email != null) {
            return email.toString();
        }
        return claims.getSubject();
    }

    public String extractRole(Claims claims) {
        Object role = claims.get("role");
        return role != null ? role.toString() : "USER";
    }
}
