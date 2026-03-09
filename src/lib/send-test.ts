type SendTestEmailInput = {
  companyId: string
  markup: string
  subject: string
  toEmails: string[]
}

export async function sendTestEmail(accessToken: string, input: SendTestEmailInput) {
  const response = await fetch('/api/send-test-email', {
    body: JSON.stringify(input),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  const payload = (await response.json().catch(() => ({}))) as {
    message?: string
    ok?: boolean
  }

  if (!response.ok || !payload.ok) {
    throw new Error(payload.message || 'Nao foi possivel enviar o email de teste.')
  }
}
