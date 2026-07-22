import { Nav } from './nav';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 border-r border-border bg-card md:flex md:flex-col">
        <div className="flex h-16 items-center border-b border-border px-6">
          <span className="text-base font-semibold tracking-tight">
            脚本创作智能体
          </span>
        </div>
        <Nav />
      </aside>

      <header className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center border-b border-border bg-card px-4 md:hidden">
        <span className="text-sm font-semibold tracking-tight">脚本创作智能体</span>
      </header>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card md:hidden">
        <Nav />
      </div>

      <main className="flex-1 pt-14 md:pl-56 md:pt-0">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
