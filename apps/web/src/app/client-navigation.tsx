"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { clientNavigationTarget } from "../client-navigation";

// Moves between pages with the router instead of loading each page again, so what lives in the layout (the wallet
// connection above all) stays alive. Without scripts, or for any link it does not take, the browser's own navigation
// still works. Renders nothing.
export function ClientNavigation() {
  const router = useRouter();
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = clientNavigationTarget(event, window.location);
      if (target === null) return;
      event.preventDefault();
      // A link's address is only known when it is clicked, so the router's typed routes cannot check it. It is an
      // internal page path produced and tested by `clientNavigationTarget`; one that matches no page shows the 404.
      router.push(target as Route);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [router]);
  return null;
}
