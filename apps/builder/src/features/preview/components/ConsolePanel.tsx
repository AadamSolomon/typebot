import type { LogInSession } from "@typebot.io/logs/schemas";
import { Button } from "@typebot.io/ui/components/Button";
import { TrashIcon } from "@typebot.io/ui/icons/TrashIcon";
import { cn } from "@typebot.io/ui/lib/cn";
import { useDrag } from "@use-gesture/react";
import { useEffect, useRef, useState } from "react";

export type ConsoleLogEntry = LogInSession & { receivedAt: Date };

type Props = {
  logs: ConsoleLogEntry[];
  onClear: () => void;
};

export const ConsolePanel = ({ logs, onClear }: Props) => {
  const [height, setHeight] = useState(192);
  const bottomRef = useRef<HTMLDivElement>(null);

  const bind = useDrag(
    (state) => {
      setHeight(
        Math.max(80, Math.min(window.innerHeight * 0.7, -state.offset[1])),
      );
    },
    { from: () => [0, -height] },
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  return (
    <div className="flex flex-col shrink-0 border-t" style={{ height }}>
      <div
        className="flex items-center justify-center h-3 cursor-ns-resize shrink-0 hover:bg-gray-3 transition-colors"
        {...bind()}
      >
        <div className="w-8 h-0.5 rounded-full bg-gray-6" />
      </div>
      <div className="flex items-center justify-between px-3 py-1.5 border-b shrink-0">
        <span className="text-xs font-medium text-gray-11">Console</span>
        {logs.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label="Clear console"
            onClick={onClear}
          >
            <TrashIcon />
          </Button>
        )}
      </div>
      <div className="flex flex-col flex-1 overflow-y-auto px-2 py-1">
        {logs.length === 0 ? (
          <p className="text-gray-10 text-xs text-center m-auto">No logs yet</p>
        ) : (
          <>
            {logs.map((log) => (
              <LogEntryItem
                key={`${log.receivedAt.getTime()}-${log.description}`}
                log={log}
              />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  );
};

const statusColorMap = {
  error: "text-red-10",
  success: "text-green-10",
  info: "text-blue-10",
};

const LogEntryItem = ({ log }: { log: ConsoleLogEntry }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const color =
    statusColorMap[log.status as keyof typeof statusColorMap] ?? "text-gray-11";

  const formattedDetails = (() => {
    if (!log.details) return null;
    try {
      return JSON.stringify(JSON.parse(log.details), null, 2);
    } catch {
      return log.details;
    }
  })();

  const body = (
    <>
      <div className="flex gap-2">
        <span
          className={cn(
            "font-mono font-semibold shrink-0 text-[10px] mt-0.5",
            color,
          )}
        >
          {(log.status ?? "info").toUpperCase()}
        </span>
        <div className="flex flex-col min-w-0">
          <span className="break-words">{log.description}</span>
          {log.context && (
            <span className="text-gray-10 text-[10px]">{log.context}</span>
          )}
        </div>
      </div>
      {isExpanded && formattedDetails && (
        <pre className="font-mono text-[10px] text-gray-11 bg-gray-3 rounded p-2 mt-1 overflow-x-auto whitespace-pre-wrap break-all">
          {formattedDetails}
        </pre>
      )}
    </>
  );

  if (formattedDetails) {
    return (
      <button
        type="button"
        className="flex flex-col gap-0.5 rounded px-2 py-1 text-xs text-left w-full cursor-pointer hover:bg-gray-3"
        onClick={() => setIsExpanded((v) => !v)}
      >
        {body}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 rounded px-2 py-1 text-xs">
      {body}
    </div>
  );
};
