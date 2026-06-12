import React from "react";

export interface Tab {
  path: string;
  name: string;
}

interface Props {
  tabs: Tab[];
  activeIndex: number;
  onSwitch: (index: number) => void;
  onClose: (index: number) => void;
}

const TabBar: React.FC<Props> = ({ tabs, activeIndex, onSwitch, onClose }) => {
  if (tabs.length <= 1) return null;

  return (
    <div className="tab-bar">
      {tabs.map((tab, i) => (
        <div
          key={tab.path}
          className={`tab-item ${i === activeIndex ? "tab-item-active" : ""}`}
          onClick={() => onSwitch(i)}
        >
          <span className="tab-name">{tab.name.replace(/\.md$/, "")}</span>
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose(i);
            }}
            title="关闭标签页"
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
};

export default TabBar;
