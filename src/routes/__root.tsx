import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";

function NotFound() {
  return (
    <div className="min-h-screen grad-warrior flex items-center justify-center p-6">
      <div className="card-tactical p-8 text-center max-w-sm">
        <div className="text-6xl mb-2">🗺️</div>
        <h1 className="text-3xl font-extrabold text-saffron">404</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Looks like this territory hasn't been claimed yet.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-full grad-saffron text-primary-foreground px-5 py-2.5 font-bold"
        >
          Back to base
        </Link>
      </div>
    </div>
  );
}

function ErrorBoundary({ error }: { error: Error }) {
  return (
    <div className="min-h-screen grad-warrior flex items-center justify-center p-6">
      <div className="card-tactical p-8 text-center max-w-sm">
        <h1 className="text-xl font-bold">Something broke, soldier.</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <a href="/" className="mt-6 inline-block rounded-full grad-saffron text-primary-foreground px-5 py-2.5 font-bold">
          Reload
        </a>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0F0F1A" },
      { title: "Terra Run — Capture Your City" },
      { name: "description", content: "Worldwide GPS running game. Claim streets, defend your territory, level up." },
      { property: "og:title", content: "Terra Run — Capture Your City" },
      { property: "og:description", content: "Worldwide GPS running game. Claim streets, defend your territory, level up." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Terra Run — Capture Your City" },
      { name: "twitter:description", content: "Worldwide GPS running game. Claim streets, defend your territory, level up." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f2154c44-86a8-4ec3-8faa-0361269ea41f/id-preview-21142dc7--35629e1e-bed6-4e67-9015-0e4e2ad03371.lovable.app-1778598112952.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f2154c44-86a8-4ec3-8faa-0361269ea41f/id-preview-21142dc7--35629e1e-bed6-4e67-9015-0e4e2ad03371.lovable.app-1778598112952.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700;800;900&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorBoundary,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster theme="dark" position="top-center" richColors />
    </QueryClientProvider>
  );
}
