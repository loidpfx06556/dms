import JSZip from "jszip";
import { Loader2 } from "lucide-react";
import mammoth from "mammoth";
import Papa from "papaparse";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import * as XLSX from "xlsx";

import { JsonViewer } from "@/components/document/viewers/json-viewer";
import { MarkdownViewer } from "@/components/document/viewers/markdown-viewer";
import { PDFViewer } from "@/components/document/viewers/pdf-viewer";
import { PowerPointViewer } from "@/components/document/viewers/powerpoint-viewer";
import { SpreadsheetViewer } from "@/components/document/viewers/spreadsheet-viewer";
import { TextViewer } from "@/components/document/viewers/text-viewer";
import { UnsupportedViewer } from "@/components/document/viewers/unsupported-viewer";
import { WordViewer } from "@/components/document/viewers/word-viewer";
import { XmlViewer } from "@/components/document/viewers/xml-viewer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { documentService } from "@/services/document.service";
import { DocumentType } from "@/types/document";

interface DocumentViewerProps {
  documentId: string;
  mimeType: string;
  documentType: DocumentType;
  fileName: string;
  versionNumber?: number;
}

export interface ExcelSheet {
  name: string;
  data: Array<Array<string | number | boolean | Date | null>>;
}

export const DocumentViewer = ({
                                 documentId,
                                 mimeType,
                                 documentType,
                                 fileName,
                                 versionNumber
                               }: DocumentViewerProps) => {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [wordContent, setWordContent] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [excelContent, setExcelContent] = useState<ExcelSheet[]>([]);
  const [csvContent, setCsvContent] = useState<Array<Array<string | number | boolean | Date | null>>>([]);
  const [powerPointContent, setPowerPointContent] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadDocument();
    return () => {
      // Cleanup URL object on unmount
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [documentId, mimeType, documentType]);

  const loadDocument = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = versionNumber !== undefined
        ? await documentService.downloadDocumentVersion(documentId, versionNumber)
        : await documentService.downloadDocument(documentId);
      const blob = new Blob([response.data], { type: mimeType });

      switch (documentType) {
        case DocumentType.PDF: {
          const url = URL.createObjectURL(blob);
          setFileUrl(url);
          break;
        }

        case DocumentType.WORD:
        case DocumentType.WORD_DOCX: {
          const arrayBuffer = await blob.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          setWordContent(result.value);
          break;
        }

        case DocumentType.EXCEL:
        case DocumentType.EXCEL_XLSX: {
          const arrayBuffer = await blob.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, {
            type: "array",
            cellDates: true,
            cellStyles: true
          });

          const sheets: ExcelSheet[] = workbook.SheetNames.map(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as Array<Array<string | number | boolean | Date | null>>;
            return {
              name: sheetName,
              data: jsonData
            };
          });

          setExcelContent(sheets);
          break;
        }

        case DocumentType.CSV: {
          const text = await blob.text();
          Papa.parse(text, {
            complete: (results) => {
              // Transform and type the data properly
              const typedData = results.data.map(row =>
                (row as unknown[]).map(cell => {
                  if (cell instanceof Date) return cell;
                  if (typeof cell === "number") return cell;
                  if (typeof cell === "boolean") return cell;
                  return String(cell);
                })
              ) as Array<Array<string | number | boolean | Date>>;
              setCsvContent(typedData);
            },
            error: (error) => {
              console.error("Error parsing CSV:", error);
              setError("Failed to parse CSV file");
            },
            delimiter: ",", // auto-detect delimiter
            dynamicTyping: true, // convert numbers and booleans
            skipEmptyLines: true
          });
          break;
        }

        case DocumentType.POWERPOINT:
        case DocumentType.POWERPOINT_PPTX: {
          const arrayBuffer = await blob.arrayBuffer();
          const data = new Uint8Array(arrayBuffer);
          const zip = await JSZip.loadAsync(data);

          // Get the slides from pptx
          const slideFiles = Object.keys(zip.files).filter(
            fileName => fileName.match(/ppt\/slides\/slide[0-9]+\.xml/)
          ).sort();

          const slides: string[] = [];

          for (const slideFile of slideFiles) {
            const content = await zip.file(slideFile)?.async("string");
            if (content) {
              // Convert slide XML to HTML (simplified version)
              const parser = new DOMParser();
              const xmlDoc = parser.parseFromString(content, "text/xml");
              const texts = Array.from(xmlDoc.getElementsByTagName("a:t")).map(t => t.textContent);
              const slideHtml = `<div class="slide">
                ${texts.map(text => `<p>${text}</p>`).join("")}
              </div>`;
              slides.push(slideHtml);
            }
          }

          setPowerPointContent(slides);
          break;
        }

        case DocumentType.TEXT_PLAIN: {
          const text = await blob.text();
          setTextContent(text);
          break;
        }

        case DocumentType.JSON: {
          const text = await blob.text();
          setTextContent(text);
          break;
        }

        case DocumentType.XML: {
          const text = await blob.text();
          setTextContent(text);
          break;
        }

        case DocumentType.MARKDOWN: {
          const text = await blob.text();
          setTextContent(text);
          break;
        }

        default: {
          setError(t("document.viewer.error.unsupported", { type: documentType }));
          break;
        }
      }
    } catch (err) {
      console.error("Error loading document:", err);
      setError(t("document.viewer.error.loading"));
      toast({
        title: t("document.viewer.error.title"),
        description: t("document.viewer.error.loading"),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = versionNumber !== undefined
        ? await documentService.downloadDocumentVersion(documentId, versionNumber, "download")
        : await documentService.downloadDocument(documentId, "download");
      const blob = new Blob([response.data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        title: t("document.viewer.error.title"),
        description: t("document.viewer.error.download"),
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">{t("document.viewer.loading")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-destructive">{error}</p>
        <Button onClick={handleDownload} variant="outline">
          {t("document.viewer.buttons.downloadInstead")}
        </Button>
      </div>
    );
  }

  switch (documentType) {
    case DocumentType.PDF:
      return fileUrl && (
        <PDFViewer
          fileUrl={fileUrl}
          onDownload={handleDownload}
        />
      );

    case DocumentType.WORD:
    case DocumentType.WORD_DOCX:
      return wordContent && (
        <WordViewer
          content={wordContent}
          onDownload={handleDownload}
        />
      );

    case DocumentType.EXCEL:
    case DocumentType.EXCEL_XLSX:
      return excelContent.length > 0 && (
        <SpreadsheetViewer
          sheets={excelContent}
          activeSheet={activeSheet}
          onSheetChange={setActiveSheet}
          onDownload={handleDownload}
        />
      );

    case DocumentType.CSV:
      return csvContent.length > 0 && (
        <SpreadsheetViewer
          sheets={[{ name: "Sheet1", data: csvContent }]}
          activeSheet={0}
          onSheetChange={() => {
          }}
          onDownload={handleDownload}
        />
      );

    case DocumentType.POWERPOINT:
    case DocumentType.POWERPOINT_PPTX:
      return powerPointContent.length > 0 && (
        <PowerPointViewer
          content={powerPointContent}
          onDownload={handleDownload}
        />
      );

    case DocumentType.TEXT_PLAIN:
      return textContent && (
        <TextViewer
          content={textContent}
          onDownload={handleDownload}
        />
      );

    case DocumentType.JSON:
      return textContent && (
        <JsonViewer
          content={textContent}
          onDownload={handleDownload}
        />
      );

    case DocumentType.XML:
      return textContent && (
        <XmlViewer
          content={textContent}
          onDownload={handleDownload}
        />
      );

    case DocumentType.MARKDOWN:
      return textContent && (
        <MarkdownViewer
          content={textContent}
          onDownload={handleDownload}
        />
      );

    default:
      return (
        <UnsupportedViewer
          documentType={documentType}
          onDownload={handleDownload}
        />
      );
  }
};

export default DocumentViewer;