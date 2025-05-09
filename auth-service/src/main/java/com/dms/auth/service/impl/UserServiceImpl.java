package com.dms.auth.service.impl;

import com.dms.auth.dto.RoleDto;
import com.dms.auth.dto.UserDto;
import com.dms.auth.dto.UserSearchResponse;
import com.dms.auth.dto.request.*;
import com.dms.auth.entity.PasswordResetToken;
import com.dms.auth.entity.AuthToken;
import com.dms.auth.entity.Role;
import com.dms.auth.entity.User;
import com.dms.auth.enums.AppRole;
import com.dms.auth.enums.TokenType;
import com.dms.auth.exception.InvalidRequestException;
import com.dms.auth.exception.ResourceNotFoundException;
import com.dms.auth.mapper.UserMapper;
import com.dms.auth.repository.PasswordResetTokenRepository;
import com.dms.auth.repository.RoleRepository;
import com.dms.auth.repository.UserRepository;
import com.dms.auth.security.jwt.JwtUtils;
import com.dms.auth.security.request.Verify2FARequest;
import com.dms.auth.security.response.TokenResponse;
import com.dms.auth.security.response.UserInfoResponse;
import com.dms.auth.security.service.CustomUserDetails;
import com.dms.auth.service.*;
import com.dms.auth.util.SecurityUtils;
import com.warrenstrange.googleauth.GoogleAuthenticatorKey;
import jakarta.servlet.http.HttpServletRequest;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class UserServiceImpl extends BaseService implements UserService {
    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Autowired
    private TokenService tokenService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private TotpService totpService;

    @Autowired
    private OtpService otpService;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private PublishEventService publishEventService;

    @Override
    public TokenResponse authenticateUser(LoginRequest loginRequest, HttpServletRequest request) {
        // Check if user exists and get user status before authentication
        User user = userRepository.findByUsernameOrEmail(loginRequest.getIdentifier(), loginRequest.getIdentifier())
                .orElseThrow(() -> new ResourceNotFoundException("USER_NOT_FOUND"));

        // Check if account is locked before attempting authentication
        if (!user.isAccountNonLocked()) {
            throw new LockedException("USER_LOCKED");
        }

        // Proceed with authentication
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(loginRequest.getIdentifier(), loginRequest.getPassword()));

        SecurityContextHolder.getContext().setAuthentication(authentication);
        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

        if (!user.isEnabled()) {
            return new TokenResponse()
                    .withEnabled(user.isEnabled());
        }
        return createToken(user, userDetails, request);
    }

    @Override
    public TokenResponse refreshToken(String refreshToken) {
        return tokenService.findByTokenAndType(refreshToken, TokenType.REFRESH)
                .map(tokenService::verifyToken)
                .map(AuthToken::getUser)
                .map(user -> {
                    CustomUserDetails userDetails = CustomUserDetails.build(user);
                    String jwt = jwtUtils.generateTokenFromUsername(userDetails);

                    List<String> roles = userDetails.getAuthorities().stream()
                            .map(GrantedAuthority::getAuthority)
                            .collect(Collectors.toList());

                    return new TokenResponse(
                            jwt,
                            refreshToken,
                            "Bearer",
                            userDetails.getUsername(),
                            roles
                    );
                })
                .orElseThrow(() -> new RuntimeException("Refresh token not found in database"));
    }

    @Override
    public void logout(String refreshToken) {
        // Get the user from the refresh token
        AuthToken token = tokenService.findByTokenAndType(refreshToken, TokenType.REFRESH)
                .orElse(null);

        // Revoke the specific refresh token
        tokenService.revokeToken(refreshToken, TokenType.REFRESH);

        // If we found the token, revoke all access tokens for the user too
        if (token != null && token.getUser() != null) {
            tokenService.revokeAllUserTokensByType(token.getUser(), TokenType.ACCESS);
        }

        // Clear security context
        SecurityContextHolder.clearContext();
    }

    @Override
    public void registerUser(SignupRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("USERNAME_EXISTS");
        }

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("EMAIL_EXISTS");
        }

        Role role = roleRepository.findByRoleName(AppRole.ROLE_USER)
                .orElseThrow(() -> new ResourceNotFoundException("Default role not found"));

        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(role);
        user.setAccountNonLocked(true);
        user.setEnabled(false); // disabled until verified
        user.setTwoFactorEnabled(false);
        user.setSignUpMethod("email");
        user.setCreatedAt(Instant.now());
        user.setCreatedBy(request.getUsername());
        user.setUpdatedBy(request.getUsername());

        user = userRepository.save(user);

        // Generate and send OTP
        otpService.generateAndSendOtp(user);
    }

    @Override
    public UserInfoResponse getUserInfo(UserDetails userDetails) {
        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        List<String> roles = userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toList());

        return new UserInfoResponse(
                user.getUserId(),
                user.getUsername(),
                user.getEmail(),
                user.isAccountNonLocked(),
                user.isEnabled(),
                user.isTwoFactorEnabled(),
                user.getCreatedAt(),
                roles
        );
    }

    @Override
    public void generatePasswordResetToken(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));

        // Check if there's a recent token (less than 5 minutes old)
        Optional<PasswordResetToken> recentToken = passwordResetTokenRepository.findLatestByUserEmail(email);
        if (recentToken.isPresent()) {
            Instant fiveMinutesAgo = Instant.now().minus(5, ChronoUnit.MINUTES);
            if (recentToken.get().getCreatedAt().isAfter(fiveMinutesAgo)) {
                throw new IllegalStateException("Please wait 5 minutes before requesting another password reset email");
            }
        }

        // Mark all others tokens used
        List<PasswordResetToken> passwordResetTokens = passwordResetTokenRepository.findAllByUserId(user.getUserId());
        passwordResetTokens.forEach(passwordResetToken -> passwordResetToken.setUsed(true));
        passwordResetTokenRepository.saveAllAndFlush(passwordResetTokens);

        String token = UUID.randomUUID().toString();
        // Set expiry to 5 hours from now
        Instant expiryDate = Instant.now().plus(5, ChronoUnit.HOURS);

        PasswordResetToken resetToken = new PasswordResetToken(token, expiryDate, user);
        resetToken.setCreatedAt(Instant.now());
        resetToken.setCreatedBy(user.getUsername());
        resetToken.setUpdatedBy(user.getUsername());
        passwordResetTokenRepository.save(resetToken);

        // Send email
        publishEventService.sendPasswordResetEmail(user, token, 5 * 60); // 5 hours expiry
    }

    @Override
    public void resetPassword(String token, String newPassword) {
        PasswordResetToken resetToken = passwordResetTokenRepository.findByToken(token)
                .orElseThrow(() -> new IllegalArgumentException("INVALID_PASSWORD_RESET_TOKEN"));

        if (resetToken.isUsed()) {
            throw new IllegalArgumentException("PASSWORD_RESET_TOKEN_USED");
        }

        if (resetToken.getExpiryDate().isBefore(Instant.now())) {
            throw new IllegalArgumentException("PASSWORD_RESET_TOKEN_EXPIRED");
        }

        User user = resetToken.getUser();

        user.setPassword(passwordEncoder.encode(newPassword));
        resetToken.setUsed(true);

        userRepository.save(user);
        passwordResetTokenRepository.save(resetToken);
    }

    @Override
    public UserDto getUserById(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));
        return userMapper.convertToDto(user);
    }

    @Override
    public void updateUserRole(UUID userId, String roleName, UserDetails currentUser) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        if (StringUtils.equals(user.getUsername(), currentUser.getUsername())) {
            throw new IllegalArgumentException("CANNOT_CHANGE_ADMIN_ROLE");
        }

        AppRole appRole = AppRole.valueOf(roleName);
        Role role = roleRepository.findByRoleName(appRole)
                .orElseThrow(() -> new ResourceNotFoundException("Role", "name", roleName));

        user.setRole(role);
        user.setUpdatedBy(SecurityUtils.getUserIdentifier());
        userRepository.save(user);
    }

    @Override
    public void updatePassword(UUID userId, UpdatePasswordRequest request, UserDetails currentUser) throws InvalidRequestException {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        // Verify current password
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new InvalidRequestException("INCORRECT_PASSWORD");
        }

        // Check if new password is same as old password
        if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw new InvalidRequestException("DIFFERENT_PASSWORD");
        }

        // Update password
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        user.setUpdatedBy(SecurityUtils.getUserIdentifier());

        // Optionally invalidate any existing password reset tokens
        passwordResetTokenRepository.findAll().stream()
                .filter(token -> token.getUser().equals(user) && !token.isUsed())
                .forEach(token -> {
                    token.setUsed(true);
                    passwordResetTokenRepository.save(token);
                });

        userRepository.save(user);
    }

    // 2FA operations
    @Override
    public GoogleAuthenticatorKey generate2FASecret(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        GoogleAuthenticatorKey key = totpService.generateSecret();
        user.setTwoFactorSecret(key.getKey());
        user.setUpdatedBy(SecurityUtils.getUserIdentifier());
        userRepository.save(user);
        return key;
    }

    @Override
    public void verify2FACode(UUID userId, Verify2FARequest verify2FARequest) {
        if (Objects.isNull(verify2FARequest.getCode())) {
            throw new IllegalArgumentException("Invalid code");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        boolean isValid = totpService.verifyCode(user.getTwoFactorSecret(), Integer.parseInt(verify2FARequest.getCode()));
        if (!isValid) {
            throw new IllegalArgumentException("Invalid 2FA code");
        }
        user.setTwoFactorEnabled(true);
        user.setUpdatedBy(SecurityUtils.getUserIdentifier());
        userRepository.save(user);
    }

    @Override
    public boolean validate2FACode(Verify2FARequest verify2FARequest) {
        if (Objects.isNull(verify2FARequest.getCode())) {
            throw new IllegalArgumentException("Invalid code");
        }

        if (Objects.isNull(verify2FARequest.getUsername())) {
            throw new IllegalArgumentException("Invalid username");
        }

        User user = userRepository.findByUsername(verify2FARequest.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", verify2FARequest.getUsername()));
        return totpService.verifyCode(user.getTwoFactorSecret(), Integer.parseInt(verify2FARequest.getCode()));
    }

    @Override
    public void enable2FA(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "name", username));
        user.setTwoFactorEnabled(true);
        user.setUpdatedBy(username);
        userRepository.save(user);
    }

    @Override
    public void disable2FA(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        user.setTwoFactorEnabled(false);
        user.setTwoFactorSecret(null);
        user.setUpdatedBy(SecurityUtils.getUserIdentifier());
        userRepository.save(user);
    }

    @Override
    public boolean get2FAStatus(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        return user.isTwoFactorEnabled();
    }

    @Override
    public String getQrCodeUrl(GoogleAuthenticatorKey key, String username) {
        return totpService.getQrCodeUrl(key, username);
    }

    @Override
    public void updateProfile(UUID userId, UpdateProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        ;

        // Validate username uniqueness if changed
        if (!user.getUsername().equals(request.getUsername()) &&
            userRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("Username is already taken");
        }

        // Validate email uniqueness if changed
        if (!user.getEmail().equals(request.getEmail()) &&
            userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email is already in use");
        }

        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setUpdatedBy(SecurityUtils.getUserIdentifier());
        userRepository.save(user);
    }

    @Override
    public void updateStatus(UUID userId, UpdateStatusRequest request, boolean isAdmin) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        if (!isAdmin) {
            // Regular users can only update specific fields
            if (Objects.nonNull(request.getAccountLocked()) || Objects.nonNull(request.getCredentialsExpired())) {
                throw new AccessDeniedException("Operation not allowed for regular users");
            }
        }

        // Update allowed fields based on role
        if (isAdmin) {
            if (Objects.nonNull(request.getAccountLocked())) {
                user.setAccountNonLocked(!request.getAccountLocked());
            }
            if (Objects.nonNull(request.getCredentialsExpired())) {
                userRepository.findById(userId).ifPresent((targetUser) -> {
                    tokenService.revokeAllUserTokens(targetUser);
                });
            }
        }

        user.setUpdatedBy(SecurityUtils.getUserIdentifier());

        userRepository.save(user);
    }

    @Override
    public UserDto getUserByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));

        return UserDto.builder()
                .userId(user.getUserId())
                .username(user.getUsername())
                .email(user.getEmail())
                .role(new RoleDto(user.getRole().getRoleId(), user.getRole().getRoleName()))
                .build();
    }

    @Override
    public List<UserSearchResponse> searchUsers(String query) {
        return userRepository.findByUsernameContainingIgnoreCaseOrEmailContainingIgnoreCase(
                        query, query)
                .stream()
                .map(user -> new UserSearchResponse(
                        user.getUserId().toString(),
                        user.getUsername(),
                        user.getEmail())
                )
                .toList();
    }

    @Override
    public List<UserSearchResponse> getUsersByIds(List<UUID> userIds) {
        return userRepository.findAllById(userIds)
                .stream()
                .map(user -> new UserSearchResponse(
                        user.getUserId().toString(),
                        user.getUsername(),
                        user.getEmail()
                ))
                .toList();
    }
}