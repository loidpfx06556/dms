package com.dms.processor.model;

import com.dms.processor.enums.DocumentStatus;
import com.dms.processor.enums.DocumentType;
import com.dms.processor.enums.SharingType;
import lombok.Builder;
import lombok.Data;
import org.apache.commons.collections4.CollectionUtils;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.*;

@Data
@Builder
@Document(collection = "documents")
public class DocumentInformation {
    @Id
    private String id;

    @Field("filename")
    private String filename;

    @Field("file_path")
    private String filePath;

    @Field("thumbnail_path")
    private String thumbnailPath;

    @Field("file_size")
    private Long fileSize;

    @Field("mime_type")
    private String mimeType;

    @Field("status")
    private DocumentStatus status;

    @Field("content")
    private String content;

    @Field("language")
    private String language;

    @Field("summary")
    private String summary;

    @Indexed
    @Field("document_type")
    private DocumentType documentType;

    @Indexed
    @Field("major")
    private String major;

    @Indexed
    @Field("course_code")
    private String courseCode;

    @Indexed
    @Field("course_level")
    private String courseLevel;

    @Indexed
    @Field("category")
    private String category;

    @Indexed
    @Field("tags")
    private Set<String> tags;

    @Field("extracted_metadata")
    private Map<String, String> extractedMetadata;

    @Field("user_id")
    private String userId;

    @Field("sharing_type")
    private SharingType sharingType;

    @Field("shared_with")
    private Set<String> sharedWith;

    @Field("deleted")
    private boolean deleted;

    @Field("processing_error")
    private String processingError;

    @Field("current_version")
    private Integer currentVersion;

    @Field("versions")
    @Indexed
    private List<DocumentVersion> versions;

    @Field("created_at")
    private Instant createdAt;

    @Field("updated_at")
    private Instant updatedAt;

    @Field("created_by")
    private String createdBy;

    @Field("updated_by")
    private String updatedBy;

    public Optional<DocumentVersion> getLatestVersion() {
        if (CollectionUtils.isEmpty(versions)) {
            return Optional.empty();
        }
        return versions.stream()
                .max(Comparator.comparing(DocumentVersion::getVersionNumber));
    }

    public Optional<DocumentVersion> getVersion(Integer versionNumber) {
        if (CollectionUtils.isEmpty(versions)) {
            return Optional.empty();
        }
        return versions.stream()
                .filter(v -> v.getVersionNumber().equals(versionNumber))
                .findFirst();
    }
}