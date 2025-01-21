import axiosInstance from "@/services/axios.config";
import { BaseService } from "@/services/base.service";
import { DocumentMetadataUpdate, DocumentUploadResponse } from "@/types/document";

class DocumentService extends BaseService {
  uploadDocument(formData: FormData) {
    return this.handleApiResponse<DocumentUploadResponse>(
      axiosInstance.post("/document/api/v1/documents", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      })
    );
  }

  downloadDocument(id: string) {
    return axiosInstance.get(`/document/api/v1/documents/downloads/${id}`, {
      responseType: "blob"
    });
  }

  getDocumentDetails(id: string) {
    return axiosInstance.get(`/document/api/v1/documents/${id}`);
  }

  updateDocument(id: string, data: DocumentMetadataUpdate) {
    return this.handleApiResponse(
      axiosInstance.put(`/document/api/v1/documents/${id}`, data)
    );
  }

  deleteDocument(id: string) {
    return this.handleApiResponse(
      axiosInstance.delete(`/document/api/v1/documents/${id}`)
    );
  }

  updateFile(id: string, formData: FormData) {
    return this.handleApiResponse(
      axiosInstance.put(`/document/api/v1/documents/${id}/file`, formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      })
    );
  }

  getTagSuggestions(prefix?: string) {
    return this.handleApiResponse<string[]>(
      axiosInstance.get(`/document/api/v1/documents/tags/suggestions`, {
        params: { prefix }
      })
    );
  }
}

export const documentService = new DocumentService();