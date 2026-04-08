"use client";

import { useEffect, useMemo, useState } from "react";

type ConfirmSubmitButtonProps = {
  children: React.ReactNode;
  confirmMessage: string;
  style?: React.CSSProperties;
  className?: string;
  disabled?: boolean;
};

export function ConfirmSubmitButton({
  children,
  confirmMessage,
  style,
  className,
  disabled,
}: ConfirmSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={className}
      style={style}
      onClick={(event) => {
        if (disabled) return;
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}

export function BulkActionSubmitButton({
  style,
  confirmMessages,
  className,
}: {
  style?: React.CSSProperties;
  confirmMessages?: Record<string, string>;
  className?: string;
}) {
  return (
    <button
      type="submit"
      style={style}
      className={className}
      onClick={(event) => {
        const button = event.currentTarget;
        const form = button.form;
        if (!form) return;

        const actionField = form.elements.namedItem("bulkAction");
        const actionValue =
          actionField instanceof HTMLSelectElement ? actionField.value.toUpperCase() : "";

        const message =
          confirmMessages?.[actionValue] ||
          (actionValue === "DELETE"
            ? "确定要批量标记删除选中的文件吗？这些文件之后仍可恢复。"
            : actionValue === "RESTORE"
              ? "确定要把选中的文件批量恢复为可用状态吗？已归档和已标记删除的文件都会恢复。"
              : "");

        if (message) {
          const confirmed = window.confirm(message);
          if (!confirmed) {
            event.preventDefault();
          }
        }
      }}
    >
      执行批量操作
    </button>
  );
}

export function FolderSelectionToolbar({
  checkboxName = "folderIds",
}: {
  checkboxName?: string;
}) {
  const selector = useMemo(
    () => `input[type="checkbox"][name="${checkboxName}"][form="bulk-folder-action-form"]`,
    [checkboxName],
  );
  const [selectedCount, setSelectedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [emptyCount, setEmptyCount] = useState(0);

  useEffect(() => {
    const syncCounts = () => {
      const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(selector));
      setTotalCount(inputs.length);
      setSelectedCount(inputs.filter((input) => input.checked).length);
      setEmptyCount(
        inputs.filter((input) => (input.dataset.folderState || "").toUpperCase() === "EMPTY").length,
      );
    };

    syncCounts();
    document.addEventListener("change", syncCounts);
    return () => document.removeEventListener("change", syncCounts);
  }, [selector]);

  const updateSelection = (updater: (input: HTMLInputElement) => boolean) => {
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(selector));
    let selected = 0;
    let empty = 0;

    for (const input of inputs) {
      if ((input.dataset.folderState || "").toUpperCase() === "EMPTY") empty += 1;
      input.checked = updater(input);
      if (input.checked) selected += 1;
    }

    setSelectedCount(selected);
    setTotalCount(inputs.length);
    setEmptyCount(empty);
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ color: "#7c2d12", fontSize: 13, fontWeight: 700 }}>
          已选 {selectedCount} / {totalCount}
        </div>
        <div style={{ color: "#6b7280", fontSize: 13 }}>其中空文件夹 {emptyCount} 个</div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => updateSelection(() => true)}
          className="sf-btn sf-btn-neutral"
        >
          全选当前目录
        </button>
        <button
          type="button"
          onClick={() =>
            updateSelection((input) => (input.dataset.folderState || "").toUpperCase() === "EMPTY")
          }
          className="sf-btn sf-btn-danger"
        >
          仅选空文件夹
        </button>
        <button
          type="button"
          onClick={() => updateSelection((input) => !input.checked)}
          className="sf-btn sf-btn-neutral"
        >
          反选
        </button>
        <button
          type="button"
          onClick={() => updateSelection(() => false)}
          className="sf-btn sf-btn-neutral"
        >
          清空选择
        </button>
      </div>
    </div>
  );
}

export function BulkSelectionToolbar({
  checkboxName = "fileIds",
}: {
  checkboxName?: string;
}) {
  const selector = useMemo(
    () => `input[type="checkbox"][name="${checkboxName}"][form="bulk-file-move-form"]`,
    [checkboxName],
  );
  const [selectedCount, setSelectedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [archivedCount, setArchivedCount] = useState(0);
  const [deletedCount, setDeletedCount] = useState(0);

  useEffect(() => {
    const syncCounts = () => {
      const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(selector));
      const selectableInputs = inputs.filter((input) => !input.disabled);
      setTotalCount(selectableInputs.length);
      setSelectedCount(inputs.filter((input) => input.checked).length);
      setActiveCount(
        selectableInputs.filter((input) => (input.dataset.fileStatus || "").toUpperCase() === "ACTIVE").length,
      );
      setArchivedCount(
        selectableInputs.filter((input) => (input.dataset.fileStatus || "").toUpperCase() === "ARCHIVED").length,
      );
      setDeletedCount(
        selectableInputs.filter((input) => (input.dataset.fileStatus || "").toUpperCase() === "DELETED").length,
      );
    };

    syncCounts();
    document.addEventListener("change", syncCounts);
    return () => document.removeEventListener("change", syncCounts);
  }, [selector]);

  const updateSelection = (updater: (input: HTMLInputElement) => boolean) => {
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(selector));
    let selected = 0;
    let selectable = 0;
    let active = 0;
    let archived = 0;
    let deleted = 0;

    for (const input of inputs) {
      if (input.disabled) continue;
      selectable += 1;
      const status = (input.dataset.fileStatus || "").toUpperCase();
      if (status === "ACTIVE") active += 1;
      if (status === "ARCHIVED") archived += 1;
      if (status === "DELETED") deleted += 1;
      input.checked = updater(input);
      if (input.checked) selected += 1;
    }

    setSelectedCount(selected);
    setTotalCount(selectable);
    setActiveCount(active);
    setArchivedCount(archived);
    setDeletedCount(deleted);
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ color: "#1e3a8a", fontSize: 13, fontWeight: 700 }}>
          已选 {selectedCount} / {totalCount}
        </div>
        <div style={{ color: "#475569", fontSize: 13 }}>
          可用 {activeCount} 个，已归档 {archivedCount} 个，待删除 {deletedCount} 个
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={() => updateSelection(() => true)}
        className="sf-btn sf-btn-neutral"
      >
        全选当前页
      </button>
      <button
        type="button"
        onClick={() =>
          updateSelection((input) => (input.dataset.fileStatus || "").toUpperCase() === "ACTIVE")
        }
        className="sf-btn sf-btn-soft"
      >
        仅选可用
      </button>
      <button
        type="button"
        onClick={() =>
          updateSelection((input) => (input.dataset.fileStatus || "").toUpperCase() === "ARCHIVED")
        }
        className="sf-btn sf-btn-neutral"
      >
        仅选归档
      </button>
      <button
        type="button"
        onClick={() =>
          updateSelection((input) => (input.dataset.fileStatus || "").toUpperCase() === "DELETED")
        }
        className="sf-btn sf-btn-danger"
      >
        仅选待删除
      </button>
      <button
        type="button"
        onClick={() => updateSelection((input) => !input.checked)}
        className="sf-btn sf-btn-neutral"
      >
        反选
      </button>
      <button
        type="button"
        onClick={() => updateSelection(() => false)}
        className="sf-btn sf-btn-neutral"
      >
        清空选择
      </button>
      </div>
    </div>
  );
}
