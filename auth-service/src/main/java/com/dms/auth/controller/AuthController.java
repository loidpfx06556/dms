package com.dms.auth.controller;

import com.dms.auth.dto.request.*;
import com.dms.auth.dto.response.OtpVerificationResponse;
import com.dms.auth.exception.ResourceNotFoundException;
import com.dms.auth.security.request.RefreshTokenRequest;
import com.dms.auth.security.request.Verify2FARequest;
import com.dms.auth.security.response.TokenResponse;
import com.dms.auth.service.UserService;
import com.dms.auth.service.OtpService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final UserService userService;
    private final OtpService otpService;

    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(
            @Valid @RequestBody LoginRequest loginRequest,
            HttpServletRequest request) {
        TokenResponse response = userService.authenticateUser(loginRequest, request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/refresh-token")
    public ResponseEntity<TokenResponse> refreshToken(
            @Valid @RequestBody RefreshTokenRequest request) {
        TokenResponse response = userService.refreshToken(request.getRefreshToken());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @Valid @RequestBody RefreshTokenRequest request) {
        userService.logout(request.getRefreshToken());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/register")
    public ResponseEntity<Void> register(@Valid @RequestBody SignupRequest signupRequest) {
        userService.registerUser(signupRequest);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .build();
    }

    @PostMapping("/password/forgot")
    public ResponseEntity<Map<String, String>> forgotPassword(@RequestParam @Email String email) {
        try {
            userService.generatePasswordResetToken(email);
            Map<String, String> response = new HashMap<>();
            response.put("status", "success");
            return ResponseEntity.ok(response);
        } catch (IllegalStateException e) {
            // This exception will be thrown for rate limiting
            Map<String, String> response = new HashMap<>();
            response.put("status", "error");
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(response);
        } catch (ResourceNotFoundException e) {
            // We return 200 even if email not found for security reasons
            Map<String, String> response = new HashMap<>();
            response.put("status", "success");
            return ResponseEntity.ok(response);
        }
    }

    @PostMapping("/password/reset")
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody PasswordResetRequest request) {
        userService.resetPassword(request.getToken(), request.getNewPassword());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/2fa/verify")
    public ResponseEntity<String> verify2FA(
            @RequestBody Verify2FARequest verify2FARequest) {
        boolean isValid = userService.validate2FACode(verify2FARequest);
        if (isValid) {
            userService.enable2FA(verify2FARequest.getUsername());
            return ResponseEntity.ok("VERIFIED");
        }
        return ResponseEntity.ok("UNVERIFIED");
    }

    @PostMapping("/otp/verify")
    public ResponseEntity<TokenResponse> verifyOtp(
            @Valid @RequestBody OtpVerificationRequest otpVerificationRequest, HttpServletRequest request) {
        TokenResponse otpVerification = otpService.verifyOtp(otpVerificationRequest.getUsername(), otpVerificationRequest.getOtp(), request);
        return ResponseEntity.ok(otpVerification);
    }

    @PostMapping("/otp/resend")
    public ResponseEntity<OtpVerificationResponse> resendOtp(
            @Valid @RequestBody ResendOtpRequest request) {
        otpService.resendOtp(request.getUsername());
        return ResponseEntity.ok(new OtpVerificationResponse(
                "success",
                0,
                false,
                false
        ));
    }

}