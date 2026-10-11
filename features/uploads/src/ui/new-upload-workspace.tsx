"use client";

import { useState } from "react";

import {
  createBrowserServices,
  type UploadsClientServices,
} from "../client/browser-services.ts";
import { UploadPanel } from "./components/upload-panel.tsx";
import { useUploadSession } from "./hooks/use-upload-session.ts";

// The client composition root of the page that adds an image: one upload session. The library lives on
// its own page, so there is nothing here to keep in step with it.
export function NewUploadWorkspace({
  services: provided,
}: {
  // Defaults to the browser's own fetch, XHR, crypto, and timers; tests pass fakes.
  readonly services?: UploadsClientServices;
}) {
  const [services] = useState(() => provided ?? createBrowserServices());
  const session = useUploadSession(services);
  return <UploadPanel session={session} />;
}
