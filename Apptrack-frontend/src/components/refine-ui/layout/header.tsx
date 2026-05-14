import { ThemeToggle } from "@/components/refine-ui/theme/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useRefineOptions } from "@refinedev/core";
import { LogOutIcon } from "lucide-react";
import { useSession, signOut } from "@/lib/auth-client";
import { useNavigate } from "react-router";
import { GenerativeAvatar } from "@/components/dataviz/GenerativeAvatar";

export const Header = () => {
  const { isMobile } = useSidebar();

  return <>{isMobile ? <MobileHeader /> : <DesktopHeader />}</>;
};

function DesktopHeader() {
  return (
    <header
      className={cn(
        "sticky",
        "top-0",
        "flex",
        "h-16",
        "shrink-0",
        "items-center",
        "gap-4",
        "border-b",
        "border-border",
        "bg-sidebar",
        "pr-3",
        "justify-end",
        "z-40"
      )}
    >
      <ThemeToggle />
      <UserDropdown />
    </header>
  );
}

function MobileHeader() {
  const { open, isMobile } = useSidebar();

  const { title } = useRefineOptions();

  return (
    <header
      className={cn(
        "sticky",
        "top-0",
        "flex",
        "h-12",
        "shrink-0",
        "items-center",
        "gap-2",
        "border-b",
        "border-border",
        "bg-sidebar",
        "pr-3",
        "justify-between",
        "z-40"
      )}
    >
      <SidebarTrigger
        className={cn("text-muted-foreground", "rotate-180", "ml-1", {
          "opacity-0": open,
          "opacity-100": !open || isMobile,
          "pointer-events-auto": !open || isMobile,
          "pointer-events-none": open && !isMobile,
        })}
      />

      <div
        className={cn(
          "whitespace-nowrap",
          "flex",
          "flex-row",
          "h-full",
          "items-center",
          "justify-start",
          "gap-2",
          "transition-discrete",
          "duration-200",
          {
            "pl-3": !open,
            "pl-5": open,
          }
        )}
      >
        <div>{title.icon}</div>
        <h2
          className={cn(
            "text-sm",
            "font-bold",
            "transition-opacity",
            "duration-200",
            {
              "opacity-0": !open,
              "opacity-100": open,
            }
          )}
        >
          {title.text}
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle className={cn("h-8", "w-8")} />
        <UserDropdown />
      </div>
    </header>
  );
}

const UserDropdown = () => {
  const { data: session } = useSession();
  const navigate = useNavigate();

  if (!session) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const identityKey = session.user.name || session.user.email || 'user';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-md ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <GenerativeAvatar name={identityKey} size={32} className="cursor-pointer" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem disabled className="flex items-center gap-3 py-2">
          <GenerativeAvatar name={identityKey} size={36} />
          <div className="flex flex-col items-start min-w-0">
            <span className="font-medium truncate w-full">{session.user.name}</span>
            <span className="font-mono text-[10px] text-muted-foreground truncate w-full">
              {session.user.email}
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOutIcon className={cn("text-destructive")} />
          <span className={cn("text-destructive")}>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

Header.displayName = "Header";
MobileHeader.displayName = "MobileHeader";
DesktopHeader.displayName = "DesktopHeader";
