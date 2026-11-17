import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  X,
} from 'lucide-react';
import { api, errorMessage } from '../services/api';
import { date, mealNames, money, statusNames, time } from '../services/format';
import type { CouponStatus, Transaction } from '../types';
export function useResource<T>(path: string, revision = 0) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setData(undefined);
    api<T>(path)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, revision]);
  return { data, error, loading };
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} /> Chargement…
    </div>
  );
}
export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="error-box" role="alert">
      {message}
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Badge({ status }: { status: CouponStatus }) {
  return (
    <span className={`badge ${status.toLowerCase()}`}>
      <span />
      {statusNames[status]}
    </span>
  );
}
export function Pagination({
  page,
  pages,
  total,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {total} résultat{total !== 1 ? 's' : ''}
      </span>
      <div>
        <button
          className="icon-button"
          aria-label="Page précédente"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={17} />
        </button>
        <span>
          {page} / {Math.max(pages, 1)}
        </span>
        <button
          className="icon-button"
          aria-label="Page suivante"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
export function TransactionsTable({
  items,
  audit = false,
}: {
  items: Transaction[];
  audit?: boolean;
}) {
  if (!items.length) return <Empty>Aucune transaction pour le moment.</Empty>;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Opération</th>
            {audit && <th>Étudiant</th>}
            <th>Date · Casablanca</th>
            <th className="align-right">Montant</th>
            <th className="align-right">Solde après</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              <td>
                <div className="transaction-name">
                  <span className={`transaction-icon ${t.amountCents > 0 ? 'credit' : ''}`}>
                    {t.amountCents > 0 ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                  </span>
                  <div>
                    <strong>
                      {t.type === 'COUPON_RECHARGE'
                        ? 'Recharge par coupon'
                        : t.meal
                          ? mealNames[t.meal.type]
                          : 'Repas simulé'}
                    </strong>
                    <small>{t.coupon?.publicSerial ?? 'Restaurant universitaire · Démo'}</small>
                  </div>
                </div>
              </td>
              {audit && <td>{t.wallet?.user.fullName}</td>}
              <td>
                {date(t.createdAt)}
                <small>{time(t.createdAt)}</small>
              </td>
              <td className={`align-right amount ${t.amountCents > 0 ? 'positive' : ''}`}>
                {t.amountCents > 0 ? '+' : '−'}
                {money(Math.abs(t.amountCents))}
              </td>
              <td className="align-right muted">{money(t.balanceAfterCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const ToastContext = createContext<(text: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 6500);
    return () => clearTimeout(timer);
  }, [message]);
  return (
    <ToastContext.Provider value={setMessage}>
      {children}
      {message && (
        <div className="toast" role="status">
          <Check size={18} />
          {message}
          <button aria-label="Fermer la notification" onClick={() => setMessage('')}>
            <X size={16} />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
