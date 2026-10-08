import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AgentShell, EmptyState } from "@/components/agent/agent-shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Appointments" };

export default async function AppointmentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=%2Fagent%2Fappointments");

  return (
    <AgentShell
      title="Appointments"
      subtitle="Scheduled property viewings and meetings."
    >
      <EmptyState>
        No appointments scheduled. Viewings booked with customers will appear
        here.
      </EmptyState>
    </AgentShell>
  );
}
