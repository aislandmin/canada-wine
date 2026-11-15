import type { CountryCode } from '../../../shared/types';
import { Field, PhoneInput } from '../../components/FormBits';

/** Customer details. Disabling/enabling an account is a separate button on the customer page. */
export interface CustomerForm {
  name: string;
  countryCode: CountryCode;
  phone: string;
  email: string;
  wechat: string;
  company: string;
  adminNote: string;
}

export const EMPTY_CUSTOMER: CustomerForm = {
  name: '',
  countryCode: '+86',
  phone: '',
  email: '',
  wechat: '',
  company: '',
  adminNote: '',
};

/** Shared fields for creating and editing a customer. */
export default function CustomerFields({ form, onChange }: { form: CustomerForm; onChange: (f: CustomerForm) => void }) {
  const set = <K extends keyof CustomerForm>(k: K) => (v: CustomerForm[K]) => onChange({ ...form, [k]: v });
  return (
    <>
      <div className="form-grid">
        <Field label="姓名 *">
          <input className="input" value={form.name} onChange={(e) => set('name')(e.target.value)} />
        </Field>
        <Field label="公司名称">
          <input className="input" value={form.company} onChange={(e) => set('company')(e.target.value)} />
        </Field>
      </div>
      <Field label="手机号" hint="手机号和邮箱至少填写一项（客户用来登录）">
        <PhoneInput countryCode={form.countryCode} phone={form.phone} onCountryCode={set('countryCode')} onPhone={set('phone')} />
      </Field>
      <div className="form-grid">
        <Field label="邮箱">
          <input className="input" type="email" value={form.email} onChange={(e) => set('email')(e.target.value)} />
        </Field>
        <Field label="微信号">
          <input className="input" value={form.wechat} onChange={(e) => set('wechat')(e.target.value)} />
        </Field>
      </div>
      <Field label="内部备注" hint="仅管理员可见">
        <textarea className="input textarea" rows={2} value={form.adminNote} onChange={(e) => set('adminNote')(e.target.value)} />
      </Field>
    </>
  );
}
