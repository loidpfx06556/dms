import { ArrowLeft, Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import DocumentVersionHistory from "@/components/document/document-versions-history";
import { DocumentForm, DocumentFormValues } from "@/components/document/my-document/document-form";
import DocumentViewer from "@/components/document/viewers/document-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useProcessing } from "@/context/processing-provider";
import { RoutePaths } from "@/core/route-config";
import { useToast } from "@/hooks/use-toast";
import { documentService } from "@/services/document.service";
import { useAppDispatch } from "@/store/hook";
import { setCurrentDocument } from "@/store/slices/document-slice";
import { DocumentInformation } from "@/types/document";

export default function MyDocumentDetailPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { documentId } = useParams<{ documentId: string }>();

  const { addProcessingItem } = useProcessing();

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [documentData, setDocumentData] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchDocument = async () => {
      if (!documentId) return;

      try {
        const response = await documentService.getDocumentDetails(documentId);
        setDocumentData(response.data);
        dispatch(setCurrentDocument(response.data));
      } catch (error) {
        toast({
          title: t("common.error"),
          description: t("document.detail.fetchError"),
          variant: "destructive"
        });
        navigate("/documents");
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();

    return () => {
      dispatch(setCurrentDocument(null));
    };
  }, [documentId]);

  const handleSubmit = async (data: DocumentFormValues, file?: File) => {
    if (!documentId) return;
    setUpdating(true);

    try {
      if (file) {
        // Send both metadata and file in single request
        const formData = new FormData();
        formData.append("file", file);
        if (data.summary) {
          formData.append("summary", data.summary);
        }
        formData.append("courseCode", data.courseCode);
        formData.append("major", data.major);
        formData.append("level", data.level);
        formData.append("category", data.category);
        data.tags.forEach(tag => formData.append("tags", tag));
        await handleFileUpdate(documentId, formData);

      } else {
        // Metadata-only update
        await documentService.updateDocument(documentId, {
          summary: data.summary,
          courseCode: data.courseCode,
          major: data.major,
          level: data.level,
          category: data.category,
          tags: data.tags
        });
      }

      // Refresh document data
      const response = await documentService.getDocumentDetails(documentId);
      setDocumentData(response.data);

      toast({
        title: t("common.success"),
        description: t("document.detail.updateSuccess"),
        variant: "success"
      });
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("document.detail.updateError"),
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleFileUpdate = async (documentId: string, formData: FormData) => {
    try {
      const response = await documentService.updateDocumentWithFile(documentId, formData);
      const document = response.data;

      // Add to processing queue
      addProcessingItem(document.id, document.originalFilename);

    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("document.detail.updateError"),
        variant: "destructive"
      });
    }
  };

  const handleVersionUpdate = (updatedDocument: DocumentInformation) => {
    setDocumentData(updatedDocument);
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Button variant="ghost" onClick={() => navigate(RoutePaths.MY_DOCUMENT)} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("document.detail.backToList")}
      </Button>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Document Form */}
        <Card>
          <CardHeader>
            <CardTitle>{t("document.detail.title")}</CardTitle>
            <CardDescription>{t("document.detail.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {documentData && (
              <DocumentVersionHistory
                versions={documentData.versions}
                currentVersion={documentData.currentVersion}
                documentCreatorId={documentData.userId}
                documentId={documentData.id}
                onVersionUpdate={handleVersionUpdate}
              />
            )}

            <DocumentForm
              initialValues={{
                summary: documentData?.summary ? documentData.summary : undefined,
                courseCode: documentData?.courseCode,
                major: documentData?.major,
                level: documentData?.courseLevel,
                category: documentData?.category,
                tags: documentData?.tags || []
              }}
              onSubmit={handleSubmit}
              loading={updating}
              submitLabel={t("document.detail.buttons.update")}
            />
          </CardContent>
        </Card>

        {/* Document Preview */}
        <Card className="xl:h-[800px]">
          <CardHeader>
            <CardTitle>{documentData?.filename}</CardTitle>
            <CardDescription>
              {documentData?.documentType} - {(documentData?.fileSize / 1024).toFixed(2)} KB
            </CardDescription>
          </CardHeader>
          <CardContent className="h-full max-h-[700px]">
            {documentData && (
              <DocumentViewer
                documentId={documentData.id}
                documentType={documentData.documentType}
                mimeType={documentData.mimeType}
                fileName={documentData.filename}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}