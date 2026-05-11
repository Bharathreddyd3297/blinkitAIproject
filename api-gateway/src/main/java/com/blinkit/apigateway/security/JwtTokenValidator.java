package com.blinkit.apigateway.security;

import com.blinkit.apigateway.config.GatewayProperties;
import com.blinkit.apigateway.exception.JwtValidationException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;

/**
 * Stateless JWT validator. Mirrors the auth-service signing key configuration
 * exactly — same library, same algorithm, same secret bytes — so any token
 * that auth-service issues is verifiable here without a network round-trip.
 *
 * <p>The gateway only <i>validates</i>; it never issues tokens. The auth-service
 * remains the sole issuer.
 *
 * <p>On any verification failure this throws a {@link JwtValidationException}
 * with a stable error code that
 * {@link com.blinkit.apigateway.exception.GatewayExceptionHandler} maps to a
 * 401 / 403 envelope.
 */
@Component
@Slf4j
public class JwtTokenValidator {

    private static final String BEARER_PREFIX = "Bearer ";

    private final SecretKey signingKey;

    public JwtTokenValidator(GatewayProperties properties) {
        String secret = properties.getJwt().getSecret();
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                    "gateway.jwt.secret (env JWT_SECRET) must be configured");
        }
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes());
    }

    /**
     * Strips the "Bearer " prefix, parses + verifies the signature, and
     * returns the claims. Throws on any invalid / expired / malformed token.
     */
    public Claims parseAndValidate(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith(BEARER_PREFIX)) {
            throw new JwtValidationException("MISSING_TOKEN", "Authorization Bearer token is required");
        }
        String token = authorizationHeader.substring(BEARER_PREFIX.length()).trim();
        if (token.isEmpty()) {
            throw new JwtValidationException("MISSING_TOKEN", "Authorization Bearer token is required");
        }

        try {
            return Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (ExpiredJwtException ex) {
            log.debug("JWT expired: {}", ex.getMessage());
            throw new JwtValidationException("TOKEN_EXPIRED", "Authentication token has expired");
        } catch (JwtException | IllegalArgumentException ex) {
            log.debug("JWT invalid: {}", ex.getMessage());
            throw new JwtValidationException("INVALID_TOKEN", "Authentication token is invalid");
        }
    }
}
