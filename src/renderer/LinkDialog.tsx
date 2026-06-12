import React, { useState, useEffect, useCallback, useRef } from "react";

interface Props {
  visible: boolean;
  preselectText: string;
  onClose: () => void;
  onInsert: (text: string, url: string) => void;
}

const LinkDialog: React.FC<Props> = ({ visible, preselectText, onClose, onInsert }) => {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const textRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) {
      setText(preselectText);
      setUrl("");
      setTimeout(() => (preselectText ? textRef.current?.nextElementSibling as HTMLInputElement : textRef.current)?.focus(), 50);
    }
  }, [visible, preselectText]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (url.trim()) {
        onInsert(text.trim() || url.trim(), url.trim());
      }
      onClose();
    },
    [text, url, onInsert, onClose],
  );

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <form className="dialog-modal link-dialog" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">插入链接</div>
        <input
          ref={textRef}
          className="dialog-input"
          type="text"
          placeholder="链接文字"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <input
          className="dialog-input"
          type="text"
          placeholder="URL (https://...)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <div className="dialog-actions">
          <button type="button" className="dialog-btn dialog-btn-cancel" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="dialog-btn dialog-btn-confirm">
            插入
          </button>
        </div>
      </form>
    </div>
  );
};

export default LinkDialog;
