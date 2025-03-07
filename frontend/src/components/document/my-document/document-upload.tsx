import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { DocumentForm, DocumentFormValues } from "@/components/document/document-form";
import { useProcessing } from "@/context/processing-provider";
import { useToast } from "@/hooks/use-toast";
import { documentService } from "@/services/document.service";

interface DocumentUploadProps {
  onUploadSuccess?: () => void;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ onUploadSuccess }) => {
  const { t } = useTranslation();
  const { addProcessingItem } = useProcessing();

  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (data: DocumentFormValues, file?: File) => {
    if (!file) {
      toast({
        title: "Error",
        description: t("document.upload.messages.fileRequired"),
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (data.summary) {
        formData.append("summary", data.summary);
      }

      if (data.majors && data.majors.length > 0) {
        data.majors.forEach(major => formData.append("majors", major));
      }

      if (data.courseCodes && data.courseCodes.length > 0) {
        data.courseCodes.forEach(courseCode => formData.append("courseCodes", courseCode));
      }

      formData.append("level", data.level);

      if (data.categories && data.categories.length > 0) {
        data.categories.forEach(category => formData.append("categories", category));
      }

      const cleanedTags = (data.tags || []).map((tag) => tag.trim()).filter(Boolean);

      if (cleanedTags.length > 0) {
        formData.append("tags", cleanedTags.join(","));
      }

      handleUpload(formData);

      // Call the success callback if provided
      onUploadSuccess?.();
    } catch (_error) {
      toast({
        title: t("common.error"),
        description: t("document.upload.messages.error"),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async (formData: FormData) => {
    try {
      const response = await documentService.uploadDocument(formData);
      const document = response.data;

      // Add to processing queue
      addProcessingItem(document.id, document.filename);

      // Close dialog or continue with your existing flow
      onUploadSuccess?.();

      toast({
        title: t("common.success"),
        description: t("document.upload.messages.success"),
        variant: "success",
      });
    } catch (_error) {
      toast({
        title: t("common.error"),
        description: t("document.upload.messages.error"),
        variant: "destructive",
      });
    }
  };

  return <DocumentForm onSubmit={handleSubmit} loading={uploading} submitLabel={t("document.detail.buttons.update")} />;
};
