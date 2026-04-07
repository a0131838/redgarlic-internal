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

  useEffect(() => {
    const syncCounts = () => {
      const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(selector));
      setTotalCount(inputs.length);
      setSelectedCount(inputs.filter((input) => input.checked).length);
    };

    syncCounts();
    document.addEventListener("change", syncCounts);
    return () => document.removeEventListener("change", syncCounts);
  }, [selector]);

  const setAll = (checked: boolean) => {
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(selector));
    for (const input of inputs) {
      if (!input.disabled) {
        input.checked = checked;
      }
    }
    setSelectedCount(
      checked ? inputs.filter((input) => !input.disabled).length : 0,
    );
    setTotalCount(inputs.length);
  };

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={() => setAll(true)}
        style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #bfdbfe", background: "#fff", color: "#1d4ed8" }}
      >
        全选当前页
      </button>
      <button
        type="button"
        onClick={() => setAll(false)}
        style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #d1d5db", background: "#fff", color: "#475569" }}
      >
        清空选择
      </button>
      <div style={{ color: "#475569", fontSize: 13 }}>
        已选 {selectedCount} / {totalCount}
      </div>
    </div>
  );
}
