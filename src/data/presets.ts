import { buildEmailDocumentFromParts } from '../lib/email'

export const sampleHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f1e8;padding:32px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="shell">
        <tr>
          <td class="hero">
            <p class="eyebrow">EMAIL LAB</p>
            <h1>Um preview técnico antes do disparo.</h1>
            <p class="intro">
              Valide espaçamento, hierarquia, tipografia e responsividade antes de mandar a campanha para a base.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <a href="https://example.com" class="cta">Abrir template</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="content">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td class="stat">
                  <span>600px</span>
                  Largura segura para desktop
                </td>
                <td class="stat">
                  <span>390px</span>
                  Janela móvel para inspeção
                </td>
              </tr>
            </table>
            <p class="body-copy">
              Cole aqui o markup completo do e-mail, incluindo style e estrutura HTML no mesmo documento. O sistema processa o inline e mostra o resultado em viewports diferentes.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`

export const sampleCss = `body {
  margin: 0;
  background: #ede7db;
  color: #171514;
  font-family: Arial, Helvetica, sans-serif;
}

.shell {
  width: 100%;
  max-width: 600px;
  background: #fffdf9;
  border-collapse: collapse;
}

.hero {
  padding: 48px 48px 32px;
  background:
    radial-gradient(circle at top right, rgba(236, 115, 61, 0.18), transparent 34%),
    linear-gradient(135deg, #171514 0%, #23201c 55%, #302821 100%);
  color: #fff8ef;
}

.eyebrow {
  margin: 0 0 20px;
  font-size: 11px;
  letter-spacing: 0.24em;
  font-weight: 700;
}

.hero h1 {
  margin: 0 0 18px;
  font-size: 40px;
  line-height: 1.05;
  font-family: Georgia, 'Times New Roman', serif;
}

.intro,
.body-copy {
  margin: 0;
  font-size: 16px;
  line-height: 1.7;
}

.cta {
  display: inline-block;
  margin-top: 28px;
  padding: 14px 22px;
  border-radius: 999px;
  background: #ef7d48;
  color: #171514;
  font-weight: 700;
  text-decoration: none;
}

.content {
  padding: 32px 48px 48px;
}

.stat {
  width: 50%;
  padding: 0 12px 18px 0;
  color: #4c433b;
  font-size: 14px;
  line-height: 1.6;
}

.stat span {
  display: block;
  margin-bottom: 8px;
  color: #171514;
  font-size: 24px;
  font-weight: 700;
}

@media only screen and (max-width: 620px) {
  .hero,
  .content {
    padding: 28px 22px !important;
  }

  .hero h1 {
    font-size: 30px !important;
  }

  .stat {
    display: block;
    width: 100% !important;
    padding-right: 0 !important;
  }
}`

export const sampleMarkup = buildEmailDocumentFromParts(sampleHtml, sampleCss)
