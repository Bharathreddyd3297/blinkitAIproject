package com.blinkit.productservice.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.UnsupportedJwtException;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.SignatureException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;

/**
 * Validates JWTs that were issued by auth-service.
 *
 * <p><b>Distributed authentication / microservice trust model</b>
 * <br>product-service does not issue tokens; it only verifies them. The
 * signing key used for verification is loaded from the {@code JWT_SECRET}
 * environment variable, which is the SAME value auth-service uses to sign.
 * This shared-secret model lets every microservice independently authenticate
 * a caller without contacting auth-service on each request.
 *
 * <p><b>JWT propagation:</b> tokens reach this service in two ways:
 * <ol>
 *   <li>Direct client calls — the API gateway / browser puts the token in the
 *       {@code Authorization: Bearer ...} header.</li>
 *   <li>Service-to-service calls — when cart-service calls product-service on
 *       behalf of a user, it forwards the original {@code Authorization}
 *       header verbatim (see cart-service ProductServiceClient).</li>
 * </ol>
 *
 * <p><b>Future:</b> in AKS the {@code JWT_SECRET} env var will be projected
 * from a Kubernetes Secret / Azure Key Vault — no code change here.
 */
@Component
@Slf4j
public class JwtTokenProvider {

    @Value("${auth.jwt.secret}")
    private String jwtSecret;

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes());
    }

    public Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String getEmailFromJWT(String token) {
        return parseClaims(token).getSubject();
    }

    public String getRoleFromJWT(String token) {
        Object role = parseClaims(token).get("role");
        return role == null ? null : role.toString();
    }

    public boolean validateToken(String authToken) {
        try {
            Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(authToken);
            return true;
        } catch (ExpiredJwtException ex) {
            log.warn("JWT token expired: {}", ex.getMessage());
        } catch (UnsupportedJwtException ex) {
            log.warn("Unsupported JWT token: {}", ex.getMessage());
        } catch (MalformedJwtException ex) {
            log.warn("Malformed JWT token: {}", ex.getMessage());
        } catch (SignatureException ex) {
            log.warn("Invalid JWT signature: {}", ex.getMessage());
        } catch (IllegalArgumentException ex) {
            log.warn("JWT claims string is empty: {}", ex.getMessage());
        }
        return false;
    }

}
