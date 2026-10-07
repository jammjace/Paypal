"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mutateAction } from "@/server/actions";
import type { PalCommand } from "@/services/commands";

export function useMutation(revision: number) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();
  function submit(command: PalCommand, success?: () => void) {
    if (pending) return;
    setMessage("");
    const requestId = crypto.randomUUID();
    start(async () => {
      try {
        const result = await mutateAction({ command, revision, requestId });
        setMessage(result.message);
        if (result.ok) { success?.(); router.refresh(); }
      } catch { setMessage("Unable to reach Pal. Refresh to check whether your change was saved."); }
    });
  }
  return { submit, pending, message, setMessage, router };
}
