package com.dms.document.interaction.service.impl;

import com.dms.document.interaction.client.UserClient;
import com.dms.document.interaction.dto.CommentRequest;
import com.dms.document.interaction.dto.CommentResponse;
import com.dms.document.interaction.dto.RoleResponse;
import com.dms.document.interaction.dto.UserResponse;
import com.dms.document.interaction.enums.AppRole;
import com.dms.document.interaction.exception.InvalidDocumentException;
import com.dms.document.interaction.model.CommentReport;
import com.dms.document.interaction.model.DocumentComment;
import com.dms.document.interaction.model.DocumentInformation;
import com.dms.document.interaction.repository.CommentReportRepository;
import com.dms.document.interaction.repository.DocumentCommentRepository;
import com.dms.document.interaction.repository.DocumentRepository;
import com.dms.document.interaction.repository.DocumentUserHistoryRepository;
import com.dms.document.interaction.service.DocumentNotificationService;
import com.dms.document.interaction.service.DocumentPreferencesService;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.InvalidDataAccessResourceUsageException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class DocumentCommentServiceImplTest {

    @Mock
    private UserClient userClient;

    @Mock
    private DocumentCommentRepository documentCommentRepository;

    @Mock
    private DocumentRepository documentRepository;

    @Mock
    private DocumentNotificationService documentNotificationService;

    @Mock
    private DocumentPreferencesService documentPreferencesService;

    @Mock
    private DocumentUserHistoryRepository documentUserHistoryRepository;

    @Mock
    private CommentReportRepository commentReportRepository;

    @InjectMocks
    private DocumentCommentServiceImpl documentCommentService;

    private final String DOCUMENT_ID = "doc-123";
    private final String USERNAME = "testuser";
    private final UUID USER_ID = UUID.randomUUID();

    private UserResponse userResponse;
    private DocumentInformation documentInformation;
    private DocumentComment documentComment;

    @BeforeEach
    void setUp() {
        // Create common test data
        RoleResponse roleResponse = new RoleResponse(UUID.randomUUID(), AppRole.ROLE_USER);
        userResponse = new UserResponse(USER_ID, USERNAME, "user@example.com", roleResponse);

        documentInformation = DocumentInformation.builder()
                .id(DOCUMENT_ID)
                .userId(USER_ID.toString())
                .currentVersion(1)
                .build();

        documentComment = new DocumentComment();
        documentComment.setId(1L);
        documentComment.setDocumentId(DOCUMENT_ID);
        documentComment.setUserId(USER_ID);
        documentComment.setContent("Test comment");
        documentComment.setCreatedAt(Instant.now());
        documentComment.setFlag(1); // Active comment
        documentComment.setReplies(new ArrayList<>());
    }

    @Test
    void getDocumentComments_Success() {
        // Arrange
        Pageable pageable = Pageable.ofSize(10);
        List<DocumentComment> comments = Collections.singletonList(documentComment);
        Page<DocumentComment> commentPage = new PageImpl<>(comments, pageable, 1);

        when(userClient.getUserByUsername(USERNAME)).thenReturn(ResponseEntity.ok(userResponse));
        when(documentRepository.findAccessibleDocumentByIdAndUserId(DOCUMENT_ID, USER_ID.toString()))
                .thenReturn(Optional.of(documentInformation));
        when(documentCommentRepository.findCommentsWithReplies(eq(DOCUMENT_ID), any(Pageable.class)))
                .thenReturn(commentPage);
        when(userClient.getUsersByIds(anyList())).thenReturn(ResponseEntity.ok(List.of(userResponse)));
        when(commentReportRepository.findReportsByUserAndDocument(USER_ID, DOCUMENT_ID, false))
                .thenReturn(Collections.emptyList());

        // Act
        Page<CommentResponse> result = documentCommentService.getDocumentComments(DOCUMENT_ID, pageable, USERNAME);

        // Assert
        assertNotNull(result);
        assertEquals(1, result.getTotalElements());
        assertEquals(1, result.getContent().size());
        assertEquals(documentComment.getContent(), result.getContent().get(0).getContent());

        verify(documentRepository).findAccessibleDocumentByIdAndUserId(DOCUMENT_ID, USER_ID.toString());
        verify(documentCommentRepository).findCommentsWithReplies(eq(DOCUMENT_ID), eq(pageable));
    }

    @Test
    void getDocumentComments_DocumentNotFound() {
        // Arrange
        Pageable pageable = Pageable.ofSize(10);

        when(userClient.getUserByUsername(USERNAME)).thenReturn(ResponseEntity.ok(userResponse));
        when(documentRepository.findAccessibleDocumentByIdAndUserId(DOCUMENT_ID, USER_ID.toString()))
                .thenReturn(Optional.empty());

        // Act & Assert
        assertThrows(InvalidDocumentException.class, () ->
                documentCommentService.getDocumentComments(DOCUMENT_ID, pageable, USERNAME)
        );

        verify(documentRepository).findAccessibleDocumentByIdAndUserId(DOCUMENT_ID, USER_ID.toString());
        verify(documentCommentRepository, never()).findCommentsWithReplies(anyString(), any(Pageable.class));
    }

    @Test
    void getDocumentComments_WithReportedComments() {
        // Arrange
        Pageable pageable = Pageable.ofSize(10);
        List<DocumentComment> comments = Collections.singletonList(documentComment);
        Page<DocumentComment> commentPage = new PageImpl<>(comments, pageable, 1);

        CommentReport report = new CommentReport();
        report.setCommentId(documentComment.getId());
        List<CommentReport> reports = Collections.singletonList(report);

        when(userClient.getUserByUsername(USERNAME)).thenReturn(ResponseEntity.ok(userResponse));
        when(documentRepository.findAccessibleDocumentByIdAndUserId(DOCUMENT_ID, USER_ID.toString()))
                .thenReturn(Optional.of(documentInformation));
        when(documentCommentRepository.findCommentsWithReplies(eq(DOCUMENT_ID), any(Pageable.class)))
                .thenReturn(commentPage);
        when(userClient.getUsersByIds(anyList())).thenReturn(ResponseEntity.ok(List.of(userResponse)));
        when(commentReportRepository.findReportsByUserAndDocument(USER_ID, DOCUMENT_ID, false))
                .thenReturn(reports);

        // Act
        Page<CommentResponse> result = documentCommentService.getDocumentComments(DOCUMENT_ID, pageable, USERNAME);

        // Assert
        assertNotNull(result);
        assertEquals(1, result.getTotalElements());
        assertEquals(1, result.getContent().size());
        assertTrue(result.getContent().get(0).isReportedByUser());
    }

    @Test
    void createComment_Success() {
        // Arrange
        CommentRequest request = new CommentRequest("New comment", null);

        when(userClient.getUserByUsername(USERNAME)).thenReturn(ResponseEntity.ok(userResponse));
        when(documentRepository.findAccessibleDocumentByIdAndUserId(DOCUMENT_ID, USER_ID.toString()))
                .thenReturn(Optional.of(documentInformation));
        when(documentCommentRepository.save(any(DocumentComment.class))).thenAnswer(invocation -> {
            DocumentComment saved = invocation.getArgument(0);
            saved.setId(1L);
            return saved;
        });

        // Act
        CommentResponse result = documentCommentService.createComment(DOCUMENT_ID, request, USERNAME);

        // Assert
        assertNotNull(result);
        assertEquals(request.content(), result.getContent());

        ArgumentCaptor<DocumentComment> commentCaptor = ArgumentCaptor.forClass(DocumentComment.class);
        verify(documentCommentRepository).save(commentCaptor.capture());

        DocumentComment savedComment = commentCaptor.getValue();
        assertEquals(DOCUMENT_ID, savedComment.getDocumentId());
        assertEquals(USER_ID, savedComment.getUserId());
        assertEquals(request.content(), savedComment.getContent());
        assertEquals(request.parentId(), savedComment.getParentId());
        assertEquals(1, savedComment.getFlag());
    }

    @Test
    void createComment_WithDeletedParent() {
        // Arrange
        Long parentId = 2L;
        CommentRequest request = new CommentRequest("Reply to deleted comment", parentId);

        DocumentComment parentComment = new DocumentComment();
        parentComment.setId(parentId);
        parentComment.setFlag(0); // Deleted comment

        when(userClient.getUserByUsername(USERNAME)).thenReturn(ResponseEntity.ok(userResponse));
        when(documentRepository.findAccessibleDocumentByIdAndUserId(DOCUMENT_ID, USER_ID.toString()))
                .thenReturn(Optional.of(documentInformation));
        when(documentCommentRepository.findById(parentId)).thenReturn(Optional.of(parentComment));

        // Act & Assert
        assertThrows(InvalidDocumentException.class, () ->
                documentCommentService.createComment(DOCUMENT_ID, request, USERNAME)
        );
    }

    @Test
    void createComment_WithFlaggedParent() {
        // Arrange
        Long parentId = 2L;
        CommentRequest request = new CommentRequest("Reply to flagged comment", parentId);

        DocumentComment parentComment = new DocumentComment();
        parentComment.setId(parentId);
        parentComment.setFlag(-1); // Flagged as deleted by report

        when(userClient.getUserByUsername(USERNAME)).thenReturn(ResponseEntity.ok(userResponse));
        when(documentRepository.findAccessibleDocumentByIdAndUserId(DOCUMENT_ID, USER_ID.toString()))
                .thenReturn(Optional.of(documentInformation));
        when(documentCommentRepository.findById(parentId)).thenReturn(Optional.of(parentComment));

        // Act & Assert
        assertThrows(InvalidDocumentException.class, () ->
                documentCommentService.createComment(DOCUMENT_ID, request, USERNAME)
        );
    }

    @Test
    void updateComment_Success() {
        // Arrange
        Long commentId = 1L;
        CommentRequest request = new CommentRequest("Updated comment", null);

        when(userClient.getUserByUsername(USERNAME)).thenReturn(ResponseEntity.ok(userResponse));
        when(documentCommentRepository.findByDocumentIdAndId(DOCUMENT_ID, commentId))
                .thenReturn(Optional.of(documentComment));
        when(documentCommentRepository.save(any(DocumentComment.class))).thenReturn(documentComment);

        // Act
        CommentResponse result = documentCommentService.updateComment(DOCUMENT_ID, commentId, request, USERNAME);

        // Assert
        assertNotNull(result);

        ArgumentCaptor<DocumentComment> commentCaptor = ArgumentCaptor.forClass(DocumentComment.class);
        verify(documentCommentRepository).save(commentCaptor.capture());

        DocumentComment updatedComment = commentCaptor.getValue();
        assertEquals(request.content(), updatedComment.getContent());
        assertTrue(updatedComment.isEdited());
    }

    @Test
    void updateComment_NotFound() {
        // Arrange
        Long commentId = 1L;
        CommentRequest request = new CommentRequest("Updated comment", null);

        when(userClient.getUserByUsername(USERNAME)).thenReturn(ResponseEntity.ok(userResponse));
        when(documentCommentRepository.findByDocumentIdAndId(DOCUMENT_ID, commentId))
                .thenReturn(Optional.empty());

        // Act & Assert
        assertThrows(EntityNotFoundException.class, () ->
                documentCommentService.updateComment(DOCUMENT_ID, commentId, request, USERNAME)
        );
    }

    @Test
    void updateComment_NotAuthorized() {
        // Arrange
        Long commentId = 1L;
        CommentRequest request = new CommentRequest("Updated comment", null);

        UUID differentUserId = UUID.randomUUID();
        documentComment.setUserId(differentUserId); // Different user

        when(userClient.getUserByUsername(USERNAME)).thenReturn(ResponseEntity.ok(userResponse));
        when(documentCommentRepository.findByDocumentIdAndId(DOCUMENT_ID, commentId))
                .thenReturn(Optional.of(documentComment));

        // Act & Assert
        assertThrows(IllegalStateException.class, () ->
                documentCommentService.updateComment(DOCUMENT_ID, commentId, request, USERNAME)
        );
    }

    @Test
    void deleteComment_Success() {
        // Arrange
        Long commentId = 1L;
        List<Long> descendantIds = Arrays.asList(commentId, 2L, 3L);

        when(userClient.getUserByUsername(USERNAME)).thenReturn(ResponseEntity.ok(userResponse));
        when(documentCommentRepository.findByDocumentIdAndId(DOCUMENT_ID, commentId))
                .thenReturn(Optional.of(documentComment));
        when(documentCommentRepository.findAllDescendantIds(commentId)).thenReturn(descendantIds);
        doNothing().when(documentCommentRepository).markCommentsAsDeleted(descendantIds);

        // Act
        documentCommentService.deleteComment(DOCUMENT_ID, commentId, USERNAME);

        // Assert
        verify(documentCommentRepository).findByDocumentIdAndId(DOCUMENT_ID, commentId);
        verify(documentCommentRepository).findAllDescendantIds(commentId);
        verify(documentCommentRepository).markCommentsAsDeleted(descendantIds);
    }

    @Test
    void deleteComment_NotFound() {
        // Arrange
        Long commentId = 1L;

        when(userClient.getUserByUsername(USERNAME)).thenReturn(ResponseEntity.ok(userResponse));
        when(documentCommentRepository.findByDocumentIdAndId(DOCUMENT_ID, commentId))
                .thenReturn(Optional.empty());

        // Act & Assert
        assertThrows(EntityNotFoundException.class, () ->
                documentCommentService.deleteComment(DOCUMENT_ID, commentId, USERNAME)
        );
    }

    @Test
    void deleteComment_NotAuthorized() {
        // Arrange
        Long commentId = 1L;

        UUID differentUserId = UUID.randomUUID();
        documentComment.setUserId(differentUserId); // Different user

        when(userClient.getUserByUsername(USERNAME)).thenReturn(ResponseEntity.ok(userResponse));
        when(documentCommentRepository.findByDocumentIdAndId(DOCUMENT_ID, commentId))
                .thenReturn(Optional.of(documentComment));

        // Act & Assert
        assertThrows(IllegalStateException.class, () ->
                documentCommentService.deleteComment(DOCUMENT_ID, commentId, USERNAME)
        );
    }

    @Test
    void getUserByUsername_UserNotFound() {
        // Arrange
        when(userClient.getUserByUsername(USERNAME)).thenReturn(ResponseEntity.ok(null));

        // Act & Assert
        assertThrows(InvalidDataAccessResourceUsageException.class, () ->
                documentCommentService.getDocumentComments(DOCUMENT_ID, Pageable.ofSize(10), USERNAME)
        );
    }

    @Test
    void getDocumentComments_AdminAccess() {
        // Arrange
        Pageable pageable = Pageable.ofSize(10);
        List<DocumentComment> comments = Collections.singletonList(documentComment);
        Page<DocumentComment> commentPage = new PageImpl<>(comments, pageable, 1);

        // Create admin user
        RoleResponse adminRole = new RoleResponse(UUID.randomUUID(), AppRole.ROLE_ADMIN);
        UserResponse adminUser = new UserResponse(UUID.randomUUID(), "admin", "admin@example.com", adminRole);

        when(userClient.getUserByUsername("admin")).thenReturn(ResponseEntity.ok(adminUser));
        when(documentRepository.findAccessibleDocumentById(DOCUMENT_ID))
                .thenReturn(Optional.of(documentInformation));
        when(documentCommentRepository.findCommentsWithReplies(eq(DOCUMENT_ID), any(Pageable.class)))
                .thenReturn(commentPage);
        when(userClient.getUsersByIds(anyList())).thenReturn(ResponseEntity.ok(List.of(userResponse)));
        when(commentReportRepository.findReportsByUserAndDocument(any(), eq(DOCUMENT_ID), eq(false)))
                .thenReturn(Collections.emptyList());

        // Act
        Page<CommentResponse> result = documentCommentService.getDocumentComments(DOCUMENT_ID, pageable, "admin");

        // Assert
        assertNotNull(result);
        assertEquals(1, result.getTotalElements());

        // Verify admin path was used
        verify(documentRepository).findAccessibleDocumentById(DOCUMENT_ID);
    }
}