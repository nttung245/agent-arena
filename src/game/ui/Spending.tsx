import { useState } from "react";
import type { LifeSheetItem } from "@/game/engine/types";

export function Spending({
  sheet,
  onBuy,
  onSkip,
}: {
  sheet: LifeSheetItem[];
  onBuy: (ids: string[]) => void;
  onSkip: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      if (current.length >= 2) return current;
      return [...current, id];
    });
  };

  return (
    <div className="life-overlay" role="dialog" aria-modal="true">
      <div className="life-panel life-spending">
        <h2>Spend</h2>
        <p className="life-panel__muted">
          What the year can buy. Choose up to two things, or keep the money.
        </p>
        {sheet.map((item) => {
          const checked = selected.includes(item.id);
          return (
            <label className="life-spending__item" key={item.id}>
              <input
                type="checkbox"
                checked={checked}
                disabled={!checked && selected.length >= 2}
                onChange={() => toggle(item.id)}
              />
              <span>
                <strong>{item.name}</strong>
                {typeof item.price_ppp === "number"
                  ? ` · ${Math.round(item.price_ppp)} PPP`
                  : ""}
                {item.does && (
                  <span className="life-panel__muted"> — {item.does}</span>
                )}
              </span>
            </label>
          );
        })}
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button
            type="button"
            className="life-button life-button--primary"
            disabled={selected.length === 0}
            onClick={() => onBuy(selected)}
          >
            Buy {selected.length > 0 ? `(${selected.length})` : ""}
          </button>
          <button type="button" className="life-button" onClick={onSkip}>
            Keep the money
          </button>
        </div>
      </div>
    </div>
  );
}
