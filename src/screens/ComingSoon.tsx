import { Icon } from '../components/Icon';

export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <>
      <span className="eyebrow">LIFEPATH</span>
      <h1 className="title">{title}</h1>
      <div className="panel" style={{ marginTop: 24, padding: 24, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
        <Icon name="sparkle" size={26} color="var(--accent)" />
        <p style={{ margin: 0, color: 'var(--text-2)', lineHeight: 1.55, fontSize: 15 }}>{text}</p>
      </div>
    </>
  );
}
