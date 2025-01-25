package com.dms.document.controller;

import com.dms.document.dto.DocumentResponseDto;
import com.dms.document.service.DiscoverDocumentSearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/search")
public class SearchController {
    private final DiscoverDocumentSearchService discoverDocumentSearchService;

    @GetMapping
    public ResponseEntity<Page<DocumentResponseDto>> searchDocuments(
            @RequestParam String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal Jwt jwt) {
        String username = jwt.getSubject();
        Pageable pageable = PageRequest.of(page, size);

        Page<DocumentResponseDto> results = discoverDocumentSearchService.searchDocuments(
                query,
                username,
                pageable
        );

        return ResponseEntity.ok(results);
    }

    @GetMapping("/suggestions")
    public ResponseEntity<List<String>> getSuggestions(
            @RequestParam String query,
            @AuthenticationPrincipal Jwt jwt) {
        String username = jwt.getSubject();

        List<String> suggestions = discoverDocumentSearchService.getSuggestions(query, username);
        return ResponseEntity.ok(suggestions);
    }

}