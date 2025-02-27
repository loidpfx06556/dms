import { Activity, Calendar, FileText, Filter, Search, X } from "lucide-react";
import moment from "moment-timezone";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { documentService } from "@/services/document.service";
import { UserDocumentActionType, UserHistoryFilter, UserHistoryResponse } from "@/types/document-user-history";
import { cn } from "@/lib/utils";

export default function DocumentUserHistoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [histories, setHistories] = useState<UserHistoryResponse[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);

  const [filters, setFilters] = useState<UserHistoryFilter>({
    page: 0,
    size: 20,
  });

  const [searchInput, setSearchInput] = useState("");
  const [selectedActionType, setSelectedActionType] = useState<UserDocumentActionType | undefined>(undefined);
  const [selectedFromDate, setSelectedFromDate] = useState<Date | undefined>(undefined);
  const [selectedToDate, setSelectedToDate] = useState<Date | undefined>(undefined);

  // Load histories with current filters
  const loadHistories = useCallback(async () => {
    setLoading(true);
    try {
      const response = await documentService.getUserHistory({
        ...filters,
        page: currentPage,
      });

      setHistories(response.content);
      setTotalPages(response.totalPages);
    } catch (error) {
      console.error("Error loading history:", error);
      toast({
        title: t("common.error"),
        description: t("document.history.fetchError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, toast, t]);

  // Load initial data
  useEffect(() => {
    loadHistories();
  }, [loadHistories]);

  const handleSearch = () => {
    // Reset to first page when applying new filters
    setCurrentPage(0);

    // Update filters with all temporary values
    const updatedFilters: UserHistoryFilter = {
      ...filters,
      page: 0,
      documentName: searchInput || undefined,
      actionType: selectedActionType,
      fromDate: selectedFromDate
        ? new Date(
            selectedFromDate.getFullYear(),
            selectedFromDate.getMonth(),
            selectedFromDate.getDate(),
            0,
            0,
            0,
          ).toISOString()
        : undefined,
      toDate: selectedToDate
        ? new Date(
            selectedToDate.getFullYear(),
            selectedToDate.getMonth(),
            selectedToDate.getDate(),
            23,
            59,
            59,
            999,
          ).toISOString()
        : undefined,
    };

    setFilters(updatedFilters);
  };

  // Handle filter reset
  const handleReset = () => {
    setSearchInput("");
    setSelectedActionType(undefined);
    setSelectedFromDate(undefined);
    setSelectedToDate(undefined);
    setCurrentPage(0);
    setFilters({
      page: 0,
      size: 20,
    });
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    return moment(timestamp).format("DD/MM/YYYY, h:mm a");
  };

  // Get action type display text and badge variant
  const getActionTypeDetails = (type: UserDocumentActionType) => {
    const actionMap: Record<
      UserDocumentActionType,
      {
        label: string;
        variant: string;
      }
    > = {
      [UserDocumentActionType.UPLOAD_DOCUMENT]: {
        label: t("document.history.actionTypes.uploadDocument"),
        variant: "bg-cyan-200 text-cyan-700 ring-cyan-600/20",
      },
      [UserDocumentActionType.VIEW_DOCUMENT]: {
        label: t("document.history.actionTypes.viewDocument"),
        variant: "bg-green-100 text-green-700 ring-green-600/20",
      },
      [UserDocumentActionType.UPDATE_DOCUMENT]: {
        label: t("document.history.actionTypes.updateDocument"),
        variant: "bg-green-200 text-green-700 ring-green-600/20",
      },
      [UserDocumentActionType.UPDATE_DOCUMENT_FILE]: {
        label: t("document.history.actionTypes.updateDocumentFile"),
        variant: "bg-green-300 text-green-800 ring-green-800/20",
      },
      [UserDocumentActionType.DELETE_DOCUMENT]: {
        label: t("document.history.actionTypes.deleteDocument"),
        variant: "bg-red-100 text-red-800 ring-red-800/20",
      },
      [UserDocumentActionType.DOWNLOAD_FILE]: {
        label: t("document.history.actionTypes.downloadFile"),
        variant: "bg-yellow-100 text-yellow-800 ring-yellow-800/20",
      },
      [UserDocumentActionType.DOWNLOAD_VERSION]: {
        label: t("document.history.actionTypes.downloadVersion"),
        variant: "bg-yellow-200 text-yellow-500 ring-yellow-600/20",
      },
      [UserDocumentActionType.REVERT_VERSION]: {
        label: t("document.history.actionTypes.revertVersion"),
        variant: "bg-orange-200 text-orange-500 ring-orange-600/20",
      },
      [UserDocumentActionType.SHARE]: {
        label: t("document.history.actionTypes.share"),
        variant: "bg-blue-200 text-blue-500 ring-blue-600/20",
      },
      [UserDocumentActionType.FAVORITE]: {
        label: t("document.history.actionTypes.favorite"),
        variant: "bg-pink-200 text-pink-500 ring-pink-600/20",
      },
      [UserDocumentActionType.COMMENT]: {
        label: t("document.history.actionTypes.comment"),
        variant: "bg-purple-200 text-purple-500 ring-purple-600/20",
      },
      [UserDocumentActionType.RECOMMEND]: {
        label: t("document.history.actionTypes.recommend"),
        variant: "bg-lime-50 text-lime-500 ring-lime-600/20",
      },
      [UserDocumentActionType.ADD_NOTE]: {
        label: t("document.history.actionTypes.addNote"),
        variant: "bg-amber-50 text-amber-500 ring-amber-600/20",
      },
    };

    return actionMap[type] || { label: type, variant: "default" as const };
  };

  // Navigate to document view
  const handleDocumentClick = (documentId: string) => {
    navigate(`/discover/${documentId}`);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {t("document.history.title")}
          </CardTitle>
          <CardDescription>{t("document.history.description")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("document.history.searchPlaceholder")}
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <Select
                value={selectedActionType}
                onValueChange={(value) => setSelectedActionType(value as UserDocumentActionType)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={t("document.history.filters.actionType")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("document.history.filters.allActions")}</SelectItem>
                  {Object.values(UserDocumentActionType).map((type) => (
                    <SelectItem key={type} value={type}>
                      {getActionTypeDetails(type).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-start text-left">
                      <Calendar className="mr-2 h-4 w-4" />
                      {selectedFromDate
                        ? moment(selectedFromDate).format("DD/MM/YYYY")
                        : t("document.history.filters.fromDate")}
                      {selectedFromDate && (
                        <X
                          className="ml-auto h-4 w-4 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFromDate(undefined);
                          }}
                        />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={selectedFromDate}
                      onSelect={setSelectedFromDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-start text-left">
                      <Calendar className="mr-2 h-4 w-4" />
                      {selectedToDate
                        ? moment(selectedToDate).format("DD/MM/YYYY")
                        : t("document.history.filters.toDate")}
                      {selectedToDate && (
                        <X
                          className="ml-auto h-4 w-4 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedToDate(undefined);
                          }}
                        />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={selectedToDate}
                      onSelect={setSelectedToDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSearch}>
                  <Search className="mr-2 h-4 w-4" />
                  {t("document.history.filters.search")}
                </Button>

                <Button variant="outline" onClick={handleReset}>
                  <Filter className="mr-2 h-4 w-4" />
                  {t("document.history.filters.reset")}
                </Button>
              </div>
            </div>
          </div>

          {/* History Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("document.history.tableHeaders.actionType")}</TableHead>
                  <TableHead>{t("document.history.tableHeaders.documentTitle")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("document.history.tableHeaders.details")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("document.history.tableHeaders.version")}</TableHead>
                  <TableHead>{t("document.history.tableHeaders.timestamp")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array(5)
                    .fill(0)
                    .map((_, index) => (
                      <TableRow key={`loading-${index}`}>
                        <TableCell>
                          <Skeleton className="h-6 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Skeleton className="h-6 w-12" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-32" />
                        </TableCell>
                      </TableRow>
                    ))
                ) : histories.length > 0 ? (
                  histories.map((history) => {
                    const { label, variant } = getActionTypeDetails(history.actionType);

                    return (
                      <TableRow key={history.id}>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset",
                              variant,
                            )}
                          >
                            {label}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {history.documentId ? (
                            <div className="flex items-center">
                              <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                              <Button
                                variant="link"
                                className="p-0 h-auto"
                                onClick={() => handleDocumentClick(history.documentId)}
                              >
                                {history.documentTitle}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">
                              {history.documentTitle || t("document.history.documentNotAvailable")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{history.detail || "-"}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {history.version !== null ? history.version + 1 : "-"}
                        </TableCell>
                        <TableCell>{formatTimestamp(history.timestamp)}</TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6">
                      {t("document.history.noResults")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {histories.length > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {t("document.history.pagination.showing", {
                  start: currentPage * 20 + 1,
                  end: Math.min((currentPage + 1) * 20, histories.length + currentPage * 20),
                  total: totalPages * 20,
                })}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 0 || loading}
                >
                  {t("document.history.pagination.previous")}
                </Button>
                <div className="text-sm">
                  {t("document.history.pagination.page", {
                    current: currentPage + 1,
                    total: totalPages || 1,
                  })}
                </div>
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages - 1 || loading}
                >
                  {t("document.history.pagination.next")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
