package com.dms.document.search.service;

import com.dms.document.search.client.UserClient;
import com.dms.document.search.dto.DocumentSearchCriteria;
import com.dms.document.search.dto.UserDto;
import com.dms.document.search.model.DocumentInformation;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.lang3.StringUtils;
import org.springframework.dao.InvalidDataAccessResourceUsageException;
import org.springframework.data.domain.*;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class DocumentService {
    private final MongoTemplate mongoTemplate;
    private final UserClient userClient;

    public Page<DocumentInformation> getUserDocuments(String username, DocumentSearchCriteria criteria, int page, int size) {
        ResponseEntity<UserDto> response = userClient.getUserByUsername(username);
        if (!response.getStatusCode().is2xxSuccessful() || Objects.isNull(response.getBody())) {
            throw new InvalidDataAccessResourceUsageException("User not found");
        }
        UserDto userDto = response.getBody();

        // Build the query criteria
        Criteria baseCriteria = Criteria.where("deleted").ne(true);

        // Build access criteria combining owned and shared documents
        Criteria accessCriteria = new Criteria().orOperator(
                // Documents owned by user
                Criteria.where("userId").is(userDto.getUserId().toString()),

                // Documents specifically shared with user
                new Criteria().andOperator(
                        Criteria.where("sharingType").is("SPECIFIC"),
                        Criteria.where("sharedWith").in(userDto.getUserId().toString())
                )
        );

        Criteria queryCriteria = new Criteria().andOperator(baseCriteria, accessCriteria);

        // Add search criteria if provided
        if (StringUtils.isNotBlank(criteria.getSearch())) {
            Criteria searchCriteria = new Criteria().orOperator(
                    Criteria.where("originalFilename").regex(criteria.getSearch(), "i"),
                    Criteria.where("content").regex(criteria.getSearch(), "i"),
                    Criteria.where("courseCode").regex(criteria.getSearch(), "i"),
                    Criteria.where("tags").regex(criteria.getSearch(), "i")
            );
            queryCriteria.andOperator(searchCriteria);
        }

        // Add filters if provided
        if (StringUtils.isNotBlank(criteria.getMajor())) {
            queryCriteria.and("major").is(criteria.getMajor());
        }
        if (StringUtils.isNotBlank(criteria.getLevel())) {
            queryCriteria.and("courseLevel").is(criteria.getLevel());
        }
        if (StringUtils.isNotBlank(criteria.getCategory())) {
            queryCriteria.and("category").is(criteria.getCategory());
        }

        // Add tag filter if provided
        if (CollectionUtils.isNotEmpty(criteria.getTags())) {
            queryCriteria.and("tags").all(criteria.getTags());
        }

        // Create pageable with sort
        Sort sort = Sort.by(Sort.Direction.fromString(criteria.getSortDirection()), criteria.getSortField());
        Pageable pageable = PageRequest.of(page, size, sort);

        // Execute query
        Query countQuery = new Query(queryCriteria);
        long total = mongoTemplate.count(countQuery, DocumentInformation.class);

        Query query = new Query(queryCriteria)
                .with(pageable);
        List<DocumentInformation> documents = mongoTemplate.find(query, DocumentInformation.class);

        return new PageImpl<>(
                documents.stream()
                        .peek(d -> d.setContent(null))
                        .toList(),
                pageable,
                total
        );
    }
}
