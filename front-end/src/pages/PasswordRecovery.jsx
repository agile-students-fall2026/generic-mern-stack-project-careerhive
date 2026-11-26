import { useEffect, useRef, useState } from 'react'
import { requestPasswordReset, resetPassword } from '../data/api.js'
import './Auth.css'

const emptyForm = { email: '', password: '', confirmPassword: '' }

export default function PasswordRecovery({ reset = false, token }) {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const heading = useRef(null)
  const status = useRef(null)
  const missingLink = reset && !token
  const action = reset ? 'Reset password' : 'Send reset link'

  useEffect(() => { heading.current.focus() }, [])
  useEffect(() => { if (success) status.current.focus() }, [success])

  function update(field) {
    return event => setForm({ ...form, [field]: event.target.value })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return
    setError('')
    const { email, password, confirmPassword } = form
    if (reset && password !== confirmPassword) {
      setError('Enter matching passwords.')
      return
    }
    setSubmitting(true)
    try {
      if (reset) await resetPassword({ token, password, confirmPassword })
      else await requestPasswordReset(email.trim())
      setForm(emptyForm)
      setSuccess(true)
    } catch (problem) {
      setError(problem.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth">
      <p className="auth-logo">CareerHive</p>
      {!success && <a className="auth-back" href="#/login">&lt; Back to Log In</a>}
      <h1 ref={heading} tabIndex={-1}>{reset ? 'Reset Password' : 'Forgot Password'}</h1>
      {success ? (
        <>
          <p className="auth-lead" ref={status} tabIndex={-1} role="status">
            {reset ? 'Your password has been reset.' : 'If an account exists for that email, check your inbox for a reset link.'}
          </p>
          <a className="ui-button auth-link-button" href="#/login">Log In</a>
        </>
      ) : missingLink ? (
        <p className="auth-error" role="alert">This reset link is incomplete.</p>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          {reset ? (
            <>
              <label htmlFor="recovery-password">New password</label>
              <input id="recovery-password" className="ui-field" type="password" autoComplete="new-password"
                required value={form.password} onChange={update('password')} />
              <label htmlFor="recovery-confirm">Confirm new password</label>
              <input id="recovery-confirm" className="ui-field" type="password" autoComplete="new-password"
                required value={form.confirmPassword} onChange={update('confirmPassword')} />
            </>
          ) : (
            <>
              <label htmlFor="recovery-email">Email</label>
              <input id="recovery-email" className="ui-field" type="email" autoComplete="email"
                required value={form.email} onChange={update('email')} />
            </>
          )}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="ui-button" type="submit" disabled={submitting}>
            {submitting ? (reset ? 'Resetting password…' : 'Sending reset link…') : action}
          </button>
        </form>
      )}
      {reset && !success && (
        <p className="auth-switch"><a href="#/forgot-password">Request a new link</a></p>
      )}
    </section>
  )
}
