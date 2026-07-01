import React, { useEffect, useRef, useState } from 'react';

interface InlineNameInputProps {
  initialValue?: string;
  placeholder?: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export const InlineNameInput: React.FC<InlineNameInputProps> = ({
  initialValue = '',
  placeholder = 'Folder name',
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const confirm = () => {
    const name = value.trim();
    if (name) onConfirm(name);
  };

  return (
    <input
      ref={inputRef}
      value={value}
      placeholder={placeholder}
      onChange={(event) => setValue(event.target.value)}
      onBlur={onCancel}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          confirm();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      }}
      className="h-7 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-2 text-sm text-[var(--fg-1)] placeholder-[var(--fg-4)] focus:border-[var(--aos-brass)] focus:outline-none focus:ring-1 focus:ring-[var(--aos-brass)]"
    />
  );
};
