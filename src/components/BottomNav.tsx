import { Link, useLocation } from "@tanstack/react-router";
import { Home, Map, Trophy, User, Play } from "lucide-react";

export function BottomNav() {
  const { pathname } = useLocation();
  const items = [
    { to: "/dashboard", label: "Home", Icon: Home },
    { to: "/map", label: "World", Icon: Map },
    { to: "/run", label: "Run", Icon: Play, primary: true },
    { to: "/leaderboard", label: "Ranks", Icon: Trophy },
    { to: "/profile", label: "Me", Icon: User },
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-surface/90 backdrop-blur-lg">
      <div className="mx-auto max-w-screen-sm grid grid-cols-5 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {items.map(({ to, label, Icon, primary }) => {
          const active = pathname === to || (to !== "/dashboard" && pathname.startsWith(to));
          if (primary) {
            return (
              <Link
                key={to}
                to={to}
                className="flex flex-col items-center justify-center -mt-6"
              >
                <span className="grad-saffron rounded-full h-14 w-14 flex items-center justify-center glow-saffron pulse-ring text-primary-foreground">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="mt-1 text-[10px] font-bold tracking-wide uppercase text-saffron">
                  {label}
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center justify-center py-1 gap-0.5 ${active ? "text-saffron" : "text-muted-foreground"}`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-semibold">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
