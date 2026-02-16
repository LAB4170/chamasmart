import { useEffect, useRef } from "react";
import { X, AlertTriangle, Info, CheckCircle } from "lucide-react";
import "./ConfirmDialog.css";

/**
 * Reusable confirmation dialog that replaces window.prompt() and window.confirm()
 *
 * Props:
 * - isOpen: boolean
 * - title: string
 * - message: string
 * - confirmText: string (default: "Confirm")
 * - cancelText: string (default: "Cancel")
 * - variant: "danger" | "warning" | "info" | "success" (default: "info")
 * - onConfirm: () => void
 * - onCancel: () => void
 * - showInput: boolean (to replace window.prompt())
 * - inputLabel: string
 * - inputPlaceholder: string
 * - inputValue: string
 * - onInputChange: (value) => void
 * - loading: boolean
 */
const ConfirmDialog = ({
    isOpen,
    title = "Confirm Action",
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "info",
    onConfirm,
    onCancel,
    showInput = false,
    inputLabel,
    inputPlaceholder = "",
    inputValue = "",
    onInputChange,
    loading = false,
}) => {
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen && showInput && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen, showInput]);

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === "Escape" && isOpen) {
                onCancel();
            }
        };
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    const icons = {
        danger: <AlertTriangle size={24} />,
        warning: <AlertTriangle size={24} />,
        info: <Info size={24} />,
        success: <CheckCircle size={24} />,
    };

    return (
        <div className="dialog-backdrop" onClick={onCancel}>
            <div className="dialog-container" onClick={(e) => e.stopPropagation()}>
                <button className="dialog-close" onClick={onCancel} aria-label="Close">
                    <X size={20} />
                </button>

                <div className={`dialog-icon-wrapper ${variant}`}>
                    {icons[variant]}
                </div>

                <h3 className="dialog-title">{title}</h3>
                {message && <p className="dialog-message">{message}</p>}

                {showInput && (
                    <div className="dialog-input-group">
                        {inputLabel && <label className="dialog-input-label">{inputLabel}</label>}
                        <textarea
                            ref={inputRef}
                            className="dialog-input"
                            placeholder={inputPlaceholder}
                            value={inputValue}
                            onChange={(e) => onInputChange?.(e.target.value)}
                            rows={3}
                        />
                    </div>
                )}

                <div className="dialog-actions">
                    <button className="dialog-btn dialog-btn-cancel" onClick={onCancel} disabled={loading}>
                        {cancelText}
                    </button>
                    <button
                        className={`dialog-btn dialog-btn-confirm ${variant}`}
                        onClick={onConfirm}
                        disabled={loading || (showInput && !inputValue?.trim())}
                    >
                        {loading ? "Processing..." : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
