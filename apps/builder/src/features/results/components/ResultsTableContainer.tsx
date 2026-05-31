import type { TimeFilter } from "@typebot.io/results/timeFilter";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTypebot } from "@/features/editor/providers/TypebotProvider";
import { useResults } from "../ResultsProvider";
import { LiveLogsDialog } from "./LiveLogsDialog";
import { ResultDialog } from "./ResultDialog";
import { ResultsTable } from "./table/ResultsTable";

type Props = {
  timeFilter: TimeFilter;
  onTimeFilterChange: (timeFilter: TimeFilter) => void;
};
export const ResultsTableContainer = ({
  timeFilter,
  onTimeFilterChange,
}: Props) => {
  const { query } = useRouter();
  const {
    flatResults: results,
    fetchNextPage,
    hasNextPage,
    resultHeader,
    tableData,
  } = useResults();
  const { typebot, publishedTypebot } = useTypebot();
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);

  const handleResultDialogClose = () => setExpandedResultId(null);

  const handleResultExpandIndex = (index: number) => () => {
    if (!results[index]) return;
    setExpandedResultId(results[index].id);
  };

  useEffect(() => {
    if (query.id) setExpandedResultId(query.id as string);
  }, [query.id]);

  return (
    <div className="flex flex-col pb-28 gap-4 max-w-[1600px] w-full px-4 sm:px-0">
      {publishedTypebot && (
        <LiveLogsDialog
          typebotId={publishedTypebot.typebotId}
          isOpen={isLogsOpen}
          onClose={() => setIsLogsOpen(false)}
        />
      )}
      <ResultDialog
        resultId={expandedResultId}
        onClose={handleResultDialogClose}
      />
      {typebot && (
        <ResultsTable
          preferences={typebot.resultsTablePreferences ?? undefined}
          resultHeader={resultHeader}
          data={tableData}
          onScrollToBottom={fetchNextPage}
          hasMore={hasNextPage}
          timeFilter={timeFilter}
          onLogsOpen={() => setIsLogsOpen(true)}
          onResultExpandIndex={handleResultExpandIndex}
          onTimeFilterChange={onTimeFilterChange}
        />
      )}
    </div>
  );
};
