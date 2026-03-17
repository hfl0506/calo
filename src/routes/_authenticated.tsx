import { Link, Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import BottomNav from "../components/BottomNav";
import { getSession } from "#/lib/server/session";
import { RouteErrorBoundary } from "#/components/RouteErrorBoundary";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) {
      throw redirect({ to: "/sign-in" });
    }
    return { session };
  },
  component: AuthenticatedLayout,
  errorComponent: ({ error, reset }) => <RouteErrorBoundary error={error} reset={reset} />,
});

function AuthenticatedLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>

      {/* Floating add button */}
      <Link
        to="/log"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--lagoon-deep)] text-white shadow-xl transition hover:opacity-90 hover:shadow-2xl"
        aria-label="Log meal"
      >
        <Plus size={28} strokeWidth={2.5} />
      </Link>

      <BottomNav />
    </div>
  );
}
