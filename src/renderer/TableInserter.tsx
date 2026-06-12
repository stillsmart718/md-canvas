import React, { useState, useCallback, useEffect } from "react";

interface Props {
  visible: boolean;
  onClose: () => void;
  onInsert: (rows: number, cols: number) => void;
}

const MAX = 10;

const TableInserter: React.FC<Props> = ({ visible, onClose, onInsert }) => {
  const [hoverR, setHoverR] = useState(3);
  const [hoverC, setHoverC] = useState(3);

  const handleInsert = useCallback(
    (r: number, c: number) => {
      onInsert(r, c);
      onClose();
    },
    [onInsert, onClose],
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
      <div className="dialog-modal table-inserter-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">插入表格</div>
        <p className="dialog-hint">
          {hoverR} × {hoverC}
        </p>
        <div
          className="table-grid"
          onMouseLeave={() => { setHoverR(3); setHoverC(3); }}
        >
          {Array.from({ length: MAX }, (_, r) =>
            Array.from({ length: MAX }, (_, c) => (
              <button
                key={`${r}-${c}`}
                className={`table-grid-cell ${r < hoverR && c < hoverC ? "table-grid-cell-active" : ""}`}
                onMouseEnter={() => { setHoverR(r + 1); setHoverC(c + 1); }}
                onClick={() => handleInsert(r + 1, c + 1)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TableInserter;
