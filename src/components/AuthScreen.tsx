import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'

type AuthScreenProps = {
  isSubmitting: boolean
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (fullName: string, email: string, password: string) => Promise<void>
}

export function AuthScreen({ isSubmitting, onSignIn, onSignUp }: AuthScreenProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    setError(null)

    if (!email.trim().toLowerCase().endsWith('@oderco.com.br')) {
      setError('Use um email corporativo @oderco.com.br.')
      return
    }

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setError('Informe seu nome.')
        return
      }

      if (password !== confirmPassword) {
        setError('As senhas nao conferem.')
        return
      }

      if (password.length < 6) {
        setError('A senha precisa ter pelo menos 6 caracteres.')
        return
      }

      try {
        await onSignUp(fullName.trim(), email.trim().toLowerCase(), password)
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Nao foi possivel criar a conta.')
      }

      return
    }

    try {
      await onSignIn(email.trim().toLowerCase(), password)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Nao foi possivel autenticar.')
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-layout">
        <div className="auth-hero">
          <span className="auth-hero__eyebrow">E-mail Lab</span>
          <h1>Centralize templates, secoes e identidade visual por empresa.</h1>
          <p>
            Um ambiente unico para criar emails, validar em contexto Gmail e compartilhar padroes entre equipes.
          </p>

          <div className="auth-hero__highlights">
            <article>
              <strong>Empresas no mesmo workspace</strong>
              <span>PCYES, ODERCO, AZUX, CRM, ODEX, TONANTE e QUATI com identidade separada.</span>
            </article>
            <article>
              <strong>Biblioteca reutilizavel</strong>
              <span>Headers, footers e contexto visual prontos para acelerar novas campanhas.</span>
            </article>
            <article>
              <strong>Controle corporativo</strong>
              <span>Entrada restrita ao dominio Oderco com compartilhamento por empresa.</span>
            </article>
          </div>
        </div>

        <div className="auth-card auth-card--elevated">
          <header className="auth-card__header">
            <div>
              <h2>{mode === 'signin' ? 'Acessar workspace' : 'Criar sua conta'}</h2>
              <p>
                {mode === 'signin'
                  ? 'Entre com sua conta corporativa para acessar os projetos compartilhados.'
                  : 'Cadastre uma nova conta usando apenas o dominio @oderco.com.br.'}
              </p>
            </div>
            <span className="auth-card__domain">@oderco.com.br</span>
          </header>

          <div className="auth-card__tabs">
            <button className={mode === 'signin' ? 'is-active' : ''} onClick={() => setMode('signin')} type="button">
              Entrar
            </button>
            <button className={mode === 'signup' ? 'is-active' : ''} onClick={() => setMode('signup')} type="button">
              Criar conta
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <label className="field auth-field">
                <span>Nome</span>
                <div className="auth-input">
                  <span className="auth-input__icon">
                    <UserRound size={16} />
                  </span>
                  <input
                    autoComplete="name"
                    className="auth-input__field"
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Seu nome completo"
                    value={fullName}
                  />
                </div>
              </label>
            )}

            <label className="field auth-field">
              <span>E-mail</span>
              <div className="auth-input">
                <span className="auth-input__icon">
                  <Mail size={16} />
                </span>
                <input
                  autoComplete="email"
                  className="auth-input__field"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="voce@oderco.com.br"
                  type="email"
                  value={email}
                />
              </div>
            </label>

            <label className="field auth-field">
              <span>Senha</span>
              <div className="auth-input">
                <span className="auth-input__icon">
                  <LockKeyhole size={16} />
                </span>
                <input
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  className="auth-input__field auth-input__field--password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Digite sua senha"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                />
                <button
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="auth-input__toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {mode === 'signup' && (
              <label className="field auth-field">
                <span>Confirmar senha</span>
                <div className="auth-input">
                  <span className="auth-input__icon">
                    <ShieldCheck size={16} />
                  </span>
                  <input
                    autoComplete="new-password"
                    className="auth-input__field auth-input__field--password"
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repita a senha"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                  />
                  <button
                    aria-label={showConfirmPassword ? 'Ocultar confirmacao de senha' : 'Mostrar confirmacao de senha'}
                    className="auth-input__toggle"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    type="button"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
            )}

            {error && <div className="auth-card__error">{error}</div>}

            <button className="primary-button auth-card__submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Processando...' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
