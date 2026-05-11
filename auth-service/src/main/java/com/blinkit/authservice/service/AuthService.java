package com.blinkit.authservice.service;

import com.blinkit.authservice.dto.LoginRequest;
import com.blinkit.authservice.dto.LoginResponse;
import com.blinkit.authservice.dto.SignUpRequest;
import com.blinkit.authservice.dto.SignUpResponse;
import com.blinkit.authservice.dto.UserResponse;
import com.blinkit.authservice.entity.Role;
import com.blinkit.authservice.entity.User;
import com.blinkit.authservice.exception.AuthenticationException;
import com.blinkit.authservice.exception.ResourceAlreadyExistsException;
import com.blinkit.authservice.exception.ResourceNotFoundException;
import com.blinkit.authservice.repository.UserRepository;
import com.blinkit.authservice.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final AuthenticationManager authenticationManager;

    public SignUpResponse signup(SignUpRequest request) {
        log.info("Processing signup for email: {}", request.getEmail());

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ResourceAlreadyExistsException(
                    "User already exists with email: " + request.getEmail(),
                    "USER_ALREADY_EXISTS"
            );
        }

        User user = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(Role.USER)
                .isActive(true)
                .build();

        User savedUser = userRepository.save(user);
        log.info("User created successfully with id: {}", savedUser.getId());

        return SignUpResponse.builder()
                .id(savedUser.getId())
                .name(savedUser.getName())
                .email(savedUser.getEmail())
                .role(savedUser.getRole().toString())
                .message("User registered successfully")
                .build();
    }

    public LoginResponse login(LoginRequest request) {
        log.info("Processing login for email: {}", request.getEmail());

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.getEmail(),
                            request.getPassword()
                    )
            );

            User user = userRepository.findByEmail(request.getEmail())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "User not found with email: " + request.getEmail(),
                            "USER_NOT_FOUND"
                    ));

            String token = tokenProvider.generateTokenWithRole(
                    user.getId(), user.getEmail(), user.getRole().toString());
            long expiresIn = tokenProvider.getExpirationTime();

            UserResponse userResponse = UserResponse.builder()
                    .id(user.getId())
                    .name(user.getName())
                    .email(user.getEmail())
                    .role(user.getRole().toString())
                    .build();

            log.info("Login successful for user: {}", request.getEmail());

            return LoginResponse.builder()
                    .accessToken(token)
                    .tokenType("Bearer")
                    .expiresIn(expiresIn)
                    .user(userResponse)
                    .build();

        } catch (org.springframework.security.core.AuthenticationException ex) {
            log.error("Login failed for email: {} - {}", request.getEmail(), ex.getMessage());
            throw new AuthenticationException("Invalid credentials", "INVALID_CREDENTIALS", 401);
        } catch (Exception ex) {
            log.error("Login failed for email: {} - {}", request.getEmail(), ex.getMessage(), ex);
            throw new AuthenticationException("Login error: " + ex.getMessage(), "LOGIN_ERROR", 500);
        }
    }

    public UserResponse getUserById(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User not found with id: " + userId,
                        "USER_NOT_FOUND"
                ));

        return UserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole().toString())
                .build();
    }

}
