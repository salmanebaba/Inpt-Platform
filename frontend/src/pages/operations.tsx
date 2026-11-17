import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Check,
  Download,
  FlaskConical,
  Info,
  Plus,
  Search,
  Ticket,
  Trash2,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Badge,
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
import { date, downloadCsv, mealNames, money, statusNames, time } from '../services/format';
import type {
  Batch,
  Coupon,
  CouponStatus,
  MealType,
  Page,
  Printable,
  Sale,
  Summary,
  Transaction,
  User,
} from '../types';

function CouponInventory({
  admin = false,
  revision,
  onChange,
}: {
  admin?: boolean;
  revision: number;
  onChange: () => void;
}) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Coupon>();
  const [action, setAction] = useState<'activate' | 'void'>('activate');
  const [confirmed, setConfirmed] = useState(false);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  const dialog = useRef<HTMLDialogElement>(null);
  const prefix = admin ? '/admin' : '/seller';
  const resource = useResource<Page<Coupon>>(
    `${prefix}/coupons?page=${page}&limit=10${status ? `&status=${status}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
    revision,
  );
  useEffect(() => {
    if (selected) dialog.current?.showModal();
  }, [selected]);
  function choose(coupon: Coupon, operation: 'activate' | 'void') {
    setSelected(coupon);
    setAction(operation);
    setConfirmed(false);
    setReference('');
    setError('');
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected || !confirmed) return;
    setBusy(true);
    setError('');
    try {
      await api(
        `${prefix}/coupons/${selected.publicSerial}/${action}`,
        action === 'activate'
          ? {
              simulatedCashConfirmed: true,
              ...(reference.trim() ? { saleReference: reference.trim() } : {}),
            }
          : {},
      );
      setSelected(undefined);
      onChange();
      toast(
        action === 'activate'
          ? 'Vente simulée enregistrée. Coupon activé.'
          : 'Coupon non vendu annulé.',
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>{admin ? 'Tous les coupons' : 'Mon stock de coupons'}</h2>
          <p>Identifiez le coupon grâce au numéro public imprimé.</p>
        </div>
      </div>
      <div className="table-toolbar">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Rechercher un numéro public"
            placeholder="Rechercher un numéro public…"
            value={search}
            maxLength={100}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          aria-label="Statut des coupons"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tous les statuts</option>
          {Object.entries(statusNames).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorBox message={resource.error} />
      ) : (
        <>
          {!resource.data!.items.length ? (
            <Empty>Aucun coupon trouvé. L’administrateur peut générer et attribuer un lot.</Empty>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Numéro public</th>
                    <th>Lot</th>
                    <th>Valeur</th>
                    <th>Statut</th>
                    <th className="align-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data!.items.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <code>{c.publicSerial}</code>
                      </td>
                      <td>{c.batch.label}</td>
                      <td>
                        <strong>{money(c.batch.amountCents)}</strong>
                      </td>
                      <td>
                        <Badge status={c.status} />
                      </td>
                      <td className="align-right">
                        {c.status === 'CREATED' ? (
                          <div className="row-actions">
                            <button className="button small" onClick={() => choose(c, 'activate')}>
                              Activer <ArrowRight size={14} />
                            </button>
                            {admin && (
                              <button
                                className="icon-button danger"
                                aria-label={`Annuler ${c.publicSerial}`}
                                onClick={() => choose(c, 'void')}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={page}
            pages={resource.data!.pages}
            total={resource.data!.total}
            onChange={setPage}
          />
        </>
      )}
      <div className="panel-footnote">
        <Info size={15} /> Les codes secrets sont imprimés par l’administrateur et ne sont jamais
        affichés dans le stock.
      </div>
      {selected && (
        <dialog
          ref={dialog}
          className="action-dialog"
          aria-labelledby="sale-title"
          onCancel={(e) => {
            if (busy) e.preventDefault();
            else setSelected(undefined);
          }}
        >
          <form onSubmit={submit}>
            <button
              type="button"
              className="dialog-close icon-button"
              disabled={busy}
              aria-label="Fermer"
              onClick={() => setSelected(undefined)}
            >
              <X size={20} />
            </button>
            <span className="large-icon">
              <Ticket size={28} />
            </span>
            <h2 id="sale-title">
              {action === 'activate' ? 'Confirmer la vente simulée' : 'Annuler ce coupon'}
            </h2>
            <p className="muted">
              <code>{selected.publicSerial}</code> · {money(selected.batch.amountCents)}
            </p>
            {action === 'activate' && (
              <>
                <label htmlFor="sale-reference">Référence de vente (facultative)</label>
                <input
                  id="sale-reference"
                  value={reference}
                  maxLength={100}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ex. BUVETTE-001"
                />
              </>
            )}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>
                {action === 'activate'
                  ? 'Je confirme la réception simulée des espèces. Cette opération ne constitue pas un reçu de paiement réel.'
                  : 'Je confirme l’annulation de ce coupon non vendu. Il ne pourra plus être activé.'}
              </span>
            </label>
            {error && <ErrorBox message={error} />}
            <button className="button full" disabled={busy || !confirmed}>
              {busy
                ? 'Enregistrement…'
                : action === 'activate'
                  ? 'Enregistrer et activer'
                  : 'Annuler le coupon'}
              <Check size={17} />
            </button>
          </form>
        </dialog>
      )}
    </section>
  );
}
function SalesTable({ admin = false, revision = 0 }: { admin?: boolean; revision?: number }) {
  const [page, setPage] = useState(1);
  const resource = useResource<Page<Sale>>(
    `/${admin ? 'admin' : 'seller'}/sales?page=${page}&limit=10`,
    revision,
  );
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>{admin ? 'Audit des ventes simulées' : 'Mes ventes simulées'}</h2>
          <p>Une activation correspond à une vente de démonstration.</p>
        </div>
        <span className="subtle-tag">SIMULATION</span>
      </div>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorBox message={resource.error} />
      ) : (
        <>
          {!resource.data!.items.length ? (
            <Empty>Aucune vente enregistrée.</Empty>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Coupon</th>
                    {admin && <th>Vendeur</th>}
                    <th>Date · Casablanca</th>
                    <th>Référence</th>
                    <th>Statut</th>
                    <th className="align-right">Montant simulé</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data!.items.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <code>{s.coupon.publicSerial}</code>
                      </td>
                      {admin && <td>{s.seller.fullName}</td>}
                      <td>
                        {date(s.soldAt)}
                        <small>{time(s.soldAt)}</small>
                      </td>
                      <td>{s.saleReference || '—'}</td>
                      <td>
                        <Badge status={s.coupon.status} />
                      </td>
                      <td className="align-right">
                        <strong>{money(s.amountCents)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={page}
            pages={resource.data!.pages}
            total={resource.data!.total}
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}
export function SellerPage() {
  const [revision, setRevision] = useState(0);
  const summary = useResource<{ counts: Partial<Record<CouponStatus, number>> }>(
    '/seller/summary',
    revision,
  );
  return (
    <>
      <PageTitle
        eyebrow="POINT DE VENTE CAMPUS"
        title="Chaque coupon, à sa place."
        description="Activez uniquement les coupons qui vous sont attribués après une vente simulée."
      />
      <div className="mini-stats">
        {(['CREATED', 'ACTIVE', 'REDEEMED', 'VOID'] as CouponStatus[]).map((s) => (
          <section className="panel mini-stat" key={s}>
            <span>{statusNames[s]}</span>
            <strong>{summary.data?.counts[s] ?? '—'}</strong>
          </section>
        ))}
      </div>
      {summary.error && <ErrorBox message={summary.error} />}
      <CouponInventory revision={revision} onChange={() => setRevision((r) => r + 1)} />
      <SalesTable revision={revision} />
    </>
  );
}
export function AdminDashboardPage() {
  const summary = useResource<Summary>('/admin/summary');
  const batches = useResource<Page<Batch>>('/admin/coupon-batches?limit=5');
  return (
    <>
      <PageTitle
        eyebrow="PILOTAGE DU PROTOTYPE"
        title="Le campus en un coup d’œil."
        description="Supervisez les coupons et l’activité de démonstration."
        action={
          <Link className="button" to="/admin/coupons">
            <Plus size={17} /> Créer des coupons
          </Link>
        }
      />
      {summary.error && <ErrorBox message={summary.error} />}
      <div className="mini-stats">
        {[
          ['Lots générés', summary.data?.batches],
          ['Coupons actifs', summary.data?.counts.ACTIVE ?? 0],
          ['Coupons utilisés', summary.data?.counts.REDEEMED ?? 0],
          ['Ventes simulées', summary.data ? money(summary.data.salesCents) : '—'],
        ].map(([label, value]) => (
          <section className="panel mini-stat" key={label}>
            <span>{label}</span>
            <strong>{summary.loading ? '—' : value}</strong>
          </section>
        ))}
      </div>
      <section className="panel">
        <div className="panel-title">
          <h2>Derniers lots</h2>
          <Link className="text-link" to="/admin/coupons">
            Gérer les coupons <ArrowRight size={16} />
          </Link>
        </div>
        {batches.loading ? (
          <Loading />
        ) : batches.error ? (
          <ErrorBox message={batches.error} />
        ) : !batches.data!.items.length ? (
          <Empty>Générez votre premier lot pour commencer.</Empty>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Lot</th>
                  <th>Valeur unitaire</th>
                  <th>Quantité</th>
                  <th>Création</th>
                </tr>
              </thead>
              <tbody>
                {batches.data!.items.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.label}</strong>
                    </td>
                    <td>{money(b.amountCents)}</td>
                    <td>{b.quantity}</td>
                    <td>{date(b.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="info-box">
        <Info size={20} />
        <p>
          Le registre retrace uniquement des opérations simulées. Toute distribution réelle
          nécessite l’autorisation de l’école et de la régie, une procédure de rapprochement et une
          intégration officielle.
        </p>
      </div>
    </>
  );
}
export function AdminCouponsPage() {
  const sellers = useResource<Page<User>>('/admin/users?role=SELLER&limit=100');
  const [label, setLabel] = useState('Coupons campus');
  const [amountCents, setAmount] = useState(5000);
  const [quantity, setQuantity] = useState(5);
  const [sellerId, setSeller] = useState('');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [printable, setPrintable] = useState<Printable[]>();
  const [exported, setExported] = useState(false);
  const toast = useToast();
  useEffect(() => {
    if (!printable) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [printable]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api<{ printable: Printable[] }>('/admin/coupon-batches', {
        label: label.trim(),
        amountCents,
        quantity,
        ...(sellerId ? { assignedSellerId: sellerId } : {}),
      });
      setPrintable(result.printable);
      setExported(false);
      setRevision((r) => r + 1);
      toast('Lot créé. Exportez les codes avant de quitter cette page.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="GESTION DES COUPONS"
        title="Le début d’un bon repas."
        description="Générez, imprimez et attribuez vos coupons de démonstration."
      />
      <div className="two-column">
        <form className="panel form-panel" onSubmit={submit}>
          <h2>Créer un lot de coupons</h2>
          <label htmlFor="batch-label">Nom du lot</label>
          <input
            id="batch-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
            maxLength={100}
            minLength={1}
          />
          <fieldset className="denominations">
            <legend>Valeur unitaire</legend>
            {[2000, 5000, 10000].map((cents) => (
              <label key={cents} className={amountCents === cents ? 'selected' : ''}>
                <input
                  type="radio"
                  name="denomination"
                  checked={amountCents === cents}
                  onChange={() => setAmount(cents)}
                />
                {cents / 100} DH
              </label>
            ))}
          </fieldset>
          <div className="form-grid">
            <div>
              <label htmlFor="quantity">Quantité (1 à 100)</label>
              <input
                id="quantity"
                type="number"
                min={1}
                max={100}
                step={1}
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>
            <div>
              <label htmlFor="seller">Attribuer au vendeur</label>
              <select id="seller" value={sellerId} onChange={(e) => setSeller(e.target.value)}>
                <option value="">Stock administrateur</option>
                {sellers.data?.items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {sellers.error && <ErrorBox message={sellers.error} />}
          <p className="field-help">
            Sans attribution, seul un administrateur peut activer ces coupons.
          </p>
          {error && <ErrorBox message={error} />}
          <button className="button full" disabled={busy || !!printable || !label.trim()}>
            {busy ? 'Génération…' : 'Générer les coupons'}
            <Plus size={17} />
          </button>
        </form>
        <section className="panel form-panel soft-panel">
          <span className="large-icon">
            <Download size={27} />
          </span>
          <h2>
            Un export unique.
            <br />
            Des codes à protéger.
          </h2>
          <p className="muted">
            Les codes secrets ne sont jamais conservés en clair. Seul le numéro public reste
            disponible dans le stock.
          </p>
          <ol className="simple-list">
            <li>Exportez le CSV dès la création.</li>
            <li>Imprimez chaque numéro public avec son code secret.</li>
            <li>Remettez les coupons au vendeur désigné.</li>
            <li>Le vendeur active le numéro public après la vente simulée.</li>
          </ol>
          <div className="info-box">
            <Info size={18} />
            <p>
              Un coupon non activé ne peut pas être utilisé. Un coupon vendu ne peut pas être annulé
              dans ce prototype.
            </p>
          </div>
        </section>
      </div>
      {printable && (
        <section className="panel export-panel">
          <div className="panel-title">
            <div>
              <span className="section-tag">AFFICHAGE UNIQUE · CODES SECRETS</span>
              <h2>{printable.length} coupons prêts à imprimer</h2>
              <p>Ne quittez pas cette page avant d’avoir exporté et vérifié votre fichier.</p>
            </div>
            <button
              className="button"
              onClick={() => {
                downloadCsv(printable);
                setExported(true);
              }}
            >
              <Download size={17} /> Exporter le CSV
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Numéro public</th>
                  <th>Code secret à protéger</th>
                  <th>Valeur</th>
                </tr>
              </thead>
              <tbody>
                {printable.map((p) => (
                  <tr key={p.publicSerial}>
                    <td>
                      <code>{p.publicSerial}</code>
                    </td>
                    <td>
                      <code className="secret-code">{p.code}</code>
                    </td>
                    <td>{money(p.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="export-actions">
            <button
              className="button secondary"
              disabled={!exported}
              onClick={() => setPrintable(undefined)}
            >
              <Check size={16} /> J’ai conservé le CSV : masquer les codes
            </button>
            <span className="muted">Les codes ne pourront pas être récupérés.</span>
          </div>
        </section>
      )}
      <CouponInventory admin revision={revision} onChange={() => setRevision((r) => r + 1)} />
    </>
  );
}
export function AdminSalesPage() {
  const [page, setPage] = useState(1);
  const ledger = useResource<Page<Transaction>>(`/admin/transactions?page=${page}&limit=10`);
  return (
    <>
      <PageTitle
        eyebrow="TRAÇABILITÉ"
        title="Un registre, toute la clarté."
        description="Consultez les ventes simulées et le registre immuable des portefeuilles."
      />
      <SalesTable admin />
      <section className="panel">
        <div className="panel-title">
          <h2>Registre des portefeuilles démo</h2>
          <span className="subtle-tag">LECTURE SEULE</span>
        </div>
        {ledger.loading ? (
          <Loading />
        ) : ledger.error ? (
          <ErrorBox message={ledger.error} />
        ) : (
          <>
            <TransactionsTable items={ledger.data!.items} audit />
            <Pagination
              page={page}
              pages={ledger.data!.pages}
              total={ledger.data!.total}
              onChange={setPage}
            />
          </>
        )}
      </section>
    </>
  );
}
export function AdminDemoPage() {
  const students = useResource<Page<User>>('/admin/users?role=STUDENT&limit=100');
  const [studentId, setStudent] = useState('');
  const [type, setType] = useState<MealType>('LUNCH');
  const [priceCents, setPrice] = useState(140);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState<number>();
  const toast = useToast();
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setBalance(undefined);
    try {
      const result = await api<{ balanceCents: number }>('/admin/demo/meals', {
        studentId,
        type,
        priceCents,
      });
      setBalance(result.balanceCents);
      toast('Repas simulé enregistré dans le portefeuille et le registre.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="OUTILS DE DÉMONSTRATION"
        title="Un repas pour tester le parcours."
        description="Simulez un passage au restaurant. Le solde démo sera débité atomiquement."
      />
      <div className="two-column">
        <form className="panel form-panel" onSubmit={submit}>
          <span className="large-icon">
            <FlaskConical size={29} />
          </span>
          <h2>Simuler un repas</h2>
          <label htmlFor="student">Étudiant</label>
          <select
            id="student"
            required
            value={studentId}
            onChange={(e) => {
              setStudent(e.target.value);
              setBalance(undefined);
            }}
          >
            <option value="">Sélectionner un étudiant</option>
            {students.data?.items.map((s) => (
              <option value={s.id} key={s.id}>
                {s.fullName} · {s.studentNumber || s.email}
              </option>
            ))}
          </select>
          {students.error && <ErrorBox message={students.error} />}
          <label htmlFor="meal-type">Type de repas</label>
          <select id="meal-type" value={type} onChange={(e) => setType(e.target.value as MealType)}>
            {Object.entries(mealNames).map(([key, name]) => (
              <option value={key} key={key}>
                {name}
              </option>
            ))}
          </select>
          <label htmlFor="price">Prix en centimes (140 = 1,40 DH)</label>
          <input
            id="price"
            type="number"
            value={priceCents}
            min={1}
            max={10000}
            step={1}
            required
            onChange={(e) => setPrice(Number(e.target.value))}
          />
          <p className="field-help">
            Débit simulé : {money(priceCents)}. Le solde doit être suffisant.
          </p>
          {error && <ErrorBox message={error} />}
          <button className="button full" disabled={busy || !studentId}>
            {busy ? 'Enregistrement…' : 'Simuler le débit du repas'}
            <ArrowRight size={17} />
          </button>
          {balance !== undefined && (
            <div className="success-box" role="status">
              <Check size={20} />
              <span>
                Repas enregistré. Nouveau solde démo : <strong>{money(balance)}</strong>
              </span>
            </div>
          )}
        </form>
        <section className="panel form-panel soft-panel">
          <h2>Un parcours cohérent.</h2>
          <p className="muted">
            Chaque repas crée simultanément une consommation et une écriture au registre. Les
            statistiques de l’étudiant sont mises à jour à partir de ces consommations.
          </p>
          <div className="info-box">
            <Info size={18} />
            <p>
              Cette simulation n’envoie aucune instruction à un lecteur de carte et ne modifie aucun
              système du restaurant réel.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
