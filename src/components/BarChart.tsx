import { useState } from 'react';

export interface Bar {
  key: string;
  /** Short axis label, e.g. "9月". */
  label: string;
  /** Full label for the tooltip/table, e.g. "2026年9月". */
  fullLabel: string;
  value: number;
  /** Extra tooltip line, e.g. "3 笔订单". */
  detail?: string;
}

interface Props {
  title: string;
  bars: Bar[];
  format: (v: number) => string;
}

/**
 * Single-series vertical bar chart in plain HTML/CSS (no chart library to load).
 * One colour, no legend (the title names the series), hover/tap tooltip per bar,
 * and a visually hidden table for screen readers.
 */
export default function BarChart({ title, bars, format }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...bars.map((b) => b.value));
  const shown = active != null ? bars[active] : null;

  return (
    <figure className="bar-chart">
      <figcaption className="bar-chart-title">{title}</figcaption>

      <div className="bar-chart-tooltip" aria-hidden="true">
        {shown ? (
          <>
            <strong>{shown.fullLabel}</strong> {format(shown.value)}
            {shown.detail && <span className="muted"> · {shown.detail}</span>}
          </>
        ) : max > 0 ? (
          <span className="muted">最高 {format(max)} · 指向柱子查看每月数值</span>
        ) : (
          <span className="muted">该期间没有销售</span>
        )}
      </div>

      <div className="bar-chart-plot" onMouseLeave={() => setActive(null)} aria-hidden="true">
        {bars.map((b, i) => (
          <div
            key={b.key}
            className={`bar-col${active === i ? ' active' : ''}`}
            onMouseEnter={() => setActive(i)}
            onClick={() => setActive(active === i ? null : i)}
          >
            <div className="bar-track">
              {b.value > 0 && <div className="bar" style={{ height: `${Math.max(2, (b.value / max) * 100)}%` }} />}
            </div>
            <span className="bar-label">{b.label}</span>
          </div>
        ))}
      </div>

      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {bars.map((b) => (
            <tr key={b.key}>
              <th scope="row">{b.fullLabel}</th>
              <td>{format(b.value)}</td>
              {b.detail && <td>{b.detail}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
