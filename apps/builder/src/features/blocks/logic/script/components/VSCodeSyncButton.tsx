import type { BlockWithOptions } from "@typebot.io/blocks-core/schemas/schema";
import { LogicBlockType } from "@typebot.io/blocks-logic/constants";
import type { ScriptBlock } from "@typebot.io/blocks-logic/script/schema";
import { Button } from "@typebot.io/ui/components/Button";
import { Dialog } from "@typebot.io/ui/components/Dialog";
import { SourceCodeIcon } from "@typebot.io/ui/icons/SourceCodeIcon";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { orpc } from "@/lib/queryClient";
import { useTypebot } from "@/features/editor/providers/TypebotProvider";

export const VSCodeSyncButton = () => {
  const { typebot, updateBlock } = useTypebot();
  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [folderPath, setFolderPath] = useState<string>();
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const lastImportedRef = useRef<Record<string, string>>({});

  const scriptBlocks =
    typebot?.groups.flatMap((group, groupIndex) =>
      group.blocks.flatMap((block, blockIndex) =>
        block.type === LogicBlockType.SCRIPT
          ? [
              {
                block: block as ScriptBlock,
                groupIndex,
                blockIndex,
                groupTitle: group.title,
              },
            ]
          : [],
      ),
    ) ?? [];

  const { mutate: exportScripts, isPending: isExporting } = useMutation(
    orpc.scripts.exportScripts.mutationOptions({
      onSuccess: ({ folderPath }) => {
        setFolderPath(folderPath);
        scriptBlocks.forEach(({ block }) => {
          lastImportedRef.current[block.id] = block.options?.content ?? "";
        });
        setIsSyncing(true);
      },
    }),
  );

  const { data: syncedScripts } = useQuery({
    ...orpc.scripts.importScripts.queryOptions({
      input: { typebotId: typebot?.id ?? "" },
    }),
    enabled: isSyncing && !!typebot?.id,
    refetchInterval: 2000,
  });

  const { data: unlinkedFiles } = useQuery({
    ...orpc.scripts.getUnlinkedFiles.queryOptions({
      input: { typebotId: typebot?.id ?? "" },
    }),
    enabled: isSyncing && !!typebot?.id,
    refetchInterval: 2000,
  });

  const { mutate: linkFile } = useMutation(
    orpc.scripts.linkFile.mutationOptions({
      onSuccess: ({ content }, { blockId }) => {
        const found = scriptBlocks.find((s) => s.block.id === blockId);
        if (!found) return;
        lastImportedRef.current[blockId] = content;
        updateBlock(
          { groupIndex: found.groupIndex, blockIndex: found.blockIndex },
          {
            ...found.block,
            options: { ...found.block.options, content },
          } as BlockWithOptions,
        );
        setExpandedFile(null);
      },
    }),
  );

  useEffect(() => {
    if (!syncedScripts) return;
    const changed = syncedScripts.filter(
      (s) => lastImportedRef.current[s.id] !== s.content,
    );
    if (changed.length === 0) return;
    changed.forEach((s) => {
      lastImportedRef.current[s.id] = s.content;
    });
    changed.forEach((updated) => {
      const found = scriptBlocks.find((s) => s.block.id === updated.id);
      if (!found) return;
      updateBlock(
        { groupIndex: found.groupIndex, blockIndex: found.blockIndex },
        {
          ...found.block,
          options: { ...found.block.options, content: updated.content },
        } as BlockWithOptions,
      );
    });
  }, [syncedScripts]);

  const handleOpen = () => {
    setIsSyncing(false);
    setFolderPath(undefined);
    setExpandedFile(null);
    lastImportedRef.current = {};
    setIsOpen(true);
  };

  const handleExport = () => {
    if (!typebot) return;
    exportScripts({
      typebotId: typebot.id,
      scripts: scriptBlocks.map(({ block, groupTitle }) => ({
        id: block.id,
        name: block.options?.name ?? "untitled",
        groupName: groupTitle,
        content: block.options?.content ?? "",
      })),
      variables: (typebot.variables ?? [])
        .map((v) => ({ name: v.name ?? "" }))
        .filter((v) => v.name),
    });
  };

  const byGroup = scriptBlocks.reduce<Record<string, typeof scriptBlocks>>(
    (acc, entry) => {
      const key = entry.groupTitle;
      return { ...acc, [key]: [...(acc[key] ?? []), entry] };
    },
    {},
  );

  return (
    <>
      <Button
        variant="secondary"
        size="icon"
        aria-label="VS Code sync"
        onClick={handleOpen}
      >
        <SourceCodeIcon />
      </Button>
      <Dialog.Root isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <Dialog.Popup className="max-w-md">
          <Dialog.Title className="text-base font-medium pr-10">
            VS Code sync
          </Dialog.Title>
          <Dialog.CloseButton />
          {scriptBlocks.length === 0 ? (
            <p className="text-sm text-gray-10">
              No Script blocks found in this typebot.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-11">
                Scripts open as{" "}
                <code className="text-xs bg-gray-3 px-1 rounded">.js</code>{" "}
                files. Move them anywhere — re-exporting finds them by their
                embedded ID. Changes in VS Code sync back every 2s.
              </p>

              {/* Linked script blocks */}
              <div className="flex flex-col gap-2">
                {Object.entries(byGroup).map(([groupTitle, entries]) => (
                  <div key={groupTitle} className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-gray-10 uppercase tracking-wide">
                      {groupTitle}
                    </span>
                    {entries.map(({ block }) => (
                      <div
                        key={block.id}
                        className="flex items-center gap-2 text-sm px-2 py-1 rounded bg-gray-2"
                      >
                        <span className="flex-1 truncate">
                          {block.options?.name || "untitled"}
                        </span>
                        {isSyncing && (
                          <span className="text-[10px] text-green-10 font-mono shrink-0">
                            watching
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Unlinked files — only shown while syncing */}
              {isSyncing && unlinkedFiles && unlinkedFiles.length > 0 && (
                <div className="flex flex-col gap-1 border-t border-gray-4 pt-3">
                  <span className="text-xs font-medium text-orange-10 uppercase tracking-wide">
                    Unlinked files
                  </span>
                  <p className="text-xs text-gray-10">
                    These files have no script block yet. Pick a block to link
                    them to.
                  </p>
                  {unlinkedFiles.map(({ relPath }) => (
                    <div key={relPath} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 px-2 py-1 rounded bg-orange-2">
                        <span className="flex-1 text-sm font-mono truncate">
                          {relPath}
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="shrink-0"
                          onClick={() =>
                            setExpandedFile(
                              expandedFile === relPath ? null : relPath,
                            )
                          }
                        >
                          Link
                        </Button>
                      </div>
                      {expandedFile === relPath && (
                        <div className="flex flex-col gap-0.5 ml-2">
                          {scriptBlocks.map(({ block, groupTitle }) => (
                            <Button
                              key={block.id}
                              variant="ghost"
                              size="sm"
                              className="justify-start text-left"
                              onClick={() => {
                                if (!typebot) return;
                                linkFile({
                                  typebotId: typebot.id,
                                  relPath,
                                  blockId: block.id,
                                });
                              }}
                            >
                              <span className="truncate">
                                {block.options?.name || "untitled"}
                              </span>
                              <span className="ml-auto text-[10px] text-gray-10 shrink-0">
                                {groupTitle}
                              </span>
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {folderPath && (
                <p className="text-xs text-gray-10 font-mono break-all">
                  {folderPath}
                </p>
              )}
              <div className="flex gap-2">
                {isSyncing ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsSyncing(false)}
                  >
                    Stop syncing
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={isExporting}
                    onClick={handleExport}
                  >
                    {isExporting ? "Exporting…" : "Export & open in VS Code"}
                  </Button>
                )}
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Root>
    </>
  );
};
