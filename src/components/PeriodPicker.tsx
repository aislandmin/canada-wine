import { PERIOD_PRESETS, type RangePreset } from '../datePresets';
import { dateZh } from '../format';

/** All buttons, in the order shown on both 概览 and 交易记录. */
const BUTTONS: { key: RangePreset; label: string }[] = [{ key: 'all', label: '全部时间' }, ...PERIOD_PRESETS];

/** "2026年11月1日 至 2026年11月15日" / "全部时间" for a preset + dates. */
export function periodLabel(preset: RangePreset, from: string, to: string): string {
  if (preset === 'all') return '全部时间';
  if (from && to) return `${dateZh(from)} 至 ${dateZh(to)}`;
  if (from) return `${dateZh(from)} 起`;
  if (to) return `截至 ${dateZh(to)}`;
  return '全部时间';
}

interface Props {
  preset: RangePreset;
  /** The dates currently in effect (for 自定义, what's in the boxes). Empty for 全部时间. */
  from: string;
  to: string;
  onPreset: (key: RangePreset) => void;
  onCustomChange: (from: string, to: string) => void;
}

/**
 * The period selector shared by 概览 and 交易记录:
 *   row 1: [全部时间] [本月] [上月] [本季度] [本年] [去年] [自定义] (+ two date boxes for 自定义)
 *   row 2: 统计期间：2026年11月1日 至 2026年11月15日
 */
export default function PeriodPicker({ preset, from, to, onPreset, onCustomChange }: Props) {
  const invalid = Boolean(from && to && from > to);
  return (
    <section className="card admin-section range-bar" aria-label="统计期间">
      <div className="range-row">
        <div className="chips" role="group" aria-label="快速选择">
          {BUTTONS.map((b) => (
            <button key={b.key} className={`chip${preset === b.key ? ' active' : ''}`} onClick={() => onPreset(b.key)}>
              {b.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="range-inputs">
            <input
              className="input"
              type="date"
              value={from}
              onChange={(e) => e.target.value && onCustomChange(e.target.value, to)}
              aria-label="开始日期"
            />
            <span>至</span>
            <input
              className="input"
              type="date"
              value={to}
              onChange={(e) => e.target.value && onCustomChange(from, e.target.value)}
              aria-label="结束日期"
            />
          </div>
        )}
      </div>
      <p className={`range-label${invalid ? ' error' : ' muted'}`}>
        {invalid ? '开始日期不能晚于结束日期' : `统计期间：${periodLabel(preset, from, to)}`}
      </p>
    </section>
  );
}
