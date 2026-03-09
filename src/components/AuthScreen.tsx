import { Eye, EyeOff, LockKeyhole, Mail, Sparkles, UserRound } from 'lucide-react'
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

    try {
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

        await onSignUp(fullName.trim(), email.trim().toLowerCase(), password)
        return
      }

      await onSignIn(email.trim().toLowerCase(), password)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Nao foi possivel autenticar.')
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-panel__hero">
          <div className="auth-panel__brand">
            <span className="auth-panel__eyebrow">E-mail Lab</span>
            <span className="auth-panel__badge">
              <Sparkles size={14} />
              Workspace corporativo
            </span>
          </div>

          <div className="auth-panel__copy">
            <h1>Biblioteca de templates por empresa, com preview fiel e geração assistida por IA.</h1>
            <p>Entre com sua conta corporativa Oderco para acessar projetos compartilhados, seções favoritas e edição centralizada da equipe.</p>
          </div>

          <div className="auth-highlights">
            <article className="auth-highlight">
              <strong>Empresas unificadas</strong>
              <span>PCYES, ODERCO, AZUX, CRM, ODEX, TONANTE e QUATI no mesmo ambiente.</span>
            </article>
            <article className="auth-highlight">
              <strong>Preview contextual</strong>
              <span>Leitura em mobile, tablet e notebook com shell visual inspirada em Gmail.</span>
            </article>
            <article className="auth-highlight">
              <strong>Base pronta para IA</strong>
              <span>Headers e footers favoritos servem de referência para geração de novos emails.</span>
            </article>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-card__header">
            <div>
              <h2>{mode === 'signin' ? 'Acessar workspace' : 'Criar conta corporativa'}</h2>
              <p>{mode === 'signin' ? 'Use seu e-mail Oderco para entrar.' : 'Cadastro restrito ao domínio @oderco.com.br.'}</p>
            </div>
            <span className="auth-card__domain">@oderco.com.br</span>
          </div>

          <div className="auth-card__tabs">
            <button className={mode === 'signin' ? 'is-active' : ''} onClick={() => setMode('signin')} type="button">
              Entrar
            </button>
            <button className={mode === 'signup' ? 'is-active' : ''} onClick={() => setMode('signup')} type="button">
              Criar conta
            </button>
          </div>

          <form className="auth-card__body" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <label className="field">
                <span>Nome</span>
                <div className="auth-input">
                  <span className="auth-input__icon">
                    <UserRound size={16} />
                  </span>
                  <input
                    autoComplete="name"
                    className="auth-input__field"
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Seu nome"
                    value={fullName}
                  />
                </div>
              </label>
            )}

            <label className="field">
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

            <label className="field">
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
              <label className="field">
                <span>Confirmar senha</span>
                <div className="auth-input">
                  <span className="auth-input__icon">
                    <LockKeyhole size={16} />
                  </span>
                  <input
                    autoComplete="new-password"
                    className="auth-input__field auth-input__field--password"
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repita sua senha"
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
