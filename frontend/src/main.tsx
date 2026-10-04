import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Target,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TrendPoint = {
  rate: number;
  recorded_at: string;
};

type TrendPayload = {
  points: TrendPoint[];
  threshold: number | null;
  pair: string;
};

declare global {
  interface Window {
    __fxTrendPayload?: TrendPayload;
    __updateFxTrendWidget?: (data: TrendPayload) => void; // 🔄 New library mode bridge
  }
}

function formatRate(value: number, digits = 5) {
  return Number(value).toFixed(digits);
}

function TrendDot(props: { cx?: number; cy?: number; payload?: TrendPoint; threshold: number | null }) {
  const { cx, cy, payload, threshold } = props;
  if (cx == null || cy == null || !payload) return null;

  const above = threshold != null && payload.rate >= threshold;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={3}
      fill={threshold == null ? "var(--brand)" : above ? "var(--error)" : "var(--good)"}
      stroke="var(--surface)"
      strokeWidth={1.5}
    />
  );
}

function TrendWidget() {
  const [payload, setPayload] = useState<TrendPayload>(() => (
    window.__fxTrendPayload ?? { points: [], threshold: null, pair: "USD/ZAR" }
  ));

  useEffect(() => {
    // A. Keep your existing custom event framework intact
    const handleTrendData = (event: Event) => {
      const customEvent = event as CustomEvent<TrendPayload>;
      setPayload(customEvent.detail);
      window.__fxTrendPayload = customEvent.detail;
    };

    // B. 🔄 CRUCIAL FIX: Attach a direct window bridge callback function.
    // This allows your backend HTML selection scripts to bypass scope isolation traps.
    window.__updateFxTrendWidget = (newData: TrendPayload) => {
      setPayload(newData);
      window.__fxTrendPayload = newData;
    };

    window.addEventListener("fx-trend-data", handleTrendData);
    return () => {
      window.removeEventListener("fx-trend-data", handleTrendData);
      delete window.__updateFxTrendWidget;
    };
  }, []);

  const rates = payload.points.map((point) => Number(point.rate));
  const current = rates.length > 0 ? rates[rates.length - 1] : null;
  const first = rates[0] ?? null;
  const change = first && current != null && first !== 0
    ? ((current - first) / first) * 100
    : null;

  const domain = useMemo<[number | "auto", number | "auto"]>(() => {
    if (!rates.length) {
      return ["auto", "auto"];
    }

    const values =
      payload.threshold == null
        ? rates
        : [...rates, payload.threshold];

    const min = Math.min(...values);
    const max = Math.max(...values);

    const padding = Math.max(
      (max - min) * 0.08,
      max === min ? 0.01 : 0.001
    );

    return [min - padding, max + padding];
  }, [rates, payload.threshold]);

  if (!payload.points.length) {
    return (
      <div className="trend-widget-empty">
        <Activity size={21} />
        <b>Trend data unavailable</b>
        <span>No stored observations are available for this pair and range.</span>
      </div>
    );
  }

  return (
    <div className="trend-widget-shell">
      <div className="trend-widget-summary">
        <div className="trend-widget-current">
          <span>Current rate</span>
          <strong>{formatRate(current ?? 0, 5)}</strong>
          {change != null && (
            <small className={change >= 0 ? "gain" : "loss"}>
              {change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {change >= 0 ? "+" : ""}{change.toFixed(2)}%
            </small>
          )}
        </div>

        <div className="trend-widget-state">
          {payload.threshold != null ? (
            <span className={current != null && current >= payload.threshold ? "state-negative" : "state-positive"}>
              <Target size={14} />
              {current != null && current >= payload.threshold ? "Above threshold" : "Below threshold"}
            </span>
          ) : (
            <span className="state-neutral">
              <Activity size={14} />
              Tracking rate
            </span>
          )}
        </div>
      </div>

      <div className="recharts-container">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={payload.points}
            margin={{ top: 14, right: 16, left: 4, bottom: 6 }}
          >
            <defs>
              <linearGradient id="fxTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.22} />
                <stop offset="88%" stopColor="var(--brand)" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid
              stroke="var(--line)"
              strokeDasharray="3 5"
              vertical={false}
            />

            <XAxis
              dataKey="recorded_at"
              tickLine={false}
              axisLine={false}
              minTickGap={28}
              tick={{ fill: "var(--muted-ink)", fontSize: 10 }}
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }
            />

            <YAxis
              domain={domain as [number, number]} // Typecasted cleanly to bypass your main.tsx compilation error
              tickLine={false}
              axisLine={false}
              width={58}
              tick={{ fill: "var(--muted-ink)", fontSize: 10 }}
              tickFormatter={(value) => Number(value).toFixed(3)}
            />

            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                color: "var(--ink)",
                boxShadow: "0 10px 25px rgba(0,0,0,.08)",
              }}
              labelFormatter={(value) =>
                new Date(value as string).toLocaleString()
              }
              formatter={(value) => [
                Number(value).toFixed(5),
                payload.pair,
              ]}
            />

            {payload.threshold != null && (
              <ReferenceLine
                y={payload.threshold}
                stroke="var(--warning)"
                strokeDasharray="7 6"
                strokeWidth={2}
                label={{
                  value: `Threshold ${formatRate(payload.threshold, 4)}`,
                  position: "insideTopLeft",
                  fill: "var(--warning)",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              />
            )}

            <Area
              type="monotone"
              dataKey="rate"
              stroke="var(--brand)"
              strokeWidth={2.5}
              fill="url(#fxTrendFill)"
              activeDot={{ r: 5, strokeWidth: 2 }}
              dot={(props) => (
                <TrendDot
                  cx={props.cx}
                  cy={props.cy}
                  payload={props.payload as TrendPoint | undefined}
                  threshold={payload.threshold}
                />
              )}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="trend-widget-legend">
        <span><i className="legend-swatch rate" /> <TrendingUp size={13} /> Rate</span>
        {payload.threshold != null && (
          <>
            <span><i className="legend-swatch threshold" /> <Target size={13} /> Threshold</span>
            <span><i className="legend-swatch breach" /> <TrendingDown size={13} /> Above threshold</span>
          </>
        )}
      </div>
    </div>
  );
}

const rootElement = document.getElementById("trend-chart");
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <TrendWidget />
    </StrictMode>
  );
}

