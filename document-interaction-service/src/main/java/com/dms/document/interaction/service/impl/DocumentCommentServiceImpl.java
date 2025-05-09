package com.dms.document.interaction.service.impl;

import com.dms.document.interaction.client.UserClient;
import com.dms.document.interaction.dto.CommentRequest;
import com.dms.document.interaction.dto.CommentResponse;
import com.dms.document.interaction.dto.UserResponse;
import com.dms.document.interaction.enums.AppRole;
import com.dms.document.interaction.enums.InteractionType;
import com.dms.document.interaction.enums.UserDocumentActionType;
import com.dms.document.interaction.exception.InvalidDocumentException;
import com.dms.document.interaction.model.CommentReport;
import com.dms.document.interaction.model.DocumentComment;
import com.dms.document.interaction.model.DocumentInformation;
import com.dms.document.interaction.model.DocumentUserHistory;
import com.dms.document.interaction.repository.CommentReportRepository;
import com.dms.document.interaction.repository.DocumentCommentRepository;
import com.dms.document.interaction.repository.DocumentRepository;
import com.dms.document.interaction.repository.DocumentUserHistoryRepository;
import com.dms.document.interaction.service.DocumentCommentService;
import com.dms.document.interaction.service.DocumentNotificationService;
import com.dms.document.interaction.service.DocumentPreferencesService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.InvalidDataAccessResourceUsageException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentCommentServiceImpl implements DocumentCommentService {
    private final UserClient userClient;
    private final DocumentCommentRepository documentCommentRepository;
    private final DocumentRepository documentRepository;
    private final DocumentNotificationService documentNotificationService;
    private final DocumentPreferencesService documentPreferencesService;
    private final DocumentUserHistoryRepository documentUserHistoryRepository;
    private final CommentReportRepository commentReportRepository;

    @Transactional(readOnly = true)
    @Override
    public Page<CommentResponse> getDocumentComments(String documentId, Pageable pageable, String username) {
        UserResponse userResponse = getUserByUsername(username);

        DocumentInformation documentInformation;
        if (userResponse.role().roleName().equals(AppRole.ROLE_ADMIN)) {
            documentInformation = documentRepository.findAccessibleDocumentById(documentId)
                    .orElseThrow(() -> new InvalidDocumentException("Document not found"));
        } else {
            documentInformation = documentRepository.findAccessibleDocumentByIdAndUserId(documentId, userResponse.userId().toString())
                    .orElseThrow(() -> new InvalidDocumentException("Document not found"));
        }

        // Get all comments with their replies using recursive query
        Page<DocumentComment> allComments = documentCommentRepository.findCommentsWithReplies(
                documentInformation.getId(),
                pageable
        );

        // Get all unique user IDs from all comments
        Set<UUID> userIds = allComments.stream()
                .map(DocumentComment::getUserId)
                .collect(Collectors.toSet());

        // Batch fetch user data
        Map<UUID, UserResponse> userMap = batchFetchUsers(userIds);

        // Get all comment reports by the current user for this document
        List<CommentReport> userReports = commentReportRepository.findReportsByUserAndDocument(
                userResponse.userId(), documentId, Boolean.FALSE
        );

        // Create a map of comment ID to report status
        Map<Long, CommentReport> commentReportMap = userReports.stream()
                .collect(Collectors.toMap(
                        CommentReport::getCommentId,
                        report -> report
                ));

        // Build comment tree structure, including report information
        List<CommentResponse> commentTree = buildCommentTree(allComments.getContent(), userMap, commentReportMap);

        return new PageImpl<>(commentTree, pageable, allComments.getTotalElements());
    }

    @Transactional
    @Override
    public CommentResponse createComment(String documentId, CommentRequest request, String username) {
        UserResponse userResponse = getUserByUsername(username);

        DocumentInformation documentInformation = documentRepository.findAccessibleDocumentByIdAndUserId(documentId, userResponse.userId().toString())
                .orElseThrow(() -> new InvalidDocumentException("Document not found"));

        // Check parent id is still valid
        if (Objects.nonNull(request.parentId())) {
            Optional<DocumentComment> parentComment = documentCommentRepository.findById(request.parentId());
            if (parentComment.isPresent() &&
                (parentComment.get().getFlag() == 0 || parentComment.get().getFlag() == -1)) {
                throw new InvalidDocumentException("PARENT_COMMENT_DELETED");
            }
        }

        DocumentComment comment = new DocumentComment();
        comment.setDocumentId(documentInformation.getId());
        comment.setUserId(userResponse.userId());
        comment.setContent(request.content());
        comment.setParentId(request.parentId());
        comment.setFlag(1);
        comment.setCreatedAt(Instant.now());

        DocumentComment savedComment = documentCommentRepository.save(comment);

        CompletableFuture.runAsync(() -> {
            // History
            documentUserHistoryRepository.save(DocumentUserHistory.builder()
                    .userId(userResponse.userId().toString())
                    .documentId(documentId)
                    .userDocumentActionType(UserDocumentActionType.COMMENT)
                    .version(documentInformation.getCurrentVersion())
                    .detail(comment.getContent())
                    .createdAt(Instant.now())
                    .build());

            // Only notify if this is a new commenter
            documentNotificationService.handleCommentNotification(
                    documentInformation,
                    username,
                    userResponse.userId(),
                    savedComment.getId()
            );

            documentPreferencesService.recordInteraction(userResponse.userId(), documentId, InteractionType.COMMENT);
        });

        return mapToCommentResponse(savedComment,
                Collections.singletonMap(userResponse.userId(), userResponse),
                Map.of());
    }

    @Transactional
    @Override
    public CommentResponse updateComment(String documentId, Long commentId, CommentRequest request, String username) {
        UserResponse userResponse = getUserByUsername(username);

        DocumentComment comment = documentCommentRepository.findByDocumentIdAndId(documentId, commentId)
                .orElseThrow(() -> new EntityNotFoundException("Comment not found"));

        if (!comment.getUserId().equals(userResponse.userId())) {
            throw new IllegalStateException("Not authorized to edit this comment");
        }

        comment.setContent(request.content());
        comment.setEdited(true);
        comment.setUpdatedAt(Instant.now());

        DocumentComment updatedComment = documentCommentRepository.save(comment);
        return mapToCommentResponse(updatedComment,
                Collections.singletonMap(userResponse.userId(), userResponse),
                Map.of());
    }

    @Transactional
    @Override
    public void deleteComment(String documentId, Long commentId, String username) {
        UserResponse userResponse = getUserByUsername(username);

        DocumentComment comment = documentCommentRepository.findByDocumentIdAndId(documentId, commentId)
                .orElseThrow(() -> new EntityNotFoundException("Comment not found"));

        if (!comment.getUserId().equals(userResponse.userId())) {
            throw new IllegalStateException("Not authorized to delete this comment");
        }

        // Fetch all descendant comments in a single query using recursive CTE
        List<Long> descendantIds = documentCommentRepository.findAllDescendantIds(commentId);

        // Bulk update all affected comments in a single transaction
        documentCommentRepository.markCommentsAsDeleted(descendantIds);
    }

    private Map<UUID, UserResponse> batchFetchUsers(Set<UUID> userIds) {
        try {
            ResponseEntity<List<UserResponse>> response = userClient.getUsersByIds(new ArrayList<>(userIds));
            if (response.getBody() != null) {
                return response.getBody().stream()
                        .collect(Collectors.toMap(
                                UserResponse::userId,
                                Function.identity(),
                                (existing, replacement) -> existing
                        ));
            }
        } catch (Exception e) {
            log.error("Error fetching user data", e);
        }
        return new HashMap<>();
    }

    private List<CommentResponse> buildCommentTree(
            List<DocumentComment> comments,
            Map<UUID, UserResponse> userMap,
            Map<Long, CommentReport> commentReportMap) {
        // Use LinkedHashMap to maintain order
        List<CommentResponse> rootComments = new ArrayList<>();

        // Single pass comment tree building
        for (DocumentComment comment : comments) {
            CommentResponse response = mapToCommentResponse(comment, userMap, commentReportMap);

            rootComments.add(response);
        }

        return rootComments;
    }

    private UserResponse getUserByUsername(String username) {
        ResponseEntity<UserResponse> response = userClient.getUserByUsername(username);
        if (!response.getStatusCode().is2xxSuccessful() || Objects.isNull(response.getBody())) {
            throw new InvalidDataAccessResourceUsageException("User not found");
        }
        return response.getBody();
    }

    private CommentResponse mapToCommentResponse(
            DocumentComment comment,
            Map<UUID, UserResponse> userMap,
            Map<Long, CommentReport> commentReportMap) {
        UserResponse user = userMap.get(comment.getUserId());

        // Check if this comment has been reported by the current user
        CommentReport userReport = commentReportMap.get(comment.getId());
        boolean reportedByUser = userReport != null;

        return CommentResponse.builder()
                .id(comment.getId())
                .content(comment.getContent())
                .username(user != null ? user.username() : "N/A")
                .createdAt(comment.getCreatedAt())
                .updatedAt(comment.getUpdatedAt())
                .edited(comment.isEdited())
                .flag(comment.getFlag())
                .parentId(comment.getParentId())
                .reportedByUser(reportedByUser)
                .build();
    }
}