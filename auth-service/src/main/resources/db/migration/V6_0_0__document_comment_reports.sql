-- Create comment reports table
CREATE TABLE comment_reports
(
    id               BIGSERIAL PRIMARY KEY,
    document_id      VARCHAR(255)             NOT NULL,
    comment_id       BIGINT                   NOT NULL,
    user_id          UUID                     NOT NULL,
    report_type_code VARCHAR(50)              NOT NULL,
    description      VARCHAR(1000),
    processed        BOOLEAN DEFAULT FALSE,
    status           VARCHAR(50)              NOT NULL,
    times            INTEGER                  NOT NULL,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_by       UUID,
    updated_at       TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_comment_reports_comment FOREIGN KEY (comment_id) REFERENCES document_comments (id)
);

-- Index for faster lookups
CREATE INDEX idx_comment_reports_document_id ON comment_reports (document_id);
CREATE INDEX idx_comment_reports_comment_id ON comment_reports (comment_id);
CREATE INDEX idx_comment_reports_user_id ON comment_reports (user_id);
CREATE INDEX idx_comment_reports_type_code ON comment_reports (report_type_code);