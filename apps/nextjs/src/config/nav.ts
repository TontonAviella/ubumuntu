import { BarChart3, Cog, HomeIcon, Mic, TrendingUp } from "lucide-react";

import type { SidebarLink } from "~/components/sidebar-items";

interface AdditionalLinks {
  title: string;
  links: SidebarLink[];
}

export const defaultLinks: SidebarLink[] = [
  { href: "/dashboard", title: "Home", icon: HomeIcon },
  { href: "/account", title: "Account", icon: Cog },
  { href: "/settings", title: "Settings", icon: Cog },
];

export const additionalLinks: AdditionalLinks[] = [
  {
    title: "Therapy",
    links: [
      {
        href: "/exercises",
        title: "Exercises",
        icon: Mic,
      },
      {
        href: "/progress",
        title: "Progress",
        icon: TrendingUp,
      },
      {
        href: "/analytics",
        title: "Analytics",
        icon: BarChart3,
      },
    ],
  },
];
