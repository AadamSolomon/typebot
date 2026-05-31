import { useQuery } from "@tanstack/react-query";
import type { Log } from "@typebot.io/logs/schemas";
import { Accordion } from "@typebot.io/ui/components/Accordion";
import { Badge } from "@typebot.io/ui/components/Badge";
import { Dialog } from "@typebot.io/ui/components/Dialog";
import { LoaderCircleIcon } from "@typebot.io/ui/icons/LoaderCircleIcon";
import { CodeEditor } from "@/components/inputs/CodeEditor";
import { orpc } from "@/lib/queryClient";

type Props = {
  typebotId: string;
  isOpen: boolean;
  onClose: () => void;
};

export const LiveLogsDialog = ({ typebotId, isOpen, onClose }: Props) => {
  const { data, isLoading, error } = useQuery({
    ...orpc.results.getTypebotLogs.queryOptions({
      input: { typebotId },
    }),
    enabled: isOpen,
    refetchInterval: 2000,
    staleTime: 0,
  });

  const logs = data?.logs ?? [];

  return (
    <Dialog.Root isOpen={isOpen} onClose={onClose}>
      <Dialog.Popup className="max-w-2xl">
        <Dialog.Title className="flex items-center gap-2">
          Logs
          {isOpen && !error && (
            <span className="flex items-center gap-1 text-xs font-normal text-gray-11">
              <span className="size-2 rounded-full bg-green-9 animate-pulse" />
              live
            </span>
          )}
        </Dialog.Title>
        <Dialog.CloseButton />

        {isLoading && (
          <div className="flex justify-center py-8">
            <LoaderCircleIcon className="animate-spin" />
          </div>
        )}

        {error && (
          <p className="text-red-11 text-sm py-4">
            Failed to load logs: {error.message}
          </p>
        )}

        {!isLoading && !error && logs.length === 0 && (
          <p className="text-gray-11 text-sm py-4">
            No logs yet. Interact with the{" "}
            <strong>published bot</strong> — logs from the Script block,
            HTTP requests, OpenAI, and other integrations appear here.
          </p>
        )}

        <div className="flex flex-col gap-2 max-h-[32rem] overflow-y-auto">
          {logs.map((log) => (
            <LogCard key={log.id} log={log} />
          ))}
        </div>
      </Dialog.Popup>
    </Dialog.Root>
  );
};

const LogCard = ({ log }: { log: Log }) => {
  const meta = (
    <div className="flex gap-3 items-start min-w-0">
      <LogStatusBadge status={log.status} className="shrink-0 mt-0.5" />
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="text-xs text-gray-11 font-mono">
          {new Date(log.createdAt).toLocaleTimeString()} — result{" "}
          <span className="text-gray-12">{log.resultId}</span>
        </p>
        <p>
          {log.context && (
            <span className="font-medium">{log.context}:</span>
          )}{" "}
          {log.description}
        </p>
      </div>
    </div>
  );

  if (log.details)
    return (
      <Accordion.Root>
        <Accordion.Item>
          <Accordion.Trigger>{meta}</Accordion.Trigger>
          <Accordion.Panel>
            <LogDetails details={log.details} />
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    );

  return <div className="flex p-4 gap-3 items-start">{meta}</div>;
};

const LogStatusBadge = ({
  status,
  className,
}: {
  status: string;
  className?: string;
}) => {
  switch (status) {
    case "error":
      return (
        <Badge colorScheme="red" className={className}>
          Fail
        </Badge>
      );
    case "warning":
      return (
        <Badge colorScheme="orange" className={className}>
          Warn
        </Badge>
      );
    case "info":
      return (
        <Badge colorScheme="blue" className={className}>
          Info
        </Badge>
      );
    default:
      return (
        <Badge colorScheme="green" className={className}>
          Ok
        </Badge>
      );
  }
};

const LogDetails = ({ details }: { details: string }) => {
  try {
    const parsed = JSON.parse(details);
    return (
      <CodeEditor
        value={JSON.stringify(parsed, null, 2)}
        lang="json"
        isReadOnly
        withVariableButton={false}
        maxHeight="400px"
        withLineNumbers
      />
    );
  } catch {
    return (
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-sm">
        {details}
      </pre>
    );
  }
};
