# Deliverability Checklist

O app agora suporta parte da infraestrutura de entregabilidade no backend, mas ainda depende de DNS e do provedor SMTP para fechar o ciclo.

## O que o sistema passou a suportar

- `from`, `reply-to` e `envelope-from` por empresa via `EMAIL_LAB_COMPANY_SENDER_MAP`
- parte `text/plain` junto do HTML
- headers `List-ID`, `List-Unsubscribe`, `List-Unsubscribe-Post` e `Feedback-ID`
- DKIM opcional no app via `EMAIL_DKIM_*`
- endpoint de diagnostico em `GET /api/deliverability-status?companyId=<id>`

## O que precisa existir fora do código

1. SPF publicado para o dominio usado no envelope-from.
2. DKIM publicado para o dominio usado no `From`.
3. DMARC publicado para o dominio usado no `From`.
4. Subdominio dedicado para envio em volume.
5. Link real de unsubscribe respondendo em `EMAIL_LAB_UNSUBSCRIBE_URL`.
6. Monitoramento no Google Postmaster Tools.

## Exemplo de sender map

```json
{
  "pcyes": {
    "from": "PCYES <news@mailer.pcyes.com>",
    "replyTo": "atendimento@pcyes.com",
    "bounceAddress": "bounce@mailer.pcyes.com",
    "unsubscribeUrl": "https://mailer.pcyes.com/unsubscribe?email={{email}}&companyId={{companyId}}",
    "listId": "pcyes-newsletter.mailer.pcyes.com",
    "dkimDomainName": "mailer.pcyes.com",
    "dkimKeySelector": "mailer",
    "dkimPrivateKey": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"
  }
}
```

## Links oficiais

- Google Sender Guidelines: <https://support.google.com/a/answer/81126>
- Google Postmaster Tools: <https://postmaster.google.com/>
- Yahoo sender requirements: <https://senders.yahooinc.com/>
