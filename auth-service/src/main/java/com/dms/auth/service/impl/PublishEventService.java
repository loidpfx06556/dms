package com.dms.auth.service.impl;

import com.dms.auth.dto.EmailNotificationPayload;
import com.dms.auth.entity.User;
import com.dms.auth.producer.RabbitMQMessageProducer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Service for publishing events to the message broker.
 * This service handles higher-level business logic for creating and publishing events.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class PublishEventService {
    @Value("${app.otp.expiry-minutes:5}")
    private int otpExpiryMinutes;

    @Value("${app.otp.max-attempts:5}")
    private int maxAttempts;

    @Value("${rabbitmq.exchanges.notification}")
    private String notificationExchange;

    @Value("${rabbitmq.routing-keys.email-auth}")
    private String emailAuthRoutingKey;

    private final RabbitMQMessageProducer rabbitMQMessageProducer;

    /**
     * Send an OTP email notification
     *
     * @param user The user to send the OTP to
     * @param otp The OTP code
     */
    public void sendOtpEmail(User user, String otp) {
        try {
            EmailNotificationPayload payload = EmailNotificationPayload.builder()
                    .to(user.getEmail())
                    .username(user.getUsername())
                    .otp(otp)
                    .expiryMinutes(otpExpiryMinutes)
                    .maxAttempts(maxAttempts)
                    .eventType("VERIFY_OTP")
                    .build();

            log.info("Publishing OTP email for user: {}", user.getUsername());

            // Using new routing key structure: notification.email.otp
            rabbitMQMessageProducer.publish(
                    payload,
                    notificationExchange,
                    emailAuthRoutingKey
            );

            log.info("OTP email published for user: {}", user.getUsername());
        } catch (Exception e) {
            log.error("Failed to publish OTP email", e);
            throw new RuntimeException("Failed to send OTP email", e);
        }
    }

    /**
     * Send a password reset email notification
     *
     * @param user The user to send the password reset to
     * @param token The reset token
     * @param expiryMinutes Token expiration time in hours
     */
    public void sendPasswordResetEmail(User user, String token, int expiryMinutes) {
        try {
            EmailNotificationPayload payload = EmailNotificationPayload.builder()
                    .to(user.getEmail())
                    .username(user.getUsername())
                    .token(token)
                    .expiryMinutes(expiryMinutes)
                    .eventType("PASSWORD_RESET")
                    .build();

            log.info("Publishing password reset email for user: {}", user.getUsername());

            rabbitMQMessageProducer.publish(
                    payload,
                    notificationExchange,
                    emailAuthRoutingKey
            );

            log.info("Password reset email published for user: {}", user.getUsername());
        } catch (Exception e) {
            log.error("Failed to publish password reset email", e);
            throw new RuntimeException("Failed to send password reset email", e);
        }
    }
}