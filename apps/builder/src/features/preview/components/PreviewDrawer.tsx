import { useTranslate } from "@tolgee/react";
import type { ContinueChatResponse } from "@typebot.io/chat-api/schemas";
import { reload } from "@typebot.io/react";
import { Button } from "@typebot.io/ui/components/Button";
import { Cancel01Icon } from "@typebot.io/ui/icons/Cancel01Icon";
import { CodeIcon } from "@typebot.io/ui/icons/CodeIcon";
import { useDrag } from "@use-gesture/react";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { useGraph } from "@/features/graph/providers/GraphProvider";
import { useRightPanel } from "@/hooks/useRightPanel";
import { useTypebot } from "../../editor/providers/TypebotProvider";
import { runtimes } from "../data";
import { ConsolePanel, type ConsoleLogEntry } from "./ConsolePanel";
import { PreviewDrawerBody } from "./PreviewDrawerBody";
import { ResizeHandle } from "./ResizeHandle";
import { RuntimeMenu } from "./RuntimeMenu";

const preferredRuntimeKey = "preferredRuntime";

const getDefaultRuntime = (typebotId?: string) => {
  if (!typebotId) return runtimes[0];
  const preferredRuntime = localStorage.getItem(preferredRuntimeKey);
  return (
    runtimes.find((runtime) => runtime.name === preferredRuntime) ?? runtimes[0]
  );
};

export const PreviewDrawer = () => {
  const { typebot, save, isSavingLoading } = useTypebot();
  const { t } = useTranslate();
  const { setPreviewingBlock } = useGraph();
  const [width, setWidth] = useState(500);
  const [selectedRuntime, setSelectedRuntime] = useState<
    (typeof runtimes)[number]
  >(getDefaultRuntime(typebot?.id));
  const [, setRightPanel] = useRightPanel();
  const [showConsole, setShowConsole] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogEntry[]>([]);

  const handleNewLogs = (logs: ContinueChatResponse["logs"]) => {
    if (!logs?.length) return;
    logs.forEach((log) => {
      if (log.status === "error") {
        toast({
          title: log.context,
          type: "error",
          description: log.description,
          details: log.details,
        });
      }
    });
    setConsoleLogs((prev) => [
      ...prev,
      ...logs.map((log) => ({ ...log, receivedAt: new Date() })),
    ]);
  };

  const handleRestartClick = async () => {
    await save();
    setConsoleLogs([]);
    reload();
  };

  const handleCloseClick = () => {
    setPreviewingBlock(undefined);
    setRightPanel(null);
  };

  const useResizeHandleDrag = useDrag(
    (state) => {
      setWidth(-state.offset[0]);
    },
    {
      from: () => [-width, 0],
    },
  );

  const setPreviewRuntimeAndSaveIntoLocalStorage = (
    runtime: (typeof runtimes)[number],
  ) => {
    setSelectedRuntime(runtime);
    localStorage.setItem(preferredRuntimeKey, runtime.name);
  };

  return (
    <div
      className="group/drawer flex absolute border-l shadow-md p-6 right-0 top-0 h-full bg-gray-1 rounded-l-lg z-10"
      style={{ width: `${width}px` }}
    >
      <ResizeHandle
        {...useResizeHandleDrag()}
        className="absolute left-[-7.5px] top-1/2 -translate-y-1/2 opacity-0 pointer-events-none transition-opacity group-hover/drawer:opacity-100 group-hover/drawer:pointer-events-auto group-focus-within/drawer:opacity-100 group-focus-within/drawer:pointer-events-auto"
      />
      <div className="flex flex-col flex-1 gap-4">
        <div className="flex items-center gap-2 justify-between shrink-0">
          <div className="flex items-center gap-2">
            <RuntimeMenu
              selectedRuntime={selectedRuntime}
              onSelectRuntime={setPreviewRuntimeAndSaveIntoLocalStorage}
            />
            {selectedRuntime.name === "Web" ? (
              <>
                <Button
                  onClick={handleRestartClick}
                  disabled={isSavingLoading}
                  variant="ghost"
                >
                  {t("preview.restartButton.label")}
                </Button>
                <Button
                  variant={showConsole ? "secondary" : "ghost"}
                  size="icon"
                  aria-label="Toggle console"
                  onClick={() => setShowConsole((v) => !v)}
                >
                  <CodeIcon />
                </Button>
              </>
            ) : null}
          </div>

          <Button onClick={handleCloseClick} variant="secondary" size="icon">
            <Cancel01Icon />
          </Button>
        </div>
        <div className="flex flex-col flex-1 min-h-0">
          <PreviewDrawerBody
            runtime={selectedRuntime.name}
            onNewLogs={handleNewLogs}
          />
          {showConsole && selectedRuntime.name === "Web" && (
            <ConsolePanel
              logs={consoleLogs}
              onClear={() => setConsoleLogs([])}
            />
          )}
        </div>
      </div>
    </div>
  );
};
