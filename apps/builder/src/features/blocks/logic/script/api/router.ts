import { authenticatedProcedure } from "@typebot.io/config/orpc/builder/middlewares";
import { z } from "zod";
import {
  handleExportScripts,
  handleGetSrcScript,
  handleGetUnlinkedFiles,
  handleImportScripts,
  handleLinkFile,
  handleListSrcScripts,
  scriptFileSchema,
} from "./handleSyncScripts";

export const scriptsRouter = {
  exportScripts: authenticatedProcedure
    .input(
      z.object({
        typebotId: z.string(),
        scripts: z.array(scriptFileSchema),
        variables: z.array(z.object({ name: z.string() })),
      }),
    )
    .output(z.object({ folderPath: z.string() }))
    .handler(handleExportScripts),

  importScripts: authenticatedProcedure
    .input(z.object({ typebotId: z.string() }))
    .output(z.array(z.object({ id: z.string(), content: z.string() })))
    .handler(handleImportScripts),

  getUnlinkedFiles: authenticatedProcedure
    .input(z.object({ typebotId: z.string() }))
    .output(z.array(z.object({ relPath: z.string() })))
    .handler(handleGetUnlinkedFiles),

  linkFile: authenticatedProcedure
    .input(
      z.object({
        typebotId: z.string(),
        relPath: z.string(),
        blockId: z.string(),
      }),
    )
    .output(z.object({ content: z.string() }))
    .handler(handleLinkFile),

  listSrcScripts: authenticatedProcedure
    .input(z.object({ typebotId: z.string() }))
    .output(z.array(z.object({ relPath: z.string(), name: z.string() })))
    .handler(handleListSrcScripts),

  getSrcScript: authenticatedProcedure
    .input(z.object({ typebotId: z.string(), relPath: z.string() }))
    .output(z.object({ content: z.string(), name: z.string() }))
    .handler(handleGetSrcScript),
};

export type ScriptsRouter = typeof scriptsRouter;
