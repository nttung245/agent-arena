import { useState } from "react";
import type { LifeRegion } from "@/game/engine/types";
import type { LifeConfig } from "@/game/state/lifeRun";
import { LifeCredit } from "@/game/ui/LifeCredit";

type Period = "past" | "today" | "any";

const FIRST_YEAR = 1950;
const LAST_YEAR = 2025;

function resolvePeriod(period: Period, year: number): LifeConfig {
  if (period === "past") return { year };
  if (period === "today") return { year: LAST_YEAR };
  return { year: FIRST_YEAR + Math.floor(Math.random() * (LAST_YEAR - FIRST_YEAR + 1)) };
}

export function StartScreen({
  onStart,
  busy = false,
  error,
}: {
  onStart: (config: LifeConfig) => void;
  busy?: boolean;
  error?: string | null;
}) {
  const [period, setPeriod] = useState<Period>("today");
  const [year, setYear] = useState(1975);
  const [sex, setSex] = useState<"female" | "male" | "random">("random");
  const [advanced, setAdvanced] = useState(false);
  const [region, setRegion] = useState("");
  const [fifth, setFifth] = useState("");
  const [place, setPlace] = useState("");
  const [faith, setFaith] = useState("");

  const submit = () => {
    onStart({
      ...resolvePeriod(period, year),
      sex,
      ...(region ? { region: region as LifeRegion } : {}),
      ...(fifth ? { fifth } : {}),
      ...(place ? { place: place as "town" | "village" } : {}),
      ...(faith ? { faith } : {}),
    });
  };

  return (
    <div className="life-start">
      <div className="life-start__card">
        <h1 className="life-start__title">Một Đời</h1>
        <p className="life-start__sub">
          One life in Vietnam, from birth to death, simulated from UN, World Bank and UNESCO statistics.
        </p>

        <div className="life-field">
          <label htmlFor="life-country">Country</label>
          <input id="life-country" value="Vietnam" readOnly />
        </div>

        <div className="life-row">
          <div className="life-field">
            <label htmlFor="life-period">Born</label>
            <select id="life-period" value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
              <option value="today">Today ({LAST_YEAR})</option>
              <option value="past">
                In a year I choose ({FIRST_YEAR}–{LAST_YEAR})
              </option>
              <option value="any">In any year</option>
            </select>
          </div>
          <div className="life-field">
            <label htmlFor="life-sex">Sex</label>
            <select
              id="life-sex"
              value={sex}
              onChange={(event) => setSex(event.target.value as "female" | "male" | "random")}
            >
              <option value="random">Random</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </div>
        </div>

        {period === "past" && (
          <div className="life-field">
            <label htmlFor="life-year">Birth year: {year}</label>
            <input
              id="life-year"
              type="range"
              min={FIRST_YEAR}
              max={LAST_YEAR}
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            />
          </div>
        )}

        <button type="button" className="life-button" onClick={() => setAdvanced((value) => !value)}>
          {advanced ? "Hide" : "Show"} birth conditions
        </button>

        {advanced && (
          <div className="life-row" style={{ marginTop: 12 }}>
            <div className="life-field">
              <label htmlFor="life-region">Region</label>
              <select id="life-region" value={region} onChange={(event) => setRegion(event.target.value)}>
                <option value="">Any</option>
                <option value="north">North</option>
                <option value="central">Central</option>
                <option value="south">South</option>
              </select>
            </div>
            <div className="life-field">
              <label htmlFor="life-fifth">Family income</label>
              <select id="life-fifth" value={fifth} onChange={(event) => setFifth(event.target.value)}>
                <option value="">Any</option>
                <option value="1">Poorest fifth</option>
                <option value="2">Second fifth</option>
                <option value="3">Middle fifth</option>
                <option value="4">Fourth fifth</option>
                <option value="5">Richest fifth</option>
              </select>
            </div>
            <div className="life-field">
              <label htmlFor="life-place">Place</label>
              <select id="life-place" value={place} onChange={(event) => setPlace(event.target.value)}>
                <option value="">Any</option>
                <option value="town">City or town</option>
                <option value="village">Village</option>
              </select>
            </div>
            <div className="life-field">
              <label htmlFor="life-faith">Faith</label>
              <select id="life-faith" value={faith} onChange={(event) => setFaith(event.target.value)}>
                <option value="">Any</option>
                <option value="none">No registered religion</option>
                <option value="buddhist">Buddhist</option>
                <option value="catholic">Catholic</option>
                <option value="protestant">Protestant</option>
                <option value="hoaHao">Hòa Hảo</option>
                <option value="caoDai">Cao Đài</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        )}

        <div className="life-field" style={{ marginTop: 16 }}>
          <label>Scene director</label>
          <input value="Template scenes (no LLM)" readOnly />
        </div>

        <div className="life-notice">
          This is a simulation, not a real person. Ages 15+. Death, illness and hardship appear at their real
          rates, but no scene is graphic. The life runs in your browser; nothing about it is sent anywhere.
        </div>

        {error && (
          <div className="life-notice life-error" role="alert">
            {error}
          </div>
        )}

        <button type="button" className="life-button life-button--primary" disabled={busy} onClick={submit}>
          {busy ? "Being born…" : "Be born"}
        </button>

        <LifeCredit />
      </div>
    </div>
  );
}
