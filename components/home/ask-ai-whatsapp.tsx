import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { WHATSAPP_NUMBER } from "@/lib/whatsapp";

const GREETING = "Hi DM Global, I'd like help finding a property.";

/** Home-page shortcut to the WhatsApp AI assistant, shown under the hero search. */
export function AskAiOnWhatsApp() {
  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(GREETING)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(15,23,42,0.25)] transition hover:bg-[#1ebe5d]"
    >
      <WhatsAppIcon className="h-5 w-5" />
      Ask AI on WhatsApp
    </a>
  );
}
