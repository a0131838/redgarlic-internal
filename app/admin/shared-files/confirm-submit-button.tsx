"use client";

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
