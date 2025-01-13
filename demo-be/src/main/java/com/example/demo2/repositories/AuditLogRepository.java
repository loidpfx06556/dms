package com.example.demo2.repositories;


import com.example.demo2.models.interfaces.LoginAttemptStats;
import com.example.demo2.models.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long>, JpaSpecificationExecutor<AuditLog> {

    @Query(value = """
        SELECT DATE(a.timestamp) as date,
               COUNT(CASE WHEN a.status = 'SUCCESS' THEN 1 END) as successCount,
               COUNT(CASE WHEN a.status = 'FAILURE' THEN 1 END) as failureCount
        FROM audit_logs a
        WHERE a.action = 'LOGIN'
        AND a.timestamp >= :startDate
        GROUP BY DATE(a.timestamp)
        ORDER BY DATE(a.timestamp) DESC
        """, nativeQuery = true)
    List<LoginAttemptStats> getLoginAttemptStats(LocalDateTime startDate);
}
