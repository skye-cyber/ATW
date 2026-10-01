import { useEffect, type ReactNode } from "react";

interface Props {
    open: boolean;
    onClose(): void;
    title: string;
    children: ReactNode;
    maxWidth?: string;
}

export function Modal({ open, onClose, title, children, maxWidth = "640px" }: Props): JSX.Element {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent): void => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return <></>;

    return (
        <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                className="rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg-elev)] shadow-2xl w-full max-h-[85vh] overflow-y-auto"
                style={{ maxWidth }}
            >
                <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
                    <h2 className="text-sm font-semibold">{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-[var(--color-text-muted)] text-xl leading-none"
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>
                <div className="p-4">{children}</div>
            </div>
        </div>
    );
}
