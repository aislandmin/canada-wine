import { useEffect, useState, type ReactNode } from 'react';
import { COUNTRY_CODES, type CountryCode } from '../../shared/types';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="form-field">
      <span className="form-label">{label}</span>
      {children}
      {hint && <span className="form-hint">{hint}</span>}
    </label>
  );
}

const CC_LABEL: Record<CountryCode, string> = { '+86': '中国 +86', '+1': '加拿大 +1' };

export function PhoneInput(props: {
  countryCode: CountryCode;
  phone: string;
  onCountryCode: (cc: CountryCode) => void;
  onPhone: (p: string) => void;
  required?: boolean;
}) {
  return (
    <div className="phone-input">
      <select
        className="input"
        value={props.countryCode}
        onChange={(e) => props.onCountryCode(e.target.value as CountryCode)}
        aria-label="区号"
      >
        {COUNTRY_CODES.map((cc) => (
          <option key={cc} value={cc}>
            {CC_LABEL[cc]}
          </option>
        ))}
      </select>
      <input
        className="input"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder={props.countryCode === '+86' ? '138 0000 0000' : '416 555 0123'}
        value={props.phone}
        onChange={(e) => props.onPhone(e.target.value)}
        required={props.required}
      />
    </div>
  );
}

/** Password box with an eye button to show/hide what was typed. */
export function PasswordInput(props: {
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="password-input">
      <input
        className="input"
        type={visible ? 'text' : 'password'}
        autoComplete={props.autoComplete}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        required={props.required}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? '隐藏密码' : '显示密码'}
        aria-pressed={visible}
        title={visible ? '隐藏密码' : '显示密码'}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </span>
  );
}

/** How long a success message ("已保存…") stays before fading away. Errors never auto-hide. */
export const FLASH_MS = 4000;

/**
 * A success message that clears itself after FLASH_MS. Returns [message, setMessage].
 * Show it with className="form-success flash" so it fades out at the end.
 */
export function useFlash(initial = ''): [string, (m: string) => void] {
  const [message, setMessage] = useState(initial);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(''), FLASH_MS);
    return () => clearTimeout(t);
  }, [message]);
  return [message, setMessage];
}

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (error)
    return (
      <p className="form-error" role="alert">
        {error}
      </p>
    );
  if (success)
    return (
      <p className="form-success" role="status">
        {success}
      </p>
    );
  return null;
}

/** Split a stored "+8613812345678" back into select + local number for editing. */
export function splitPhone(phone: string | null): { countryCode: CountryCode; local: string } {
  if (phone?.startsWith('+86')) return { countryCode: '+86', local: phone.slice(3) };
  if (phone?.startsWith('+1')) return { countryCode: '+1', local: phone.slice(2) };
  return { countryCode: '+86', local: '' };
}
