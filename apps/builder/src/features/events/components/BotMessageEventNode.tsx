import { useTranslate } from "@tolgee/react";
import { EventType } from "@typebot.io/events/constants";
import { EventIcon } from "@/features/events/components/EventIcon";

export const BotMessageEventNode = () => {
  const { t } = useTranslate();

  return (
    <div className="flex flex-1 items-start gap-3 font-normal">
      <EventIcon type={EventType.BOT_MESSAGE} className="mt-1" />
      <p>{t("blocks.events.botMessage.node.label")}</p>
    </div>
  );
};
