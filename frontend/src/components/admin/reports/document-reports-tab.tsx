import { Search, UserRound } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import DocumentReportProcessDialog from "@/components/admin/reports/document-report-process-dialog";
import DocumentReportReasonsDialog from "@/components/admin/reports/document-report-reasons-dialog";
import DatePicker from "@/components/common/date-picker";
import TableSkeleton from "@/components/common/table-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { DocumentReportFilter, reportService } from "@/services/report.service";
import { DocumentReport, ReportStatus, ReportType } from "@/types/document-report";

interface DocumentReportsResponse {
  content: DocumentReport[];
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
}

const DocumentReportsTab = () => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [reports, setReports] = useState<DocumentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);

  const [documentTitle, setDocumentTitle] = useState("");
  const [uploaderUsername, setUploaderUsername] = useState("");
  const [reportTypeCode, setReportTypeCode] = useState<string>("all");
  const [status, setStatus] = useState("all");
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);

  const [selectedReport, setSelectedReport] = useState<DocumentReport | null>(null);
  const [showReasonsDialog, setShowReasonsDialog] = useState(false);
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [processingReport, setProcessingReport] = useState(false);
  const [reportTypes, setReportTypes] = useState<ReportType[]>([]);

  // Validate date range
  const validateDateRange = useCallback(() => {
    if (fromDate && toDate) {
      // Create date objects for midnight on the selected dates for proper comparison
      const fromDateObj = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());

      const toDateObj = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());

      // Compare dates
      if (fromDateObj > toDateObj) {
        setDateRangeError(t("document.history.validation.dateRange"));
      } else {
        setDateRangeError(null);
      }
    } else {
      // If both dates aren't selected, no error
      setDateRangeError(null);
    }
  }, [fromDate, toDate, t]);

  // Check validation whenever dates change
  useEffect(() => {
    validateDateRange();
  }, [fromDate, toDate, validateDateRange]);

  // Initial fetch
  useEffect(() => {
    loadReportTypes();
    fetchReports(); // Initial load of reports
  }, []);

  const loadReportTypes = async () => {
    try {
      const response = await reportService.getDocumentReportTypes();
      setReportTypes(response.data);
    } catch (error) {
      console.error("Error loading report types:", error);
    }
  };

  const fetchReports = async (overrideFilters: DocumentReportFilter = {}) => {
    if (dateRangeError && !Object.prototype.hasOwnProperty.call(overrideFilters, "fromDate")) {
      return;
    }

    setLoading(true);
    try {
      const filters = {
        documentTitle:
          overrideFilters.documentTitle !== undefined ? overrideFilters.documentTitle : documentTitle || undefined,
        uploaderUsername:
          overrideFilters.uploaderUsername !== undefined
            ? overrideFilters.uploaderUsername
            : uploaderUsername || undefined,
        reportTypeCode:
          overrideFilters.reportTypeCode !== undefined
            ? overrideFilters.reportTypeCode === "all"
              ? undefined
              : overrideFilters.reportTypeCode
            : reportTypeCode === "all"
              ? undefined
              : reportTypeCode,
        status:
          overrideFilters.status !== undefined
            ? overrideFilters.status === "all"
              ? undefined
              : overrideFilters.status
            : status === "all"
              ? undefined
              : status,
        fromDate: Object.prototype.hasOwnProperty.call(overrideFilters, "fromDate")
          ? overrideFilters.fromDate
          : fromDate,
        toDate: Object.prototype.hasOwnProperty.call(overrideFilters, "toDate") ? overrideFilters.toDate : toDate,
        page: overrideFilters.page !== undefined ? overrideFilters.page : currentPage,
        size: 10,
      };

      const response = await reportService.getDocumentReports(filters);
      const data = response.data as DocumentReportsResponse;

      setReports(data.content);
      setTotalPages(data.totalPages);
    } catch (_error) {
      toast({
        title: t("common.error"),
        description: t("admin.reports.documents.fetchError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (dateRangeError) {
      return;
    }

    setCurrentPage(0);
    fetchReports();
  };

  const handleReset = () => {
    setDocumentTitle("");
    setUploaderUsername("");
    setStatus("all");
    setReportTypeCode("all");
    setFromDate(undefined);
    setToDate(undefined);
    setCurrentPage(0);
    setDateRangeError(null);

    // Fetch reports with reset filters directly instead of relying on state
    fetchReports({
      documentTitle: "",
      uploaderUsername: "",
      status: "all",
      reportTypeCode: "all",
      fromDate: undefined,
      toDate: undefined,
      page: 0,
    });
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchReports({ page: newPage });
  };

  const handleViewReasons = (report: DocumentReport) => {
    setSelectedReport(report);
    setShowReasonsDialog(true);
  };

  const handleProcessReport = (report: DocumentReport) => {
    setSelectedReport(report);
    setShowProcessDialog(true);
  };

  const handleResolveReport = async (report: DocumentReport, status: string) => {
    setProcessingReport(true);
    try {
      await reportService.updateDocumentReportStatus(report.documentId, status);
      toast({
        title: t("common.success"),
        description: t("admin.reports.documents.processSuccess"),
        variant: "success",
      });
      fetchReports();
    } catch (_error) {
      toast({
        title: t("common.error"),
        description: t("admin.reports.documents.processError"),
        variant: "destructive",
      });
    } finally {
      setProcessingReport(false);
      setShowProcessDialog(false);
    }
  };

  const canResolve = (report: DocumentReport) => {
    return !report.processed;
  };

  const getStatusBadgeClasses = (status: ReportStatus) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 ring-yellow-600/20";
      case "RESOLVED":
        return "bg-red-100 text-red-800 ring-red-600/20";
      case "REJECTED":
        return "bg-gray-100 text-gray-800 ring-gray-600/20";
      case "REMEDIATED":
        return "bg-green-100 text-green-800 ring-green-600/20";
      default:
        return "bg-gray-100 text-gray-800 ring-gray-600/20";
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Section */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label>{t("admin.reports.documents.filters.documentTitle")}</Label>
          <div className="mt-1 w-full">
            <Input
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              placeholder={t("admin.reports.documents.filters.documentTitle")}
              className="w-full"
            />
          </div>
        </div>

        <div>
          <Label>{t("admin.reports.documents.filters.uploaderUsername")}</Label>
          <div className="mt-1 w-full">
            <Input
              value={uploaderUsername}
              onChange={(e) => setUploaderUsername(e.target.value)}
              placeholder={t("admin.reports.documents.filters.uploaderUsername")}
              className="w-full"
            />
          </div>
        </div>

        <div>
          <Label>{t("admin.reports.documents.filters.reportType")}</Label>
          <div className="mt-1 w-full">
            <Select value={reportTypeCode} onValueChange={setReportTypeCode}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("admin.reports.documents.filters.reportType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.reports.documents.filters.allTypes")}</SelectItem>

                {reportTypes.map((type) => (
                  <SelectItem key={type.code} value={type.code}>
                    {type.translations[i18n.language] || type.translations.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>{t("admin.reports.documents.filters.status")}</Label>
          <div className="mt-1 w-full">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("admin.reports.documents.filters.allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.reports.documents.filters.allStatuses")}</SelectItem>
                <SelectItem value="PENDING">{t("admin.reports.documents.status.pending")}</SelectItem>
                <SelectItem value="RESOLVED">{t("admin.reports.documents.status.resolved")}</SelectItem>
                <SelectItem value="REJECTED">{t("admin.reports.documents.status.rejected")}</SelectItem>
                <SelectItem value="REMEDIATED">{t("admin.reports.documents.status.remediated")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>{t("admin.reports.documents.filters.fromDate")}</Label>
          <DatePicker
            value={fromDate}
            onChange={setFromDate}
            placeholder={t("admin.reports.documents.filters.fromDate")}
            clearAriaLabel="Clear from date"
            className="w-full mt-1"
          />
        </div>

        <div>
          <Label>{t("admin.reports.documents.filters.toDate")}</Label>
          <DatePicker
            value={toDate}
            onChange={setToDate}
            placeholder={t("admin.reports.documents.filters.toDate")}
            clearAriaLabel="Clear to date"
            className="w-full mt-1"
          />
        </div>

        {/* Date Range Error Display */}
        {dateRangeError && (
          <div className="col-span-full">
            <div className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
              <span>{dateRangeError}</span>
            </div>
          </div>
        )}

        <div className="flex items-end gap-2">
          <Button onClick={handleSearch} className="flex-1" disabled={!!dateRangeError}>
            <Search className="mr-2 h-4 w-4" />
            {t("admin.reports.documents.filters.search")}
          </Button>
          <Button variant="outline" onClick={handleReset}>
            {t("admin.reports.documents.filters.reset")}
          </Button>
        </div>
      </div>

      {/* Reports Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.reports.documents.table.documentTitle")}</TableHead>
              <TableHead>{t("admin.reports.documents.table.uploader")}</TableHead>
              <TableHead>{t("admin.reports.documents.table.reportCount")}</TableHead>
              <TableHead>{t("admin.reports.documents.table.status")}</TableHead>
              <TableHead>{t("admin.reports.documents.table.resolvedBy")}</TableHead>
              <TableHead>{t("admin.reports.documents.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton rows={5} cells={6} />
            ) : reports.length > 0 ? (
              reports.map((report, index) => (
                <TableRow key={`${report.documentId}-${report.documentOwnerId}-${index}`}>
                  <TableCell>
                    {report.documentId ? (
                      <div className="flex items-center">
                        <Button
                          variant="link"
                          className="font-medium truncate p-0 h-auto text-left text-wrap"
                          onClick={() => navigate(`/discover/${report.documentId}`)}
                        >
                          {report.documentTitle}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{report.documentTitle}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <UserRound className="mr-2 h-4 w-4 text-muted-foreground" />
                      {report.documentOwnerUsername}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{report.reportCount}</Badge>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${getStatusBadgeClasses(
                        report.status,
                      )}`}
                    >
                      {t(`admin.reports.documents.status.${report.status.toLowerCase()}`)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {report.resolvedByUsername ? (
                      <div className="flex items-center">
                        <UserRound className="mr-2 h-4 w-4 text-muted-foreground" />
                        {report.resolvedByUsername}
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleViewReasons(report)}>
                        {t("admin.reports.documents.actions.viewReasons")}
                      </Button>

                      {canResolve(report) && (
                        <Button variant="outline" size="sm" onClick={() => handleProcessReport(report)}>
                          {t("admin.reports.documents.actions.process")}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  {t("admin.reports.documents.noReports")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {reports.length > 0 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 0 || loading}
          >
            {t("admin.reports.documents.pagination.previous")}
          </Button>
          <div className="flex items-center">
            <span>
              {t("admin.reports.documents.pagination.pageInfo", {
                current: currentPage + 1,
                total: totalPages,
              })}
            </span>
          </div>
          <Button
            variant="outline"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages - 1 || loading}
          >
            {t("admin.reports.documents.pagination.next")}
          </Button>
        </div>
      )}

      {/* Document Report Reasons Dialog */}
      {selectedReport && (
        <DocumentReportReasonsDialog
          open={showReasonsDialog}
          onOpenChange={setShowReasonsDialog}
          documentId={selectedReport.documentId}
          documentTitle={selectedReport.documentTitle}
          reportTypes={reportTypes}
          status={selectedReport.status}
        />
      )}

      {/* Document Report Process Dialog */}
      {selectedReport && (
        <DocumentReportProcessDialog
          open={showProcessDialog}
          onOpenChange={setShowProcessDialog}
          report={selectedReport}
          onResolve={(status) => handleResolveReport(selectedReport, status)}
          processing={processingReport}
        />
      )}
    </div>
  );
};

export default DocumentReportsTab;
