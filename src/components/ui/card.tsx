import { ReactNode, CSSProperties } from 'react';

// Accent color → top border style, matching ansell.digital.css dash-card pattern
const ACCENT_STYLES: Record<string, CSSProperties> = {
  blue:  { borderTop: '5px solid #0063AC' },
  teal:  { borderTop: '5px solid #00A28F' },
  gray:  { borderTop: '5px solid #75787B' },
  purple:{ borderTop: '5px solid #7030A0' },
  amber: { borderTop: '5px solid #D97706' },
  violet:{ borderTop: '5px solid #7C3AED' },
  none:  {},
};

const CARD_SHADOW: CSSProperties = { boxShadow: '0 1px 4px rgba(0,0,0,0.07)' };
const CARD_SHADOW_HOVER: CSSProperties = { boxShadow: '0 4px 16px rgba(0,0,0,0.12)' };

interface CardProps {
  children: ReactNode;
  className?: string;
  accent?: 'blue' | 'teal' | 'gray' | 'purple' | 'amber' | 'violet' | 'none';
  style?: CSSProperties;
  hover?: boolean;
  id?: string;
}

export function Card({ children, className = '', accent = 'none', style, hover = false, id }: CardProps) {
  return (
    <div
      id={id}
      className={`bg-white rounded-none ${hover ? 'card-hover' : ''} ${className}`}
      style={{ ...CARD_SHADOW, ...ACCENT_STYLES[accent], ...style, scrollMarginTop: 16 }}
      onMouseEnter={hover ? e => { Object.assign((e.currentTarget as HTMLElement).style, CARD_SHADOW_HOVER); (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; } : undefined}
      onMouseLeave={hover ? e => { Object.assign((e.currentTarget as HTMLElement).style, CARD_SHADOW); (e.currentTarget as HTMLElement).style.transform = ''; } : undefined}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={`px-6 py-4 border-b border-gray-100 ${className}`}>
      {children}
    </div>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return <div className={`px-6 py-4 ${className}`}>{children}</div>;
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

export function CardTitle({ children, className = '' }: CardTitleProps) {
  return (
    <h3 className={`text-[13px] font-bold uppercase tracking-[0.06em] text-ansell-gray ${className}`}>
      {children}
    </h3>
  );
}
