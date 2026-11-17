import { useState, type FormEvent } from 'react';
import { ArrowRight, Leaf, LockKeyhole, Ticket, Utensils } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { homeFor, useAuth } from '../app/auth';
import { Brand, DemoBanner } from '../components/layout';
import { ErrorBox } from '../components/ui';
import { errorMessage } from '../services/api';
export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('student@smartresto.local');
  const [password, setPassword] = useState('DemoResto2026!');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const account = await login(email, password);
      navigate(homeFor(account.role));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <DemoBanner />
      <div className="login-layout">
        <section className="login-story">
          <Brand />
          <div>
            <span className="story-pill">
              <Leaf size={14} /> LA VIE AU CAMPUS, SIMPLIFIÉE
            </span>
            <h1>
              Moins d’attente.
              <br />
              Plus de temps
              <br />
              <em>à partager.</em>
            </h1>
            <p>
              Votre espace de restauration étudiante.
              <br />
              Rechargez avec un coupon et gardez un œil
              <br />
              sur vos repas, en toute simplicité.
            </p>
            <div className="story-cards">
              <span>
                <Ticket />
                Un coupon pour recharger
              </span>
              <span>
                <Utensils />
                Vos repas en un clin d’œil
              </span>
            </div>
          </div>
          <small>
            SmartResto est une démonstration indépendante.
            <br />
            Aucune connexion au système réel du restaurant.
          </small>
        </section>
        <section className="login-form-wrap">
          <form className="login-form" onSubmit={submit}>
            <span className="section-tag">BIENVENUE SUR SMARTRESTO</span>
            <h2>Heureux de vous retrouver.</h2>
            <p className="muted">Connectez-vous à votre espace campus.</p>
            <label htmlFor="email">Adresse e-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <ErrorBox message={error} />}
            <button className="button full" disabled={busy}>
              {busy ? 'Connexion…' : 'Se connecter'}
              <ArrowRight size={18} />
            </button>
            <p className="login-security">
              <LockKeyhole size={13} /> Session sécurisée · Données de démonstration
            </p>
            <div className="demo-accounts">
              <strong>Explorer la démonstration</strong>
              <p>Choisissez un compte de test. Le mot de passe est prérempli.</p>
              <div>
                {[
                  ['student', 'Étudiant'],
                  ['seller', 'Vendeur'],
                  ['admin', 'Admin'],
                ].map(([name, label]) => (
                  <button
                    type="button"
                    key={name}
                    className={email.startsWith(name + '@') ? 'selected' : ''}
                    onClick={() => {
                      setEmail(`${name}@smartresto.local`);
                      setPassword('DemoResto2026!');
                      setError('');
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
