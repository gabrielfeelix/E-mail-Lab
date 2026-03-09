import { useState } from 'react'

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
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
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
          <span className="auth-panel__eyebrow">E-mail Lab</span>
          <h1>Templates compartilhados por empresa, com preview real e base pronta para IA.</h1>
          <p>Entre com sua conta corporativa Oderco para acessar os projetos e templates da equipe.</p>
        </div>

        <div className="auth-card">
          <div className="auth-card__tabs">
            <button className={mode === 'signin' ? 'is-active' : ''} onClick={() => setMode('signin')} type="button">
              Entrar
            </button>
            <button className={mode === 'signup' ? 'is-active' : ''} onClick={() => setMode('signup')} type="button">
              Criar conta
            </button>
          </div>

          <div className="auth-card__body">
            {mode === 'signup' && (
              <label className="field">
                <span>Nome</span>
                <input onChange={(event) => setFullName(event.target.value)} value={fullName} />
              </label>
            )}

            <label className="field">
              <span>E-mail</span>
              <input onChange={(event) => setEmail(event.target.value)} value={email} />
            </label>

            <label className="field">
              <span>Senha</span>
              <input onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
            </label>

            {mode === 'signup' && (
              <label className="field">
                <span>Confirmar senha</span>
                <input
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type="password"
                  value={confirmPassword}
                />
              </label>
            )}

            {error && <div className="auth-card__error">{error}</div>}

            <button className="primary-button auth-card__submit" disabled={isSubmitting} onClick={handleSubmit} type="button">
              {isSubmitting ? 'Processando...' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
