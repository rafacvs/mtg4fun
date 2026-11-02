import './AppBrand.css';

export function AppBrand({ className = '' }: { className?: string }) {
  return <div className={`app-brand ${className}`}><span aria-hidden="true">⬡</span> MTG4FUN</div>;
}
