import { CURRENCIES, type Tier } from '../../shared/types';
import { formatRate } from '../../shared/discount';
import { CURRENCY_LABEL, money } from '../format';
import { useSettings } from '../settings';

function rangeLabel(tiers: Tier[], i: number, currency: 'CAD' | 'CNY'): string {
  const next = tiers[i + 1];
  return next
    ? `${money(tiers[i].min, currency)} ~ ${money(next.min - 1, currency)}`
    : `${money(tiers[i].min, currency)} 以上`;
}

/** The discount tier tables for both currencies, as published in the policy. */
export default function TierTables() {
  const { tiers } = useSettings();
  return (
    <div className="tier-tables">
      {CURRENCIES.map((c) => {
        const sorted = [...tiers[c]].sort((a, b) => a.min - b.min);
        return (
          <table key={c} className="tier-table">
            <caption>
              {CURRENCY_LABEL[c]} {c === 'CAD' ? '$' : '¥'}
            </caption>
            <thead>
              <tr>
                <th scope="col">累计金额</th>
                <th scope="col">折扣</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t, i) => (
                <tr key={t.min}>
                  <td>{rangeLabel(sorted, i, c)}</td>
                  <td className="rate">{formatRate(t.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      })}
    </div>
  );
}
