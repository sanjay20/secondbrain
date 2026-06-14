"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  LayoutDashboard,
  Heart,
  Briefcase,
  Wallet,
  BookOpen,
  NotebookPen,
  Sparkles,
  Settings,
  ChevronRight,
  ListTodo,
  Compass,
  Smile,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMobileNav } from "./mobile-nav";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    color: "text-violet-400",
  },
  {
    label: "Health & Habits",
    href: "/health",
    icon: Heart,
    color: "text-emerald-400",
  },
  {
    label: "Career",
    href: "/career",
    icon: Briefcase,
    color: "text-blue-400",
  },
  {
    label: "Wealth",
    href: "/wealth",
    icon: Wallet,
    color: "text-amber-400",
  },
  {
    label: "Knowledge",
    href: "/knowledge",
    icon: BookOpen,
    color: "text-pink-400",
  },
  {
    label: "Journal",
    href: "/journal",
    icon: NotebookPen,
    color: "text-orange-400",
  },
  {
    label: "Daily Work",
    href: "/dailywork",
    icon: ListTodo,
    color: "text-cyan-400",
  },
  {
    label: "Vision",
    href: "/vision",
    icon: Compass,
    color: "text-fuchsia-400",
  },
  {
    label: "Mood",
    href: "/mindset/mood",
    icon: Smile,
    color: "text-rose-400",
  },
  {
    label: "AI Coach",
    href: "/ai-coach",
    icon: Sparkles,
    color: "text-violet-400",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { open, setOpen } = useMobileNav();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-60 border-r border-border bg-card flex flex-col z-50 transition-transform duration-200 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
          <Brain className="w-5 h-5 text-primary" />
        </div>
        <div>
          <span className="font-bold text-sm gradient-text">SecondBrain</span>
          <p className="text-[10px] text-muted-foreground">Life OS</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 mb-3">
          Modules
        </p>
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <div key={item.href}>
              {(item as { comingSoon?: boolean }).comingSoon ? (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg opacity-40 cursor-not-allowed">
                  <Icon className={cn("w-4 h-4", item.color)} />
                  <span className="text-sm text-foreground flex-1">{item.label}</span>
                  <span className="text-[9px] bg-secondary border border-border rounded px-1 py-0.5 text-muted-foreground">
                    Soon
                  </span>
                </div>
              ) : (
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group",
                    isActive
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Icon className={cn("w-4 h-4 transition-colors", isActive ? item.color : "group-hover:" + item.color.replace("text-", "text-"))} />
                  <span className="text-sm flex-1">{item.label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 text-primary" />}
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-border">
        <Link
          href="/settings"
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
        >
          <Settings className="w-4 h-4" />
          <span className="text-sm">Settings</span>
        </Link>
      </div>
    </aside>
    </>
  );
}
