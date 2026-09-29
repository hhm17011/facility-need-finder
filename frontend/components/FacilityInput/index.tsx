import { useState, type FormEvent } from 'react';
interface Props { onAnalyze: (input: string) => void; busy: boolean }
export function FacilityInput({ onAnalyze, busy }: Props) {
  const [input, setInput] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    if (input.trim() && !busy) onAnalyze(input.trim());
  }
  return <section className="input-section">
    <div className="section-kicker">01 / FACILITY BRIEF</div>
    <form onSubmit={submit}>
      <label htmlFor="facility-input">어떤 시설을 계획하고 있나요?</label>
      <div className="input-row">
        <input id="facility-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="예: 복합문화시설" maxLength={300} required disabled={busy} aria-describedby="input-help" />
        <button className="primary-button" disabled={busy || !input.trim()} type="submit">{busy ? '분석 중…' : '분석하기'} <span aria-hidden="true">↗</span></button>
      </div>
      <p id="input-help">시설을 입력하면 실제 근거와 시군구 인구 자료를 찾아 지역 비교 결과를 만듭니다.</p>
    </form>
  </section>;
}
