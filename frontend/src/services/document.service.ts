import axiosInstance from "@/services/axios.config";
import { BaseService } from "@/services/base.service";
import { DocumentInformation, DocumentMetadataUpdate } from "@/types/document";
import { UpdatePreferencesRequest } from "@/types/document-preference";
import { UserSearchResponse } from "@/types/user";

class DocumentService extends BaseService {
  uploadDocument(formData: FormData) {
    return this.handleApiResponse<DocumentInformation>(
      axiosInstance.post("/document-interaction/api/v1/documents", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }),
    );
  }

  downloadDocument(payload: { id: string; action?: string; history?: boolean }) {
    return this.handleApiResponse(
      axiosInstance.get(`/document-interaction/api/v1/documents/${payload?.id}/file`, {
        responseType: "blob",
        params: {
          action: payload?.action,
          history: payload?.history,
        },
      }),
    );
  }

  getDocumentThumbnail(id: string, versionInfo: string) {
    return this.handleApiResponse(
      axiosInstance.get(`/document-interaction/api/v1/documents/${id}/thumbnail`, {
        responseType: "blob",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        params: {
          [versionInfo]: "",
        },
      }),
    );
  }

  getDocumentDetails(id: string, history?: boolean) {
    return axiosInstance.get<DocumentInformation>(`/document-interaction/api/v1/documents/${id}`, {
      params: {
        history,
      },
    });
  }

  updateDocument(id: string, data: DocumentMetadataUpdate) {
    return this.handleApiResponse(axiosInstance.put(`/document-interaction/api/v1/documents/${id}`, data));
  }

  deleteDocument(id: string) {
    return this.handleApiResponse(axiosInstance.delete(`/document-interaction/api/v1/documents/${id}`));
  }

  updateDocumentWithFile(id: string, formData: FormData) {
    return this.handleApiResponse(
      axiosInstance.put(`/document-interaction/api/v1/documents/${id}/file`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }),
    );
  }

  getTagSuggestions(prefix?: string) {
    return this.handleApiResponse<string[]>(
      axiosInstance.get(`/document-interaction/api/v1/documents/tags/suggestions`, {
        params: { prefix },
      }),
    );
  }

  getShareSettings(documentId: string) {
    return this.handleApiResponse(axiosInstance.get(`/document-interaction/api/v1/documents/${documentId}/sharing`));
  }

  updateShareSettings(
    documentId: string,
    settings: {
      isPublic: boolean;
      sharedWith: string[];
    },
  ) {
    return this.handleApiResponse(
      axiosInstance.put(`/document-interaction/api/v1/documents/${documentId}/sharing`, settings),
    );
  }

  searchShareableUsers(query: string) {
    return this.handleApiResponse<UserSearchResponse[]>(
      axiosInstance.get(`/document-interaction/api/v1/documents/sharing/users`, {
        params: { query },
      }),
    );
  }

  getShareableUsersByIds(userIds: string[]) {
    return this.handleApiResponse<UserSearchResponse[]>(
      axiosInstance.post(`/document-interaction/api/v1/document/sharing/users/details`, userIds),
    );
  }

  favoriteDocument(id: string) {
    return this.handleApiResponse(axiosInstance.post(`/document-interaction/api/v1/documents/${id}/favorites`));
  }

  unfavoriteDocument(id: string) {
    return this.handleApiResponse(axiosInstance.delete(`/document-interaction/api/v1/documents/${id}/favorites`));
  }

  isDocumentFavorited(id: string) {
    return this.handleApiResponse<boolean>(
      axiosInstance.get(`/document-interaction/api/v1/documents/${id}/favorites/status`),
    );
  }

  downloadDocumentVersion(payload: { documentId: string; versionNumber: number; action?: string; history?: boolean }) {
    return this.handleApiResponse(
      axiosInstance.get(
        `/document-interaction/api/v1/documents/${payload.documentId}/versions/${payload.versionNumber}/file`,
        {
          responseType: "blob",
          params: {
            action: payload?.action,
            history: payload?.history,
          },
        },
      ),
    );
  }

  revertToVersion(documentId: string, versionNumber: number) {
    return this.handleApiResponse(
      axiosInstance.put<DocumentInformation>(
        `/document-interaction/api/v1/documents/${documentId}/versions/${versionNumber}`,
      ),
    );
  }

  getRecommendationDocuments(documentId: string, size: number = 6, page: number = 0) {
    return this.handleApiResponse(
      axiosInstance.get(`/document-search/api/v1/documents/recommendation`, {
        params: { documentId, size, page },
      }),
    );
  }

  getDocumentComments(documentId, params = {}) {
    return this.handleApiResponse(
      axiosInstance.get(`/document-interaction/api/v1/documents/${documentId}/comments`, { params }),
    );
  }

  createComment(documentId, data) {
    return this.handleApiResponse(
      axiosInstance.post(`/document-interaction/api/v1/documents/${documentId}/comments`, data),
    );
  }

  updateComment(documentId, commentId, data) {
    return this.handleApiResponse(
      axiosInstance.put(`/document-interaction/api/v1/documents/${documentId}/comments/${commentId}`, data),
    );
  }

  deleteComment(documentId, commentId) {
    return this.handleApiResponse(
      axiosInstance.delete(`/document-interaction/api/v1/documents/${documentId}/comments/${commentId}`),
    );
  }

  getDocumentPreferences() {
    return this.handleApiResponse(axiosInstance.get(`/document-interaction/api/v1/documents/preferences`));
  }

  getDocumentContentWeights() {
    return this.handleApiResponse(axiosInstance.get(`/document-interaction/api/v1/documents/preferences/content-weights`));
  }

  updateDocumentPreferences(preferences: UpdatePreferencesRequest) {
    return this.handleApiResponse(axiosInstance.put(`/document-interaction/api/v1/documents/preferences`, preferences));
  }

  getInteractionStatistics() {
    return this.handleApiResponse(axiosInstance.get(`/document-interaction/api/v1/documents/preferences/statistics`));
  }

  getRecommendedTags() {
    return this.handleApiResponse(axiosInstance.get(`/document-interaction/api/v1/documents/preferences/tags`));
  }

  getDocumentStatistics(documentId: string) {
    return axiosInstance.get(`/document-interaction/api/v1/documents/${documentId}/statistics`);
  }
}

export const documentService = new DocumentService();
