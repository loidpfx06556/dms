package com.dms.document.repository;

import com.dms.document.model.DocumentInformation;
import com.dms.document.model.TagsResponse;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface DocumentRepository extends MongoRepository<DocumentInformation, String> {
    Optional<DocumentInformation> findByIdAndUserId(String id, String userId);

    @Query(value = "{'tags': {'$regex': ?0, '$options': 'i'}, 'deleted': {'$ne': true}}", fields = "{'_id': 0, 'tags': 1}")
    List<TagsResponse> findDistinctTagsByPattern(String pattern);

    @Query(value = "{'tags': {'$exists': true}, 'deleted': {'$ne': true}}", fields = "{'_id': 0, 'tags': 1}")
    List<TagsResponse> findAllTags();
}