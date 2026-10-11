"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

type SecretInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
};

export function SecretInput({ label, id, ...props }: SecretInputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);
  return (
    <div className="secret-field">
      <label htmlFor={inputId}>{label}</label>
      <div className="secret-input">
        <input {...props} id={inputId} type={visible ? "text" : "password"} />
        <button
          type="button"
          className="secret-toggle"
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-controls={inputId}
          aria-pressed={visible}
          title={visible ? "Hide Entry" : "Show Entry"}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? (
            <Eye size={22} aria-hidden="true" />
          ) : (
            <EyeOff size={22} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
