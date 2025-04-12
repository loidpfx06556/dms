package com.dms.processor.service.impl;

import com.dms.processor.dto.NotificationEventRequest;
import com.dms.processor.enums.CommentReportStatus;
import com.dms.processor.enums.DocumentReportStatus;
import com.dms.processor.enums.NotificationType;
import com.dms.processor.enums.SharingType;
import com.dms.processor.model.DocumentComment;
import com.dms.processor.model.DocumentInformation;
import com.dms.processor.model.User;
import com.dms.processor.repository.*;
import jakarta.mail.MessagingException;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class DocumentEmailServiceImplTest {

    @Mock
    private DocumentRepository documentRepository;

    @Mock
    private DocumentFavoriteRepository documentFavoriteRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private DocumentReportRepository documentReportRepository;

    @Mock
    private CommentReportRepository commentReportRepository;

    @Mock
    private DocumentCommentRepository documentCommentRepository;

    @Mock
    private JavaMailSender mailSender;

    @Mock
    private TemplateEngine templateEngine;

    @Spy
    @InjectMocks
    private DocumentEmailServiceImpl documentEmailService;

    private static final String BASE_URL = "http://test-base-url.com";
    private static final String FROM_EMAIL = "test@example.com";

    private DocumentInformation testDocument;
    private User testUser;
    private User testCreator;
    private NotificationEventRequest testNotificationEvent;
    private DocumentComment testComment;
    private UUID testUserId;
    private UUID testCreatorId;
    private String testDocumentId;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(documentEmailService, "baseUrl", BASE_URL);
        ReflectionTestUtils.setField(documentEmailService, "fromEmail", FROM_EMAIL);
        ReflectionTestUtils.setField(documentEmailService, "batchSize", 10);

        testUserId = UUID.randomUUID();
        testCreatorId = UUID.randomUUID();
        testDocumentId = "test-document-id";

        testUser = new User();
        testUser.setUserId(testUserId);
        testUser.setUsername("testUser");
        testUser.setEmail("testuser@example.com");

        testCreator = new User();
        testCreator.setUserId(testCreatorId);
        testCreator.setUsername("testCreator");
        testCreator.setEmail("testcreator@example.com");

        testDocument = DocumentInformation.builder()
                .id(testDocumentId)
                .filename("Test Document")
                .userId(testCreatorId.toString())
                .sharingType(SharingType.PUBLIC)
                .createdAt(Instant.now())
                .build();

        testNotificationEvent = NotificationEventRequest.builder()
                .documentId(testDocumentId)
                .triggerUserId(testUserId.toString())
                .notificationType(NotificationType.NEW_COMMENT_FROM_NEW_USER)
                .build();

        testComment = new DocumentComment();
        testComment.setId(1L);
        testComment.setDocumentId(testDocumentId);
        testComment.setUserId(testUserId);
        testComment.setContent("Test comment");

        Properties props = new Properties();
        Session session = Session.getDefaultInstance(props, null);
        MimeMessage mimeMessage = new MimeMessage(session);
        lenient().when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
        lenient().when(templateEngine.process(anyString(), any(Context.class))).thenReturn("<html>Test Email</html>");
    }

    @Test
    void sendNotifyForRelatedUserInDocument_SendsEmails_WhenUsersExist() throws MessagingException {
        when(documentRepository.findById(testDocumentId)).thenReturn(Optional.of(testDocument));
        when(userRepository.findByUsername(testUserId.toString())).thenReturn(Optional.of(testUser));
        Set<UUID> favoriteUserIds = new HashSet<>(Collections.singletonList(UUID.randomUUID()));
        when(documentFavoriteRepository.findUserIdsByDocumentId(testDocumentId)).thenReturn(favoriteUserIds);
        User favoriteUser = new User(UUID.randomUUID(), "favoriteUser", "favorite@example.com");
        when(userRepository.findUsersByUserIdIn(favoriteUserIds)).thenReturn(Collections.singletonList(favoriteUser));
        doNothing().when(documentEmailService).sendBatchNotificationEmails(anySet(), anyString(), anyString(), any());

        documentEmailService.sendNotifyForRelatedUserInDocument(testNotificationEvent);

        verify(documentEmailService).sendBatchNotificationEmails(anySet(), anyString(), eq("new-comment-notification"), any());
    }

    @Test
    void sendNotifyForRelatedUserInDocument_LogsNoUsers_WhenNoFavorites() {
        when(documentRepository.findById(testDocumentId)).thenReturn(Optional.of(testDocument));
        when(userRepository.findByUsername(testUserId.toString())).thenReturn(Optional.of(testUser));
        when(documentFavoriteRepository.findUserIdsByDocumentId(testDocumentId)).thenReturn(Collections.emptySet());

        documentEmailService.sendNotifyForRelatedUserInDocument(testNotificationEvent);

        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    @Test
    void sendNotifyForRelatedUserInDocument_ThrowsException_WhenDocumentNotFound() {
        when(documentRepository.findById(testDocumentId)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> documentEmailService.sendNotifyForRelatedUserInDocument(testNotificationEvent));
    }

    @Test
    void sendDocumentReportRejectionNotifications_SendsEmails_WhenReportersExist() throws MessagingException {
        String rejecterId = testUserId.toString();
        Set<UUID> reporterIds = new HashSet<>(Collections.singletonList(UUID.randomUUID()));
        when(documentReportRepository.findReporterUserIdsByDocumentIdAndStatusAndTimes(testDocumentId, DocumentReportStatus.REJECTED, 1))
                .thenReturn(reporterIds);
        User reporter = new User(reporterIds.iterator().next(), "reporter", "reporter@example.com");
        when(userRepository.findUsersByUserIdIn(reporterIds)).thenReturn(Collections.singletonList(reporter));
        when(userRepository.findById(testUserId)).thenReturn(Optional.of(testUser));
        doNothing().when(documentEmailService).sendBatchNotificationEmails(anySet(), anyString(), anyString(), any());

        documentEmailService.sendDocumentReportRejectionNotifications(testDocument, rejecterId, 1);

        verify(documentEmailService).sendBatchNotificationEmails(anySet(), anyString(), eq("document-report-rejected-reporter-notification"), any());
    }

    @Test
    void sendDocumentReportRejectionNotifications_LogsNoReporters_WhenNoneExist() {
        when(documentReportRepository.findReporterUserIdsByDocumentIdAndStatusAndTimes(testDocumentId, DocumentReportStatus.REJECTED, 1))
                .thenReturn(Collections.emptySet());

        documentEmailService.sendDocumentReportRejectionNotifications(testDocument, testUserId.toString(), 1);

        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    @Test
    void sendResolveNotifications_SendsToAll_WhenDataExists() throws MessagingException {
        String resolverId = testUserId.toString();
        when(userRepository.findById(testCreatorId)).thenReturn(Optional.of(testCreator));
        Set<UUID> reporterIds = new HashSet<>(Collections.singletonList(UUID.randomUUID()));
        when(documentReportRepository.findReporterUserIdsByDocumentIdAndStatusAndTimes(testDocumentId, DocumentReportStatus.RESOLVED, 1))
                .thenReturn(reporterIds);
        User reporter = new User(reporterIds.iterator().next(), "reporter", "reporter@example.com");
        when(userRepository.findUsersByUserIdIn(reporterIds)).thenReturn(Collections.singletonList(reporter));
        Set<UUID> favoriterIds = new HashSet<>(Collections.singletonList(UUID.randomUUID()));
        when(documentFavoriteRepository.findUserIdsByDocumentId(testDocumentId)).thenReturn(favoriterIds);
        User favoriter = new User(favoriterIds.iterator().next(), "favoriter", "favoriter@example.com");
        when(userRepository.findUsersByUserIdIn(favoriterIds)).thenReturn(Collections.singletonList(favoriter));
        when(userRepository.findById(testUserId)).thenReturn(Optional.of(testUser));
        doNothing().when(documentEmailService).sendEmail(anyString(), anyString(), anyString());
        doNothing().when(documentEmailService).sendBatchNotificationEmails(anySet(), anyString(), anyString(), any());

        documentEmailService.sendResolveNotifications(testDocument, resolverId, 1);

        verify(documentEmailService).sendEmail(eq(testCreator.getEmail()), anyString(), anyString());
        verify(documentEmailService, times(2)).sendBatchNotificationEmails(anySet(), anyString(), anyString(), any());
    }

    @Test
    void sendResolveNotifications_HandlesNoCreator() throws MessagingException {
        String resolverId = testUserId.toString();
        when(userRepository.findById(testCreatorId)).thenReturn(Optional.empty());
        when(documentReportRepository.findReporterUserIdsByDocumentIdAndStatusAndTimes(testDocumentId, DocumentReportStatus.RESOLVED, 1))
                .thenReturn(Collections.emptySet());
        when(documentFavoriteRepository.findUserIdsByDocumentId(testDocumentId)).thenReturn(Collections.emptySet());
        when(userRepository.findById(testUserId)).thenReturn(Optional.of(testUser));

        documentEmailService.sendResolveNotifications(testDocument, resolverId, 1);

        verify(documentEmailService, never()).sendEmail(anyString(), anyString(), anyString());
    }

    @Test
    void sendReportRemediationNotifications_SendsEmails_WhenDataExists() throws MessagingException {
        String remediatorId = testUserId.toString();
        when(userRepository.findById(testCreatorId)).thenReturn(Optional.of(testCreator));
        Set<UUID> favoriterIds = new HashSet<>(Collections.singletonList(UUID.randomUUID()));
        when(documentFavoriteRepository.findUserIdsByDocumentId(testDocumentId)).thenReturn(favoriterIds);
        User favoriter = new User(favoriterIds.iterator().next(), "favoriter", "favoriter@example.com");
        when(userRepository.findUsersByUserIdIn(favoriterIds)).thenReturn(Collections.singletonList(favoriter));
        when(userRepository.findById(testUserId)).thenReturn(Optional.of(testUser));
        doNothing().when(documentEmailService).sendEmail(anyString(), anyString(), anyString());
        doNothing().when(documentEmailService).sendBatchNotificationEmails(anySet(), anyString(), anyString(), any());

        documentEmailService.sendReportRemediationNotifications(testDocument, remediatorId);

        verify(documentEmailService).sendEmail(eq(testCreator.getEmail()), anyString(), anyString());
        verify(documentEmailService).sendBatchNotificationEmails(anySet(), anyString(), eq("document-report-remediated-notification"), any());
    }

    @Test
    void sendCommentReportProcessNotification_SendsResolved_WhenCommentRemoved() throws MessagingException {
        testNotificationEvent.setCommentId(1L);
        testNotificationEvent.setVersionNumber(1);
        testComment.setFlag(-1);
        when(documentRepository.findById(testDocumentId)).thenReturn(Optional.of(testDocument));
        when(documentCommentRepository.findByDocumentIdAndId(testDocumentId, 1L)).thenReturn(Optional.of(testComment));
        when(userRepository.findById(testUserId)).thenReturn(Optional.of(testUser));
        Set<UUID> reporterIds = new HashSet<>(Collections.singletonList(UUID.randomUUID()));
        when(commentReportRepository.findReporterUserIdsByCommentIdAndStatusAndTimes(1L, CommentReportStatus.RESOLVED, 1))
                .thenReturn(reporterIds);
        User reporter = new User(reporterIds.iterator().next(), "reporter", "reporter@example.com");
        when(userRepository.findUsersByUserIdIn(reporterIds)).thenReturn(Collections.singletonList(reporter));
        doNothing().when(documentEmailService).sendEmail(anyString(), anyString(), anyString());
        doNothing().when(documentEmailService).sendBatchNotificationEmails(anySet(), anyString(), anyString(), any());

        documentEmailService.sendCommentReportProcessNotification(testNotificationEvent);

        verify(documentEmailService).sendEmail(eq(testUser.getEmail()), anyString(), anyString());
        verify(documentEmailService).sendBatchNotificationEmails(anySet(), anyString(), eq("comment-report-resolved-reporter-notification"), any());
    }

    @Test
    void sendCommentReportProcessNotification_SendsRejected_WhenCommentNotRemoved() throws MessagingException {
        testNotificationEvent.setCommentId(1L);
        testNotificationEvent.setVersionNumber(1);
        testComment.setFlag(1);
        when(documentRepository.findById(testDocumentId)).thenReturn(Optional.of(testDocument));
        when(documentCommentRepository.findByDocumentIdAndId(testDocumentId, 1L)).thenReturn(Optional.of(testComment));
        when(userRepository.findById(testUserId)).thenReturn(Optional.of(testUser));
        Set<UUID> reporterIds = new HashSet<>(Collections.singletonList(UUID.randomUUID()));
        when(commentReportRepository.findReporterUserIdsByCommentIdAndStatusAndTimes(1L, CommentReportStatus.REJECTED, 1))
                .thenReturn(reporterIds);
        User reporter = new User(reporterIds.iterator().next(), "reporter", "reporter@example.com");
        when(userRepository.findUsersByUserIdIn(reporterIds)).thenReturn(Collections.singletonList(reporter));
        doNothing().when(documentEmailService).sendBatchNotificationEmails(anySet(), anyString(), anyString(), any());

        documentEmailService.sendCommentReportProcessNotification(testNotificationEvent);

        verify(documentEmailService).sendBatchNotificationEmails(anySet(), anyString(), eq("comment-report-rejected-reporter-notification"), any());
    }

    @Test
    void sendCommentReportProcessNotification_ThrowsException_WhenCommentNotFound() {
        testNotificationEvent.setCommentId(1L);
        when(documentRepository.findById(testDocumentId)).thenReturn(Optional.of(testDocument));
        when(documentCommentRepository.findByDocumentIdAndId(testDocumentId, 1L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> documentEmailService.sendCommentReportProcessNotification(testNotificationEvent));
    }

    @Test
    void buildNotificationContext_CoversAllNotificationTypes() {
        NotificationEventRequest newFileEvent = NotificationEventRequest.builder()
                .documentId(testDocumentId)
                .triggerUserId(testUserId.toString())
                .notificationType(NotificationType.NEW_FILE_VERSION)
                .versionNumber(2)
                .build();
        NotificationEventRequest revertedEvent = NotificationEventRequest.builder()
                .documentId(testDocumentId)
                .triggerUserId(testUserId.toString())
                .notificationType(NotificationType.DOCUMENT_REVERTED)
                .versionNumber(1)
                .build();

        Map<String, User> emailMap = Collections.singletonMap(testUser.getEmail(), testUser);
        documentEmailService.buildNotificationContext(testNotificationEvent, testDocument, testUser, emailMap);
        documentEmailService.buildNotificationContext(newFileEvent, testDocument, testUser, emailMap);
        documentEmailService.buildNotificationContext(revertedEvent, testDocument, testUser, emailMap);

        // No assertions needed; this ensures all switch branches are covered
    }

    @Test
    void sendEmail_HandlesMessagingException() {
        // Arrange
        // Mock the MimeMessage creation
        MimeMessage mimeMessage = mock(MimeMessage.class);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        // Use doAnswer to throw MessagingException when send is called
        doAnswer(invocation -> {
            throw new MessagingException("Test error");
        }).when(mailSender).send(any(MimeMessage.class));

        // Act
        try {
            documentEmailService.sendEmail("test@example.com", "Subject", "<html>Content</html>");
            fail("Expected MessagingException to be thrown");
        } catch (MessagingException e) {
            // Assert
            assertEquals("Test error", e.getMessage(), "Exception message should match");
        }

        // Verify
        verify(mailSender, times(1)).send(any(MimeMessage.class));
    }
}