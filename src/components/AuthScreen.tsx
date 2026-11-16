import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import piscinaImg from '../assets/piscina.webp';
import { getErrorMessage } from '../domain/errors';
import { Logo } from './Logo';

const CURRENT_YEAR = new Date().getFullYear();

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
  const [specialty, setSpecialty] = useState('');
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
      if (password.length < 8) {
        setError('A senha deve ter pelo menos 8 caracteres.');
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
      setError(getErrorMessage(err, 'Não foi possível autenticar.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setError(null);
  };

  return (
    <div className="auth-layout">
      <main className="auth-form-side">
        <Logo />

        <div className="auth-form-wrap">
          <div className="auth-panel-inner">
            <h1 className="auth-title">
              {mode === 'login' ? 'Entrar na sua conta' : 'Criar sua conta'}
            </h1>
            <p className="auth-subtitle">
              {mode === 'login'
                ? 'Bem-vindo de volta. Seus treinos e atletas estão onde você deixou.'
                : 'Leva um minuto. Depois é só criar sua equipe e cadastrar os atletas.'}
            </p>

            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              {mode === 'register' && (
                <div className="field">
                  <label htmlFor="auth-name">Nome</label>
                  <input
                    id="auth-name"
                    type="text"
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Como os atletas te chamam"
                    autoComplete="name"
                    required
                  />
                </div>
              )}

              <div className="field">
                <label htmlFor="auth-email">E-mail</label>
                <input
                  id="auth-email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@clube.com.br"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="auth-password">Senha</label>
                <div className="input-icon-wrap has-right-action">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    className="input"
                    style={{ paddingLeft: 11 }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'register' ? 'Pelo menos 8 caracteres' : ''}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                  />
                  <button
                    type="button"
                    className="input-right-btn"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <div className="form-grid">
                  <div className="field col-6">
                    <label htmlFor="auth-cref">
                      CREF <span style={{ color: 'var(--ink-muted)', fontWeight: 400 }}>(opcional)</span>
                    </label>
                    <input
                      id="auth-cref"
                      type="text"
                      className="input"
                      value={cref}
                      onChange={(e) => setCref(e.target.value)}
                      placeholder="012345-G/SP"
                    />
                  </div>
                  <div className="field col-6">
                    <label htmlFor="auth-specialty">Especialidade</label>
                    <input
                      id="auth-specialty"
                      type="text"
                      className="input"
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      placeholder="Velocidade, fundo…"
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
                {isSubmitting
                  ? mode === 'login'
                    ? 'Entrando…'
                    : 'Criando conta…'
                  : mode === 'login'
                    ? 'Entrar'
                    : 'Criar conta'}
              </button>
            </form>

            <p className="auth-switch">
              {mode === 'login' ? (
                <>
                  Ainda não tem conta?{' '}
                  <button type="button" className="link-btn" onClick={() => switchMode('register')}>
                    Criar conta
                  </button>
                </>
              ) : (
                <>
                  Já tem conta?{' '}
                  <button type="button" className="link-btn" onClick={() => switchMode('login')}>
                    Entrar
                  </button>
                </>
              )}
            </p>

            {syncMode === 'local' && (
              <p className="auth-local-note">
                Modo local: os dados ficam salvos apenas neste navegador.
              </p>
            )}
          </div>
        </div>

        <span className="auth-legal">© {CURRENT_YEAR} Raia</span>
      </main>

      <aside className="auth-visual" aria-hidden="true">
        <img src={piscinaImg} alt="" />
        <div className="auth-visual-caption">
          <p>Monte o treino, acompanhe a carga e chegue à competição com o plano em dia.</p>
          <span>Treinos, periodização e análise de atletas em um só lugar.</span>
        </div>
      </aside>
    </div>
  );
};
