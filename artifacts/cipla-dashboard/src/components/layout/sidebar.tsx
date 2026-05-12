import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, Users, Stethoscope, ClipboardList, 
  LogOut, ChevronRight, Shield, User
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const adminNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/managers", label: "Managers", icon: Users },
  { href: "/doctors", label: "All Doctors", icon: Stethoscope },
];

const managerNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/my-doctors", label: "My Doctors", icon: ClipboardList },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const navItems = user?.role === "admin" ? adminNav : managerNav;

  return (
    <div className="flex flex-col h-full w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">C</span>
        </div>
        <div>
          <div className="font-bold text-white text-sm tracking-wide">CIPLA</div>
          <div className="text-[10px] text-sidebar-foreground/60 uppercase tracking-widest">Healthcare Campaign</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = location === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => onClose?.()}
              data-testid={`nav-link-${label.toLowerCase().replace(/\s+/g, "-")}`}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-primary text-white shadow-sm"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-white/8"
              )}
            >
              <Icon size={17} />
              <span>{label}</span>
              {isActive && <ChevronRight size={14} className="ml-auto" />}
            </Link>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            {user?.role === "admin" ? (
              <Shield size={14} className="text-primary" />
            ) : (
              <User size={14} className="text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-sidebar-foreground/50 capitalize">{user?.role}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          data-testid="button-logout"
          className="w-full justify-start gap-2 text-sidebar-foreground/60 hover:text-white hover:bg-white/8 text-sm"
        >
          <LogOut size={15} />
          Sign out
        </Button>
      </div>
    </div>
  );
}
