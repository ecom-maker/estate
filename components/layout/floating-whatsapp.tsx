"use client";

import { usePathname } from "next/navigation";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { WHATSAPP_NUMBER } from "@/lib/whatsapp";

const DEFAULT_MESSAGE =
  "Hi DM Global, I'd like to know more about your properties.";

/**
 * Prefilled WhatsApp message tailored to the current page, so the AI agent
 * knows which property/project the enquiry is about. On a unit or project page
 * the URL slug is included (it carries the type, location and project name);
 * elsewhere a generic greeting is used.
 */
function messageForPath(pathname: string): string {
  const unit = pathname.match(/^\/properties\/unit\/([^/?#]+)/);
  if (unit) {
    return `Hi DM Global, I'd like to know more about your property or project ${decodeURIComponent(
      unit[1],
    )}`;
  }
  const project = pathname.match(/^\/projects\/([^/?#]+)/);
  if (project) {
    return `Hi DM Global, I'd like to know more about your property or project ${decodeURIComponent(
      project[1],
    )}`;
  }
  return DEFAULT_MESSAGE;
}

/**
 * Prominent floating WhatsApp button, shown on every page (mounted in the root
 * layout). Opens a chat with the business line. z-40 so sign-in modals (z-50+)
 * still sit above it.
 */
export function FloatingWhatsApp() {
  const pathname = usePathname();
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    messageForPath(pathname ?? ""),
  )}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      title="Chat on WhatsApp"
      className="fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_12px_32px_rgba(37,211,102,0.5)] transition hover:scale-105 hover:bg-[#1ebe5d] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/40 md:bottom-6 md:right-6 md:h-16 md:w-16"
    >
      {/* Soft pulse ring to draw the eye. */}
      <span
        className="absolute inset-0 rounded-full bg-[#25D366] opacity-60 motion-safe:animate-ping"
        aria-hidden
      />
      <WhatsAppIcon className="relative h-7 w-7 md:h-8 md:w-8" />
    </a>
  );
}
