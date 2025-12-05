"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlignRight } from "lucide-react";

import { Button } from "@shc/ui/button";

import { additionalLinks, defaultLinks } from "~/config/nav";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <div className="mb-4 w-full border-b pb-2 md:hidden">
      <nav className="flex w-full items-center justify-between">
        <div className="text-lg font-semibold">Ubumuntu</div>
        <Button variant="ghost" onClick={() => setOpen(!open)}>
          <AlignRight />
        </Button>
      </nav>
      {open ? (
        <div className="my-4 bg-muted p-4">
          <ul className="space-y-2">
            {defaultLinks.map((link) => (
              <li key={link.title} onClick={() => setOpen(false)} className="">
                <Link
                  href={link.href}
                  className={
                    pathname === link.href
                      ? "font-semibold text-primary hover:text-primary"
                      : "text-muted-foreground hover:text-primary"
                  }
                >
                  <span className="flex items-center gap-2">
                    <link.icon className="h-4 w-4" />
                    {link.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {/* Therapy section */}
          {additionalLinks.map((section) => (
            <div key={section.title} className="mt-4 border-t pt-4">
              <h4 className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.title} onClick={() => setOpen(false)}>
                    <Link
                      href={link.href}
                      className={
                        pathname === link.href
                          ? "font-semibold text-primary hover:text-primary"
                          : "text-muted-foreground hover:text-primary"
                      }
                    >
                      <span className="flex items-center gap-2">
                        <link.icon className="h-4 w-4" />
                        {link.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
