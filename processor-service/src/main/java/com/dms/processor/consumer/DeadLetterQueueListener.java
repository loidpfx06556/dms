package com.dms.processor.consumer;

import com.dms.processor.model.FailedMessage;
import com.dms.processor.repository.FailedMessageRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Component
@Slf4j
@RequiredArgsConstructor
public class DeadLetterQueueListener {

    private final FailedMessageRepository failedMessageRepository;
    private final ObjectMapper objectMapper;

    @RabbitListener(queues = "${rabbitmq.queues.document-sync-dlq}")
    public void processFailedMessages(Message failedMessage) {
        try {
            // Extract message properties
            String originalQueue = failedMessage.getMessageProperties().getHeader("x-original-queue");
            String error = failedMessage.getMessageProperties().getHeader("x-exception-message");
            String stackTrace = failedMessage.getMessageProperties().getHeader("x-exception-stacktrace");
            String messageId = failedMessage.getMessageProperties().getMessageId();
            String routingKey = failedMessage.getMessageProperties().getReceivedRoutingKey();

            // Convert message body to string
            String messageBody = new String(failedMessage.getBody());

            // Create headers map
            Map<String, Object> headers = new HashMap<>(failedMessage.getMessageProperties().getHeaders());

            // Build failed message document
            FailedMessage failedMessageDoc = FailedMessage.builder()
                    .originalMessageId(messageId)
                    .originalQueue(originalQueue)
                    .routingKey(routingKey)
                    .errorMessage(error)
                    .stackTrace(stackTrace)
                    .messageBody(messageBody)
                    .headers(headers)
                    .retryCount(0)
                    .status(FailedMessage.FailedMessageStatus.NEW)
                    .createdAt(new Date())
                    .updatedAt(new Date())
                    .build();

            // Save to MongoDB
            failedMessageRepository.save(failedMessageDoc);

            log.info("Failed message saved to MongoDB. Original queue: {}, Error: {}",
                    originalQueue, error);

        } catch (Exception e) {
            log.error("Error processing failed message", e);
            // Here you might want to implement a fallback mechanism
            // such as saving to a backup storage or sending alerts
        }
    }
}