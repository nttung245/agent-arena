import { DATA_CREDIT } from "@/game/sim/engine";
import { isLocalEngine } from "@/game/state/lifeRun";

/**
 * The credit line on the start screen, birth card, journal, death screen and
 * memorial. Lives made by the 1in8b Engine before the switch keep its credit.
 */
export function LifeCredit({ engineVersion }: { engineVersion?: string }) {
  if (!isLocalEngine(engineVersion)) {
    return (
      <p className="life-credit">
        Life simulated by the{" "}
        <a href="https://1in8b.life/en/api/" target="_blank" rel="noreferrer">
          1in8b Engine (1in8b.life)
        </a>
        . Simulated life, not a real person.
      </p>
    );
  }
  return <p className="life-credit">Simulated life, not a real person. {DATA_CREDIT}</p>;
}
