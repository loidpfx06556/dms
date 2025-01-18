package com.sdms.search.consumer;


import com.sdms.search.model.DocumentInformation;
import com.sdms.search.model.SyncEventRequest;
import com.sdms.search.repository.DocumentRepository;
import com.sdms.search.service.DocumentService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Slf4j
@Component
public class EventConsumer {

    private final DocumentService documentService;
    private final DocumentRepository documentRepository;

    public EventConsumer(DocumentService documentService, DocumentRepository documentRepository) {
        this.documentService = documentService;
        this.documentRepository = documentRepository;
    }

    @RabbitListener(queues = "${rabbitmq.queues.document-sync}")
    public void consumeSyncEvent(SyncEventRequest syncEventRequest) {
        log.info("Consumed payload from queue event: {}", syncEventRequest.getEventId());

        Optional<DocumentInformation> optionalDocumentInformation = documentRepository.findByIdAndUserId(syncEventRequest.getDocumentId(), syncEventRequest.getUserId());
        optionalDocumentInformation.ifPresent(documentService::indexDocument);

    }
}