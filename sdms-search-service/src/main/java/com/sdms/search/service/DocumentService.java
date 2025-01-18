package com.sdms.search.service;

import com.sdms.search.elasticsearch.DocumentIndex;
import com.sdms.search.elasticsearch.repository.DocumentIndexRepository;
import com.sdms.search.model.DocumentInformation;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DocumentService {
    private final DocumentIndexRepository documentIndexRepository;

    public void indexDocument(DocumentInformation document) {
        DocumentIndex documentIndex = DocumentIndex.builder()
                .id(document.getId())
                .filename(document.getOriginalFilename())
                .content(document.getContent())
                .userId(document.getUserId())
                .mimeType(document.getMimeType())
                .documentType(document.getDocumentType())
                .major(document.getMajor().getCode())
                .courseCode(document.getCourseCode())
                .courseLevel(document.getCourseLevel())
                .category(document.getCategory())
                .tags(document.getTags())
                .fileSize(document.getFileSize())
                .createdAt(document.getCreatedAt())
                .build();

        documentIndexRepository.save(documentIndex);
    }
}
