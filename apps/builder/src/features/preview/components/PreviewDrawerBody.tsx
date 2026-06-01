import type { ContinueChatResponse } from "@typebot.io/chat-api/schemas";
import type { JSX } from "react";
import type { runtimes } from "../data";
import { ApiPreviewInstructions } from "./ApiPreviewInstructions";
import { WebPreview } from "./WebPreview";
import { WhatsAppPreviewInstructions } from "./WhatsAppPreviewInstructions";

type Props = {
  runtime: (typeof runtimes)[number]["name"];
  onNewLogs: (logs: ContinueChatResponse["logs"]) => void;
};

export const PreviewDrawerBody = ({
  runtime,
  onNewLogs,
}: Props): JSX.Element => {
  switch (runtime) {
    case "Web": {
      return <WebPreview onNewLogs={onNewLogs} />;
    }
    case "WhatsApp": {
      return <WhatsAppPreviewInstructions onNewLogs={onNewLogs} />;
    }
    case "API": {
      return <ApiPreviewInstructions className="pt-4" />;
    }
  }
};
