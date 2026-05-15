"use client";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent as ShadcnSidebarContent,
  SidebarFooter as ShadcnSidebarFooter,
  SidebarHeader as ShadcnSidebarHeader,
  SidebarRail as ShadcnSidebarRail,
  SidebarTrigger as ShadcnSidebarTrigger,
  useSidebar as useShadcnSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
  useLink,
  useMenu,
  useRefineOptions,
  type TreeMenuItem,
} from "@refinedev/core";
import { ChevronRight, LogOut } from "lucide-react";
import React from "react";
import { useSession, signOut } from "@/lib/auth-client";
import { useNavigate } from "react-router";
import { GenerativeAvatar } from "@/components/dataviz/GenerativeAvatar";

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────────────────────
export function Sidebar() {
  const { open } = useShadcnSidebar();
  const { menuItems, selectedKey } = useMenu();

  return (
    <ShadcnSidebar collapsible="icon" className="border-r border-border">
      <ShadcnSidebarRail />
      <SidebarHeader />
      <ShadcnSidebarContent
        className={cn(
          "flex flex-col gap-0.5 pt-3 pb-2 transition-all duration-200",
          open ? "px-2" : "px-1.5"
        )}
      >
        {menuItems.map((item: TreeMenuItem) => (
          <SidebarItem
            key={item.key || item.name}
            item={item}
            selectedKey={selectedKey}
          />
        ))}
      </ShadcnSidebarContent>
      <SidebarFooter />
    </ShadcnSidebar>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Items
// ─────────────────────────────────────────────────────────────────────────────
type MenuItemProps = {
  item: TreeMenuItem;
  selectedKey?: string;
};

function SidebarItem({ item, selectedKey }: MenuItemProps) {
  const { open } = useShadcnSidebar();

  if (item.meta?.group) {
    return <SidebarItemGroup item={item} selectedKey={selectedKey} />;
  }

  if (item.children && item.children.length > 0) {
    if (open) {
      return <SidebarItemCollapsible item={item} selectedKey={selectedKey} />;
    }
    return <SidebarItemDropdown item={item} selectedKey={selectedKey} />;
  }

  return <SidebarItemLink item={item} selectedKey={selectedKey} />;
}

function SidebarItemGroup({ item, selectedKey }: MenuItemProps) {
  const { children } = item;
  const { open } = useShadcnSidebar();

  return (
    <div className="border-t border-sidebar-border pt-3 mt-2">
      <span
        className={cn(
          "ml-3 block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition-opacity duration-200",
          open ? "opacity-100 h-6" : "opacity-0 h-0 pointer-events-none"
        )}
      >
        // {getDisplayName(item)}
      </span>
      {children && children.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {children.map((child: TreeMenuItem) => (
            <SidebarItem
              key={child.key || child.name}
              item={child}
              selectedKey={selectedKey}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarItemCollapsible({ item, selectedKey }: MenuItemProps) {
  const { name, children } = item;

  const chevronIcon = (
    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
  );

  return (
    <Collapsible key={`collapsible-${name}`} className="w-full group">
      <CollapsibleTrigger asChild>
        <SidebarButton item={item} rightIcon={chevronIcon} />
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-5 flex flex-col gap-0.5 mt-0.5 border-l border-border pl-2">
        {children?.map((child: TreeMenuItem) => (
          <SidebarItem
            key={child.key || child.name}
            item={child}
            selectedKey={selectedKey}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function SidebarItemDropdown({ item, selectedKey }: MenuItemProps) {
  const { children } = item;
  const Link = useLink();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarButton item={item} />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start">
        {children?.map((child: TreeMenuItem) => {
          const { key: childKey } = child;
          const isSelected = childKey === selectedKey;

          return (
            <DropdownMenuItem key={childKey || child.name} asChild>
              <Link
                to={child.route || ""}
                className={cn("flex w-full items-center gap-2", {
                  "bg-accent text-accent-foreground": isSelected,
                })}
              >
                <ItemIcon
                  icon={child.meta?.icon ?? child.icon}
                  isSelected={isSelected}
                />
                <span>{getDisplayName(child)}</span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarItemLink({ item, selectedKey }: MenuItemProps) {
  const isSelected = item.key === selectedKey;
  return <SidebarButton item={item} isSelected={isSelected} asLink />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Header (logo + collapse trigger)
// ─────────────────────────────────────────────────────────────────────────────
function SidebarHeader() {
  const { title } = useRefineOptions();
  const { open, isMobile } = useShadcnSidebar();

  return (
    <ShadcnSidebarHeader
      className={cn(
        "p-0 h-14 border-b border-sidebar-border flex-row items-center justify-between overflow-hidden"
      )}
    >
      <div
        className={cn(
          "whitespace-nowrap flex flex-row h-full items-center justify-start gap-2.5 transition-all duration-200",
          open ? "pl-4" : "pl-3"
        )}
      >
        <div className="shrink-0">{title.icon}</div>
        <h2
          className={cn(
            "text-sm font-mono tracking-tight transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0"
          )}
        >
          {title.text}
        </h2>
      </div>

      <ShadcnSidebarTrigger
        className={cn(
          "text-muted-foreground hover:text-foreground mr-2 h-7 w-7",
          open || isMobile
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
      />
    </ShadcnSidebarHeader>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer (user account dropdown)
// ─────────────────────────────────────────────────────────────────────────────
function SidebarFooter() {
  const { data: session } = useSession();
  const { open } = useShadcnSidebar();
  const navigate = useNavigate();

  if (!session) return null;

  const identityKey = session.user.name || session.user.email || "user";

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <ShadcnSidebarFooter className="p-0 border-t border-sidebar-border">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-2.5 w-full text-left transition-colors hover:bg-accent/50",
              "h-12",
              open ? "px-3" : "px-2 justify-center"
            )}
          >
            <GenerativeAvatar
              name={identityKey}
              size={28}
              className="shrink-0"
            />
            <div
              className={cn(
                "flex flex-col min-w-0 transition-opacity duration-200",
                open ? "opacity-100" : "opacity-0 w-0 pointer-events-none"
              )}
            >
              <span className="text-xs font-medium truncate leading-tight">
                {session.user.name}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground truncate leading-tight">
                {session.user.email}
              </span>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="end" className="w-60">
          <DropdownMenuItem disabled className="flex items-center gap-3 py-2">
            <GenerativeAvatar name={identityKey} size={36} />
            <div className="flex flex-col items-start min-w-0">
              <span className="font-medium truncate w-full">
                {session.user.name}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground truncate w-full">
                {session.user.email}
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="text-destructive h-4 w-4" />
            <span className="text-destructive">Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ShadcnSidebarFooter>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function getDisplayName(item: TreeMenuItem) {
  return item.meta?.label ?? item.label ?? item.name;
}

type IconProps = {
  icon: React.ReactNode;
  isSelected?: boolean;
};

function ItemIcon({ icon, isSelected }: IconProps) {
  if (!icon) return null;
  return (
    <div
      className={cn(
        "shrink-0 [&>svg]:h-4 [&>svg]:w-4 transition-colors",
        isSelected ? "text-foreground" : "text-muted-foreground"
      )}
    >
      {icon}
    </div>
  );
}

type SidebarButtonProps = React.ComponentProps<typeof Button> & {
  item: TreeMenuItem;
  isSelected?: boolean;
  rightIcon?: React.ReactNode;
  asLink?: boolean;
  onClick?: () => void;
};

function SidebarButton({
  item,
  isSelected = false,
  rightIcon,
  asLink = false,
  className,
  onClick,
  ...props
}: SidebarButtonProps) {
  const Link = useLink();
  const { open } = useShadcnSidebar();

  const buttonContent = (
    <>
      {/* Left accent bar — subtle, like Linear/Notion */}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-primary transition-opacity duration-150",
          isSelected ? "opacity-100" : "opacity-0"
        )}
      />
      <ItemIcon icon={item.meta?.icon ?? item.icon} isSelected={isSelected} />
      <span
        className={cn(
          "tracking-[-0.005em] text-[13px] transition-opacity duration-200",
          rightIcon ? "flex-1 text-left" : "truncate",
          isSelected
            ? "font-semibold text-foreground"
            : "font-normal text-muted-foreground group-hover:text-foreground",
          !open && "opacity-0 w-0"
        )}
      >
        {getDisplayName(item)}
      </span>
      {rightIcon}
    </>
  );

  return (
    <Button
      asChild={!!(asLink && item.route)}
      variant="ghost"
      size="sm"
      className={cn(
        "group relative flex w-full items-center justify-start gap-2.5 h-9 !px-3 rounded-md transition-colors",
        isSelected
          ? "bg-accent hover:bg-accent text-foreground"
          : "hover:bg-accent/50 text-muted-foreground hover:text-foreground",
        className
      )}
      onClick={onClick}
      {...props}
    >
      {asLink && item.route ? (
        <Link
          to={item.route}
          className="flex w-full items-center gap-2.5 relative"
        >
          {buttonContent}
        </Link>
      ) : (
        buttonContent
      )}
    </Button>
  );
}

Sidebar.displayName = "Sidebar";
