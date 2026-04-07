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
}: {
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="submit"
      style={style}
      onClick={(event) => {
        const button = event.currentTarget;
        const form = button.form;
        if (!form) return;

        const actionField = form.elements.namedItem("bulkAction");
        const actionValue =
          actionField instanceof HTMLSelectElement ? actionField.value.toUpperCase() : "";

        if (actionValue === "DELETE") {
          const confirmed = window.confirm("确定要批量标记删除选中的文件吗？这些文件之后仍可恢复。");
          if (!confirmed) {
            event.preventDefault();
          }
        }

        if (actionValue === "RESTORE") {
          const confirmed = window.confirm("确定要把选中的文件批量恢复为可用状态吗？已归档和已标记删除的文件都会恢复。");
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
        style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #bfdbfe", background: "#fff", color: "#1d4ed8" }}
      >
        全选当前页
      </button>
      <button
        type="button"
        onClick={() =>
          updateSelection((input) => (input.dataset.fileStatus || "").toUpperCase() === "ACTIVE")
        }
        style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #bfdbfe", background: "#fff", color: "#1d4ed8" }}
      >
        仅选可用
      </button>
      <button
        type="button"
        onClick={() =>
          updateSelection((input) => (input.dataset.fileStatus || "").toUpperCase() === "ARCHIVED")
        }
        style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #bfdbfe", background: "#fff", color: "#1d4ed8" }}
      >
        仅选归档
      </button>
      <button
        type="button"
        onClick={() =>
          updateSelection((input) => (input.dataset.fileStatus || "").toUpperCase() === "DELETED")
        }
        style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412" }}
      >
        仅选待删除
      </button>
      <button
        type="button"
        onClick={() => updateSelection((input) => !input.checked)}
        style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #d1d5db", background: "#fff", color: "#475569" }}
      >
        反选
      </button>
      <button
        type="button"
        onClick={() => updateSelection(() => false)}
        style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #d1d5db", background: "#fff", color: "#475569" }}
      >
        清空选择
      </button>
      </div>
    </div>
  );
}
