import { AlertCircle, CheckCircle2, Loader2, Timer, X } from "lucide-react";
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { documentService } from "@/services/document.service";
import {
  removeProcessingItem,
  selectProcessingItems,
  selectProcessingVisibility,
  updateProcessingItem,
} from "@/store/slices/processing-slice";
import { DocumentStatus } from "@/types/document";

export function ProcessingStatus() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const items = useSelector(selectProcessingItems);
  const isVisible = useSelector(selectProcessingVisibility);

  // Poll for status updates
  useEffect(() => {
    const checkStatuses = async () => {
      const pendingItems = items.filter(
        (item) => item.status === DocumentStatus.PENDING || item.status === DocumentStatus.PROCESSING,
      );

      for (const item of pendingItems) {
        try {
          console.info("Polling", item);
          const response = await documentService.getDocumentDetails(item.documentId);
          dispatch(
            updateProcessingItem({
              documentId: item.documentId,
              status: response.data.status,
              error: response.data.processingError,
            }),
          );
        } catch (error) {
          console.info("Failed to check status:", error);
        }
      }
    };

    // Only poll if there are items to check
    if (items.length > 0) {
      const interval = setInterval(checkStatuses, 5000);
      return () => clearInterval(interval);
    }
    return () => {};
  }, [items, dispatch]);

  // Auto-remove completed items after delay
  useEffect(() => {
    const completedItems = items.filter(
      (item) => item.status === DocumentStatus.COMPLETED || item.status === DocumentStatus.FAILED,
    );

    completedItems.forEach((item) => {
      const timer = setTimeout(() => {
        dispatch(removeProcessingItem(item.id));
      }, 5000);

      return () => clearTimeout(timer);
    });
  }, [items, dispatch]);

  // If no items or explicitly hidden, don't render
  if (items.length === 0 || !isVisible) return null;

  return (
    <div className="fixed right-4 top-4 z-50 flex flex-col gap-2 w-80">
      {items.map((item) => (
        <div
          key={item.id}
          className={`
            rounded-lg border bg-card p-4 text-card-foreground shadow-lg
            transform transition-all duration-300
            ${item.status === "COMPLETED" ? "border-green-500" : ""}
            ${item.status === "FAILED" ? "border-red-500" : ""}
          `}
        >
          <div className="flex items-start gap-3">
            {/* Status Icon */}
            <div className="mt-1">
              {item.status === DocumentStatus.PENDING && <Timer className="h-5 w-5 text-muted-foreground" />}
              {item.status === DocumentStatus.PROCESSING && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
              {item.status === DocumentStatus.COMPLETED && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              {item.status === DocumentStatus.FAILED && <AlertCircle className="h-5 w-5 text-destructive" />}
            </div>

            {/* Content */}
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium leading-none">{item.filename}</p>
              <p className="text-sm text-muted-foreground">
                {t(`document.upload.processing.status.${item.status.toLowerCase()}`)}
              </p>
              {item.error && <p className="text-sm text-destructive">{item.error}</p>}
            </div>

            {/* Close button */}
            <button onClick={() => dispatch(removeProcessingItem(item.id))} className="rounded-md p-1 hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}