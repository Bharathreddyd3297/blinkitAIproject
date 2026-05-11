package com.blinkit.authservice.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

/**
 * Issues and validates JSON Web Tokens for the Blinkit platform.
 *
 * <p><b>Distributed authentication / microservice trust model</b>
 * <br>This service is the single token issuer in the platform. The signing
 * secret ({@code auth.jwt.secret}) is loaded from the {@code JWT_SECRET}
 * environment variable, which is shared across every downstream microservice
 * (product-service, cart-service). Because all services share the same HS512
 * key, any service can independently verify a token issued by this one
 * without an extra network round-trip — this is what makes the trust model
 * work in a stateless, horizontally-scalable way.
 *
 * <p><b>Algorithm:</b> HS512 (HMAC-SHA-512). The JJWT library requires the
 * raw key bytes to be at least 64 bytes for HS512.
 *
 * <p><b>Future:</b> When the platform moves to AKS / Kubernetes the
 * {@code JWT_SECRET} value will be sourced from a Kubernetes Secret (or Azure
 * Key Vault via the CSI driver) and projected into the Pod as an env var —
 * the code path here does not change.
 */
@Component
@Slf4j
public class JwtTokenProvider {

    @Value("${auth.jwt.secret}")
    private String jwtSecret;

    @Value("${auth.jwt.expiration:86400000}")
    private long jwtExpirationInMs;

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes());
    }

    public String generateToken(UserDetails userDetails) {
        Map<String, Object> claims = new HashMap<>();
        return createToken(claims, userDetails.getUsername());
    }

    public String generateTokenWithRole(String email, String role) {
        return generateTokenWithRole(null, email, role);
    }

    /**
     * Builds a JWT carrying the full identity needed by every downstream
     * service (product-service, cart-service, order-service). The
     * {@code userId} and {@code email} claims are required by
     * cart-service.SecurityUtils / order-service.SecurityUtils to populate
     * the AuthenticatedUser principal.
     */
    public String generateTokenWithRole(Long userId, String email, String role) {
        Map<String, Object> claims = new HashMap<>();
        if (userId != null) {
            claims.put("userId", userId);
        }
        claims.put("email", email);
        claims.put("role", role);
        return createToken(claims, email);
    }

    private String createToken(Map<String, Object> claims, String subject) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpirationInMs);

        return Jwts.builder()
                .claims(claims)
                .subject(subject)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(getSigningKey(), SignatureAlgorithm.HS512)
                .compact();
    }

    public String getEmailFromJWT(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return claims.getSubject();
    }

    public String getRoleFromJWT(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return (String) claims.get("role");
    }

    public boolean validateToken(String authToken) {
        try {
            Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(authToken);
            return true;
        } catch (Exception ex) {
            log.error("Invalid JWT token: {}", ex.getMessage());
        }
        return false;
    }

    public long getExpirationTime() {
        return jwtExpirationInMs / 1000;
    }

}
