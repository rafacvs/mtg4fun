import { useEffect, useState } from 'react';

export function PendingAction({ pending }: { pending: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    if (!pending) return;
    const timer = window.setTimeout(() => setVisible(true), 300);
    return () => window.clearTimeout(timer);
  }, [pending]);

  return pending && visible
    ? <p className="pending-action" role="status">Ação pendente · aguardando confirmação</p>
    : null;
}
