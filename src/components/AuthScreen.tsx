import React, { useState } from 'react';
import { ArrowRight, Lock, Mail, ShieldCheck, User, Waves } from 'lucide-react';

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
  const [cref, setCref] = useState('');
  const [specialty, setSpecialty] = useState('Alto Rendimento');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Preencha e-mail e senha.');
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
    <div className="auth-shell">
      <div className="auth-card surface-card">
        <div className="auth-brand-row">
          <div className="brand">
            <div className="brand-mark">
              <Waves size={18} />
            </div>
            <div className="brand-text">
              <span className="brand-name">RAIA // PRO</span>
              <span className="brand-sub">Gestão Técnica & Performance Aquática</span>
            </div>
          </div>
          <span className={`sync-pill ${syncMode}`}>
            {syncMode === 'cloud' ? 'Nuvem Convex' : 'Modo Local'}
          </span>
        </div>

        <div className="segmented" style={{ marginBottom: 18 }}>
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
              <label>Nome do Treinador(a)</label>
              <div className="input-icon-wrap">
                <User size={15} />
                <input
                  type="text"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Prof. Carlos Mendes"
                  required
                />
              </div>
            </div>
          )}

          <div className="field">
            <label>E-mail</label>
            <div className="input-icon-wrap">
              <Mail size={15} />
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="treinador@equipe.com.br"
                required
              />
            </div>
          </div>

          <div className="field">
            <label>Senha</label>
            <div className="input-icon-wrap">
              <Lock size={15} />
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : 'Sua senha'}
                required
              />
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
                  placeholder="Ex: 012345-G/SP"
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
            className="btn btn-primary"
            style={{ width: '100%', minHeight: 42, marginTop: 4 }}
            disabled={isSubmitting}
          >
            <ShieldCheck size={16} />
            {isSubmitting
              ? 'Processando...'
              : mode === 'login'
                ? 'Entrar no Painel do Treinador'
                : 'Criar Conta e Começar'}
            <ArrowRight size={15} />
          </button>
        </form>
      </div>
    </div>
  );
};
