import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Coffee,
  CreditCard,
  Info,
  Moon,
  Plus,
  ReceiptText,
  ShieldCheck,
  Sun,
  Ticket,
  Utensils,
  Wallet as WalletIcon,
} from 'lucide-react';
import { useAuth } from '../app/auth';
import {
  Empty,
  ErrorBox,
  Loading,
  PageTitle,
  Pagination,
  TransactionsTable,
  useResource,
  useToast,
} from '../components/ui';
import { api, errorMessage } from '../services/api';
import { date, mealNames, money, month, time } from '../services/format';
import type { Meal, Page, Stats, Transaction, Wallet } from '../types';

function Breakdown({ stats }: { stats: Stats }) {
  const icons = { BREAKFAST: Coffee, LUNCH: Sun, DINNER: Moon };
  return (
    <div className="breakdown">
      {(Object.keys(mealNames) as Array<keyof typeof mealNames>).map((type) => {
        const Icon = icons[type];
        return (
          <div key={type}>
            <span className={`meal-icon ${type.toLowerCase()}`}>
              <Icon size={19} />
            </span>
            <div>
              <span>{mealNames[type]}</span>
              <div className="progress-track">
                <span
                  style={{
                    width: `${stats.totalMeals ? (stats.counts[type] / stats.totalMeals) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <strong>{stats.counts[type]}</strong>
          </div>
        );
      })}
    </div>
  );
}
export function DashboardPage() {
  const { user } = useAuth();
  const wallet = useResource<Wallet>('/wallet/me');
  const stats = useResource<Stats>('/meals/me/stats');
  const transactions = useResource<Page<Transaction>>('/wallet/me/transactions?limit=5');
  return (
    <>
      <PageTitle
        eyebrow="VOTRE QUOTIDIEN AU CAMPUS"
        title={`Bonjour ${user?.fullName.split(' ')[0]} 👋`}
        description="Un petit coup d’œil à votre espace restauration."
        action={
          <span className="date-chip">
            <span className="dot" />
            {month()}
          </span>
        }
      />
      <div className="dashboard-overview">
        <section className="balance-card">
          <div className="balance-card-top">
            <span>
              <WalletIcon size={17} /> Mon solde de démonstration
            </span>
            <span className="outline-pill">MAD</span>
          </div>
          {wallet.loading ? (
            <Loading />
          ) : wallet.error ? (
            <ErrorBox message={wallet.error} />
          ) : (
            <div className="balance-amount">
              {money(wallet.data!.balanceCents).replace(' DH', '')}
              <span>DH</span>
            </div>
          )}
          <p>Pour vos prochains repas sur le campus.</p>
          <div className="balance-card-bottom">
            <span>
              <CreditCard size={15} /> Portefeuille simulé
            </span>
            <Link to="/recharge">
              <Plus size={16} /> Recharger
            </Link>
          </div>
          <div className="card-decoration" aria-hidden="true">
            <Utensils size={120} />
          </div>
        </section>
        <section className="stat-card">
          <span className="stat-icon">
            <Utensils size={21} />
          </span>
          <p>Repas ce mois-ci</p>
          {stats.loading ? (
            <Loading />
          ) : stats.error ? (
            <ErrorBox message={stats.error} />
          ) : (
            <>
              <strong>
                {stats.data!.totalMeals}
                <small>repas</small>
              </strong>
              <span className="stat-foot">Un campus, plein de bons moments.</span>
            </>
          )}
        </section>
        <section className="stat-card">
          <span className="stat-icon warm">
            <ReceiptText size={21} />
          </span>
          <p>Dépenses du mois</p>
          {stats.data && (
            <>
              <strong>
                {money(stats.data.totalSpentCents)}
                <small>simulées</small>
              </strong>
              <span className="stat-foot">Votre consommation, en toute clarté.</span>
            </>
          )}
        </section>
      </div>
      <div className="dashboard-middle">
        <section className="coupon-promo">
          <div>
            <span className="section-tag">UNE RECHARGE, TOUT SIMPLEMENT</span>
            <h2>
              Un coupon en poche ?<br />
              Votre prochain repas vous attend.
            </h2>
            <p>
              Activez votre solde démo avec un coupon acheté
              <br />
              auprès de votre point de vente campus.
            </p>
            <Link className="text-link" to="/recharge">
              Utiliser mon coupon <ArrowRight size={17} />
            </Link>
          </div>
          <div className="coupon-art" aria-hidden="true">
            <span>SMARTRESTO</span>
            <Ticket size={44} />
            <strong>À TABLE !</strong>
            <div className="fake-barcode" />
            <small>COUPON DÉMO</small>
          </div>
        </section>
        <section className="panel consumption">
          <div className="panel-title">
            <h2>À votre rythme</h2>
            <span className="subtle-tag">Ce mois-ci</span>
          </div>
          {stats.data ? (
            <Breakdown stats={stats.data} />
          ) : stats.error ? (
            <ErrorBox message={stats.error} />
          ) : (
            <Loading />
          )}
          <Link className="text-link" to="/meals">
            Voir mes repas <ArrowUpRight size={16} />
          </Link>
        </section>
      </div>
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Dernières transactions</h2>
            <p>Les derniers mouvements de votre portefeuille démo.</p>
          </div>
          <Link className="text-link" to="/transactions">
            Tout voir <ArrowRight size={16} />
          </Link>
        </div>
        {transactions.loading ? (
          <Loading />
        ) : transactions.error ? (
          <ErrorBox message={transactions.error} />
        ) : (
          <TransactionsTable items={transactions.data!.items} />
        )}
      </section>
      <div className="quiet-note">
        <ShieldCheck size={16} />
        <span>
          Vos données restent dans cet environnement de démonstration. Votre carte restaurant réelle
          n’est pas modifiée.
        </span>
      </div>
    </>
  );
}
export function RechargePage() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ creditedCents: number; balanceCents: number }>();
  const toast = useToast();
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setResult(undefined);
    try {
      const value = await api<{ creditedCents: number; balanceCents: number }>('/coupons/redeem', {
        code,
      });
      setResult(value);
      setCode('');
      toast('Coupon utilisé. Votre solde démo a été rechargé.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="VOTRE PORTEFEUILLE"
        title="Un coupon, et c’est reparti."
        description="Créditez votre solde de démonstration en quelques secondes."
      />
      <div className="two-column">
        <form className="panel form-panel" onSubmit={submit}>
          <span className="large-icon">
            <Ticket size={30} />
          </span>
          <h2>Utiliser un coupon</h2>
          <p className="muted">Saisissez le code secret imprimé sur votre coupon.</p>
          <label htmlFor="coupon-code">Code du coupon</label>
          <textarea
            id="coupon-code"
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            maxLength={150}
            placeholder="RESTO-XXXX-XXXX-…"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <p className="field-help">
            Chaque code est à usage unique. Le coupon doit être activé par le vendeur.
          </p>
          {error && <ErrorBox message={error} />}
          <button className="button full" disabled={busy || !code.trim()}>
            {busy ? 'Vérification…' : 'Confirmer la recharge'}
            <ArrowRight size={17} />
          </button>
          {result && (
            <div className="success-box" role="status">
              <Check size={21} />
              <div>
                <strong>+{money(result.creditedCents)} crédités</strong>
                <p>Nouveau solde de démonstration : {money(result.balanceCents)}</p>
              </div>
            </div>
          )}
        </form>
        <section className="panel form-panel soft-panel">
          <h2>Comment ça marche ?</h2>
          <ol className="steps">
            <li>
              <span>1</span>
              <div>
                <strong>Récupérez votre coupon</strong>
                <p>Auprès du vendeur BDE ou de la buvette dans le cadre de cette simulation.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Le vendeur l’active</strong>
                <p>
                  Après avoir confirmé une vente en espèces simulée, grâce au numéro public du
                  coupon.
                </p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Saisissez le code secret</strong>
                <p>Le montant rejoint votre portefeuille de démonstration.</p>
              </div>
            </li>
          </ol>
          <div className="info-box">
            <Info size={18} />
            <p>
              Conservez le code secret à l’abri des regards. Aucun paiement réel n’est effectué dans
              cette application.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
export function TransactionsPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const resource = useResource<Page<Transaction>>(
    `/wallet/me/transactions?page=${page}&limit=10${filter ? `&type=${filter}` : ''}`,
  );
  return (
    <>
      <PageTitle
        eyebrow="VOTRE PORTEFEUILLE"
        title="Chaque mouvement, en clair."
        description="Retrouvez vos recharges et vos repas simulés."
      />
      <section className="panel">
        <div className="panel-title">
          <h2>Mes transactions</h2>
          <label className="inline-label">
            Afficher
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Toutes les opérations</option>
              <option value="COUPON_RECHARGE">Recharges</option>
              <option value="MEAL_DEBIT">Repas</option>
            </select>
          </label>
        </div>
        {resource.loading ? (
          <Loading />
        ) : resource.error ? (
          <ErrorBox message={resource.error} />
        ) : (
          <>
            <TransactionsTable items={resource.data!.items} />
            <Pagination
              page={page}
              pages={resource.data!.pages}
              total={resource.data!.total}
              onChange={setPage}
            />
          </>
        )}
      </section>
    </>
  );
}
export function MealsPage() {
  const [page, setPage] = useState(1);
  const meals = useResource<Page<Meal>>(`/meals/me?page=${page}&limit=10`);
  const stats = useResource<Stats>('/meals/me/stats');
  return (
    <>
      <PageTitle
        eyebrow="VOTRE RESTAURATION"
        title="Les bons moments se comptent."
        description="Votre consommation de démonstration, au fil des jours."
      />
      <div className="two-column meals-summary">
        <section className="panel form-panel">
          <span className="section-tag">{month()}</span>
          <h2>Votre mois à table</h2>
          {stats.loading ? (
            <Loading />
          ) : stats.error ? (
            <ErrorBox message={stats.error} />
          ) : (
            <div className="inline-stats">
              <div>
                <strong>{stats.data!.totalMeals}</strong>
                <span>repas simulés</span>
              </div>
              <div>
                <strong>{money(stats.data!.totalSpentCents)}</strong>
                <span>dépenses simulées</span>
              </div>
            </div>
          )}
        </section>
        <section className="panel form-panel">
          {stats.data && <Breakdown stats={stats.data} />}
        </section>
      </div>
      <section className="panel">
        <div className="panel-title">
          <h2>Historique des repas</h2>
          <span className="subtle-tag">Heure de Casablanca</span>
        </div>
        {meals.loading ? (
          <Loading />
        ) : meals.error ? (
          <ErrorBox message={meals.error} />
        ) : (
          <>
            {!meals.data!.items.length ? (
              <Empty>Aucun repas enregistré.</Empty>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Repas</th>
                      <th>Date</th>
                      <th>Heure</th>
                      <th className="align-right">Prix simulé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meals.data!.items.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <strong>{mealNames[m.type]}</strong>
                        </td>
                        <td>{date(m.consumedAt)}</td>
                        <td>{time(m.consumedAt)}</td>
                        <td className="align-right">{money(m.priceCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination
              page={page}
              pages={meals.data!.pages}
              total={meals.data!.total}
              onChange={setPage}
            />
          </>
        )}
      </section>
    </>
  );
}
