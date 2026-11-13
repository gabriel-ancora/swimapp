import React, { useState } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  User,
  Waves,
} from 'lucide-react';
import piscinaImg from '../assets/piscina.webp';

interface AuthScreenProps {
  syncMode: 'cloud' | 'local';
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (payload: {
    name: string;
    email: string;
    password: string;
    cref: string;
    specialty: string;
  }) => Promise<void>;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ syncMode, onLogin, onRegister }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [cref, setCref] = useState('');
  const [specialty, setSpecialty] = useState('Alto Rendimento');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Preencha seu e-mail e senha para continuar.');
      return;
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setError('Informe o nome completo do treinador.');
        return;
      }
      if (password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await onLogin(email.trim(), password);
      } else {
        await onRegister({
          name: name.trim(),
          email: email.trim(),
          password,
          cref: cref.trim(),
          specialty: specialty.trim(),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível autenticar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-split">
      {/* Visual Hero Panel */}
      <aside className="auth-hero">
        <img
          src={piscinaImg}
          alt="Piscina olímpica de treinamento"
          className="auth-hero-img"
        />
        <div className="auth-hero-overlay" />

        <div className="auth-hero-content">
          <div className="auth-hero-top">
            <div className="auth-hero-badge">
              <Activity size={14} />
              <span>RAIA // PRO · PERFORMANCE AQUÁTICA</span>
            </div>
          </div>

          <div className="auth-hero-bottom">
            <h1 className="auth-hero-title">
              Prescrição técnica, telemetria e gestão de elenco em um só lugar.
            </h1>
            <p className="auth-hero-desc">
              Estruture sessões por zonas fisiológicas, gerencie categorias e acompanhe a evolução
              estatística de cada atleta em tempo real.
            </p>

            <div className="auth-hero-features">
              <div className="auth-hero-feature">
                <CheckCircle2 size={15} />
                <span>Zonas Z1–VEL</span>
              </div>
              <div className="auth-hero-feature">
                <CheckCircle2 size={15} />
                <span>Análise de Atletas</span>
              </div>
              <div className="auth-hero-feature">
                <CheckCircle2 size={15} />
                <span>Multi-dispositivo</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Form Panel */}
      <main className="auth-panel">
        <div className="auth-panel-inner">
          <div className="auth-brand-row">
            <div className="brand">
              <div className="brand-mark">
                <Waves size={18} />
              </div>
              <div className="brand-text">
                <span className="brand-name">RAIA // PRO</span>
                <span className="brand-sub">Portal do Treinador</span>
              </div>
            </div>
            <span className={`sync-pill ${syncMode}`}>
              {syncMode === 'cloud' ? 'Nuvem Ativa' : 'Modo Local'}
            </span>
          </div>

          <div className="auth-heading-block">
            <h2 className="auth-title">
              {mode === 'login' ? 'Acesse sua área técnica' : 'Criar conta de treinador'}
            </h2>
            <p className="auth-subtitle">
              {mode === 'login'
                ? 'Entre com suas credenciais para gerenciar sua equipe e treinos.'
                : 'Configure seu perfil para criar sua equipe e cadastrar atletas.'}
            </p>
          </div>

          <div className="segmented auth-mode-switch">
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => {
                setMode('login');
                setError(null);
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'active' : ''}
              onClick={() => {
                setMode('register');
                setError(null);
              }}
            >
              Cadastrar Treinador
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'register' && (
              <div className="field">
                <label>Nome completo</label>
                <div className="input-icon-wrap">
                  <User size={15} />
                  <input
                    type="text"
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Prof. Carlos Mendes"
                    autoComplete="name"
                    required
                  />
                </div>
              </div>
            )}

            <div className="field">
              <label>E-mail profissional</label>
              <div className="input-icon-wrap">
                <Mail size={15} />
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="treinador@equipe.com.br"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="field">
              <label>Senha</label>
              <div className="input-icon-wrap has-right-action">
                <Lock size={15} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : 'Digite sua senha'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                />
                <button
                  type="button"
                  className="input-right-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div className="form-grid">
                <div className="field col-6">
                  <label>CREF (Opcional)</label>
                  <input
                    type="text"
                    className="input mono-num"
                    value={cref}
                    onChange={(e) => setCref(e.target.value)}
                    placeholder="012345-G/SP"
                  />
                </div>
                <div className="field col-6">
                  <label>Especialidade</label>
                  <input
                    type="text"
                    className="input"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="Ex: Velocidade, Fundo"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary auth-submit-btn"
              disabled={isSubmitting}
            >
              <ShieldCheck size={16} />
              <span>
                {isSubmitting
                  ? 'Autenticando...'
                  : mode === 'login'
                    ? 'Entrar no Sistema'
                    : 'Criar Conta e Acessar'}
              </span>
              <ArrowRight size={15} />
            </button>
          </form>

          <div className="auth-footer">
            <span>Acesso protegido · Sessão criptografada</span>
          </div>
        </div>
      </main>
    </div>
  );
};
