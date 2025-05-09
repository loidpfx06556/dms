package com.dms.document.search.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.Map;
import java.util.Set;

@Data
@Document(collection = "document_preferences")
public class DocumentPreferences {
    @Id
    private String id;

    @Indexed(unique = true)
    @Field("user_id")
    private String userId;

    @Field("preferred_majors")
    private Set<String> preferredMajors;

    @Field("preferred_course_codes")
    private Set<String> preferredCourseCodes;

    @Field("preferred_levels")
    private Set<String> preferredLevels;

    @Field("preferred_categories")
    private Set<String> preferredCategories;

    @Field("preferred_tags")
    private Set<String> preferredTags;

    @Field("language_preferences")
    private Set<String> languagePreferences;

    // Weighted scores for different content types (0-1)
    @Field("content_type_weights")
    private Map<String, Double> contentTypeWeights;

    // Interaction history aggregates
    @Field("major_interaction_counts")
    private Map<String, Integer> majorInteractionCounts;

    @Field("course_code_interaction_counts")
    private Map<String, Integer> courseCodeInteractionCounts;

    @Field("level_interaction_counts")
    private Map<String, Integer> levelInteractionCounts;

    @Field("category_interaction_counts")
    private Map<String, Integer> categoryInteractionCounts;

    @Field("tag_interaction_counts")
    private Map<String, Integer> tagInteractionCounts;

    @Field("recent_viewed_documents")
    private Set<String> recentViewedDocuments;

    @Field("created_at")
    private Instant createdAt;

    @Field("updated_at")
    private Instant updatedAt;
}