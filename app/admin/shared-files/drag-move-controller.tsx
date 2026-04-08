"use client";

import { useEffect } from "react";

type DragMoveControllerProps = {
  categoryId: string;
  currentFolderId: string;
  q: string;
  status: string;
  folderSort: string;
  fileSort: string;
  viewMode: string;
};

type DragPayload = {
  kind: "file" | "folder";
  id: string;
};

const DROP_TARGET_STYLE = {
  borderColor: "#f59e0b",
  boxShadow: "0 0 0 2px rgba(245, 158, 11, 0.25)",
  background: "#fff7ed",
};

const DEFAULT_TARGET_STYLE = {
  borderColor: "",
  boxShadow: "",
  background: "",
};

function isDragPayload(value: unknown): value is DragPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<DragPayload>;
  return (payload.kind === "file" || payload.kind === "folder") && typeof payload.id === "string";
}

export function DragMoveController({
  categoryId,
  currentFolderId,
  q,
  status,
  folderSort,
  fileSort,
  viewMode,
}: DragMoveControllerProps) {
  useEffect(() => {
    let dragPayload: DragPayload | null = null;
    const draggables = Array.from(document.querySelectorAll<HTMLElement>("[data-drag-kind][data-drag-id]"));
    const dropTargets = Array.from(document.querySelectorAll<HTMLElement>("[data-drop-folder-id]"));

    const setTargetHover = (target: HTMLElement, active: boolean) => {
      target.style.borderColor = active ? DROP_TARGET_STYLE.borderColor : DEFAULT_TARGET_STYLE.borderColor;
      target.style.boxShadow = active ? DROP_TARGET_STYLE.boxShadow : DEFAULT_TARGET_STYLE.boxShadow;
      target.style.background = active ? DROP_TARGET_STYLE.background : DEFAULT_TARGET_STYLE.background;
    };

    const readPayload = (event: DragEvent) => {
      if (dragPayload) return dragPayload;
      const raw = event.dataTransfer?.getData("application/json");
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        return isDragPayload(parsed) ? parsed : null;
      } catch {
        return null;
      }
    };

    const submitMove = async (payload: DragPayload, targetFolderId: string) => {
      const formData = new FormData();
      formData.set("categoryId", categoryId);
      formData.set("redirectFolderId", currentFolderId);
      formData.set("q", q);
      formData.set("status", status);
      formData.set("folderSort", folderSort);
      formData.set("fileSort", fileSort);
      formData.set("viewMode", viewMode);

      const route =
        payload.kind === "file"
          ? "/admin/shared-files/move"
          : "/admin/shared-files/folder-move";

      if (payload.kind === "file") {
        formData.set("fileId", payload.id);
        formData.set("folderId", currentFolderId);
        formData.set("targetFolderId", targetFolderId);
      } else {
        formData.set("folderId", payload.id);
        formData.set("targetParentId", targetFolderId);
      }

      const response = await fetch(route, {
        method: "POST",
        body: formData,
        credentials: "same-origin",
        redirect: "follow",
      });

      window.location.assign(response.url || window.location.href);
    };

    const dragStartHandlers = new Map<HTMLElement, (event: DragEvent) => void>();
    const dragEndHandlers = new Map<HTMLElement, () => void>();
    const dragOverHandlers = new Map<HTMLElement, (event: DragEvent) => void>();
    const dragLeaveHandlers = new Map<HTMLElement, () => void>();
    const dropHandlers = new Map<HTMLElement, (event: DragEvent) => void>();

    for (const element of draggables) {
      element.setAttribute("draggable", "true");
      element.style.cursor = "grab";

      const onDragStart = (event: DragEvent) => {
        const kind = element.dataset.dragKind;
        const id = element.dataset.dragId;
        if (!kind || !id) return;
        dragPayload = { kind: kind as DragPayload["kind"], id };
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("application/json", JSON.stringify(dragPayload));
        }
        element.style.opacity = "0.55";
        document.body.style.cursor = "grabbing";
      };

      const onDragEnd = () => {
        dragPayload = null;
        element.style.opacity = "1";
        document.body.style.cursor = "";
        for (const target of dropTargets) {
          setTargetHover(target, false);
        }
      };

      dragStartHandlers.set(element, onDragStart);
      dragEndHandlers.set(element, onDragEnd);
      element.addEventListener("dragstart", onDragStart);
      element.addEventListener("dragend", onDragEnd);
    }

    for (const target of dropTargets) {
      const onDragOver = (event: DragEvent) => {
        const payload = readPayload(event);
        const targetFolderId = target.dataset.dropFolderId ?? "";
        if (!payload) return;
        if (payload.kind === "folder" && payload.id === targetFolderId) return;
        event.preventDefault();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "move";
        }
        setTargetHover(target, true);
      };

      const onDragLeave = () => {
        setTargetHover(target, false);
      };

      const onDrop = async (event: DragEvent) => {
        const payload = readPayload(event);
        const targetFolderId = target.dataset.dropFolderId ?? "";
        setTargetHover(target, false);
        if (!payload) return;
        if (payload.kind === "folder" && payload.id === targetFolderId) return;
        event.preventDefault();
        await submitMove(payload, targetFolderId);
      };

      dragOverHandlers.set(target, onDragOver);
      dragLeaveHandlers.set(target, onDragLeave);
      dropHandlers.set(target, onDrop);
      target.addEventListener("dragover", onDragOver);
      target.addEventListener("dragleave", onDragLeave);
      target.addEventListener("drop", onDrop);
    }

    return () => {
      for (const [element, handler] of dragStartHandlers) {
        element.removeEventListener("dragstart", handler);
      }
      for (const [element, handler] of dragEndHandlers) {
        element.removeEventListener("dragend", handler);
        element.style.opacity = "1";
        element.style.cursor = "";
      }
      for (const [element, handler] of dragOverHandlers) {
        element.removeEventListener("dragover", handler);
      }
      for (const [element, handler] of dragLeaveHandlers) {
        element.removeEventListener("dragleave", handler);
      }
      for (const [element, handler] of dropHandlers) {
        element.removeEventListener("drop", handler);
        setTargetHover(element, false);
      }
      document.body.style.cursor = "";
    };
  }, [categoryId, currentFolderId, fileSort, folderSort, q, status, viewMode]);

  return null;
}
