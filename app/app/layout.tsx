import { SessionProvider } from "@/components/app/Session";
import { AppShell } from "@/components/app/AppShell";

export const metadata = { title: "App" };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
