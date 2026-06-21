import './StatCard.css';

interface StatCardProps {
  label: string;
  value?: number;
  displayValue?: string;
  sublabel?: string;
  variant?: 'primary' | 'recorded' | 'applied' | 'today' | 'yesterday' | 'cost';
}

const variantConfig = {
  primary: { accent: '#0a66c2' },
  recorded: { accent: '#3b82f6' },
  applied: { accent: '#10b981' },
  today: { accent: '#8b5cf6' },
  yesterday: { accent: '#f59e0b' },
  cost: { accent: '#059669' },
};

export default function StatCard({
  label,
  value = 0,
  displayValue,
  sublabel,
  variant = 'primary',
}: StatCardProps) {
  const config = variantConfig[variant];

  return (
    <div className="stat-card">
      <div className="stat-card-accent" style={{ background: config.accent }} />
      <div className="stat-card-body">
        <div className="stat-card-content">
          <span className="stat-card-label">{label}</span>
          <span
            className={`stat-card-value${displayValue ? ' stat-card-value-compact' : ''}`}
          >
            {displayValue ?? value}
          </span>
          {sublabel && <span className="stat-card-sublabel">{sublabel}</span>}
        </div>
      </div>
    </div>
  );
}
