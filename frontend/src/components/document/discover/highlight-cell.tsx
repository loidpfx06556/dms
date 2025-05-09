import { ChevronDown, ChevronUp } from "lucide-react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

interface HighlightCellProps {
  highlights: string[];
}

export const HighlightCell: React.FC<HighlightCellProps> = ({ highlights }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const MAX_VISIBLE_HIGHLIGHTS = 2;

  if (!highlights || highlights.length === 0) {
    return <div className="text-sm text-muted-foreground italic">{t("document.discover.status.noMatches")}</div>;
  }

  const visibleHighlights = isExpanded ? highlights : highlights.slice(0, MAX_VISIBLE_HIGHLIGHTS);
  const hasMore = highlights.length > MAX_VISIBLE_HIGHLIGHTS;

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        {visibleHighlights.map((highlight: string, index: number) => (
          <div
            key={index}
            className="text-sm text-muted-foreground rounded-md bg-muted/50 p-2"
            dangerouslySetInnerHTML={{ __html: `...${highlight}...` }}
          />
        ))}
      </div>

      {hasMore && (
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? (
            <>
              <ChevronUp className="mr-1 h-3 w-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="mr-1 h-3 w-3" />
              Show {highlights.length - MAX_VISIBLE_HIGHLIGHTS} more
            </>
          )}
        </Button>
      )}
    </div>
  );
};
