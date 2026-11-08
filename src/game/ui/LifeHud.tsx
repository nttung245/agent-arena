export function LifeHud({
  age,
  year,
  title,
  onJournal,
  onPause,
}: {
  age: number;
  year?: number;
  title: string;
  onJournal: () => void;
  onPause: () => void;
}) {
  return (
    <div className="life-hud">
      <div className="life-hud__top">
        <div>
          <div className="life-hud__chapter">{title}</div>
          <div className="life-hud__age">
            Age {age}
            {typeof year === "number" ? ` · ${year}` : ""}
          </div>
        </div>
        <div className="life-hud__actions">
          <button
            type="button"
            className="life-hud__button"
            onClick={onJournal}
          >
            Journal
          </button>
          <button type="button" className="life-hud__button" onClick={onPause}>
            Pause
          </button>
        </div>
      </div>
      <div className="life-hud__credit">Simulated from UN, World Bank and UNESCO data · not a real person</div>
    </div>
  );
}
