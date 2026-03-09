export type TemplateVariableRecord = {
  id: string
  label: string
  token: string
}

export type TemplateVariableGroup = {
  id: string
  label: string
  variables: TemplateVariableRecord[]
}

export const templateVariableGroups: TemplateVariableGroup[] = [
  {
    id: 'web',
    label: 'Web',
    variables: [
      {
        id: 'base-url',
        label: 'URL Base',
        token: '{{config path="web/unsecure/base_url"}}',
      },
      {
        id: 'secure-base-url',
        label: 'URL Base Seguro',
        token: '{{config path="web/secure/base_url"}}',
      },
    ],
  },
  {
    id: 'general-contact',
    label: 'Enderecos de E-mail da Loja / Contato geral',
    variables: [
      {
        id: 'general-name',
        label: 'Nome do remetente',
        token: '{{config path="trans_email/ident_general/name"}}',
      },
      {
        id: 'general-email',
        label: 'E-mail do remetente',
        token: '{{config path="trans_email/ident_general/email"}}',
      },
    ],
  },
  {
    id: 'sales-contact',
    label: 'Enderecos de E-mail da Loja / Representante de Vendas',
    variables: [
      {
        id: 'sales-name',
        label: 'Nome do remetente',
        token: '{{config path="trans_email/ident_sales/name"}}',
      },
      {
        id: 'sales-email',
        label: 'E-mail do remetente',
        token: '{{config path="trans_email/ident_sales/email"}}',
      },
    ],
  },
  {
    id: 'support-contact',
    label: 'Enderecos de E-mail da Loja / Suporte ao cliente',
    variables: [
      {
        id: 'support-name',
        label: 'Nome do remetente',
        token: '{{config path="trans_email/ident_support/name"}}',
      },
      {
        id: 'support-email',
        label: 'E-mail do remetente',
        token: '{{config path="trans_email/ident_support/email"}}',
      },
    ],
  },
  {
    id: 'custom1-contact',
    label: 'Enderecos de E-mail da Loja / E-mail Personalizado 1',
    variables: [
      {
        id: 'custom1-name',
        label: 'Nome do remetente',
        token: '{{config path="trans_email/ident_custom1/name"}}',
      },
      {
        id: 'custom1-email',
        label: 'E-mail do remetente',
        token: '{{config path="trans_email/ident_custom1/email"}}',
      },
    ],
  },
  {
    id: 'custom2-contact',
    label: 'Enderecos de E-mail da Loja / E-mail Personalizado 2',
    variables: [
      {
        id: 'custom2-name',
        label: 'Nome do remetente',
        token: '{{config path="trans_email/ident_custom2/name"}}',
      },
      {
        id: 'custom2-email',
        label: 'E-mail do remetente',
        token: '{{config path="trans_email/ident_custom2/email"}}',
      },
    ],
  },
  {
    id: 'store-information',
    label: 'Geral / Informacao da Loja',
    variables: [
      {
        id: 'store-name',
        label: 'Nome da loja',
        token: '{{config path="general/store_information/name"}}',
      },
      {
        id: 'store-phone',
        label: 'Numero de telefone da loja',
        token: '{{config path="general/store_information/phone"}}',
      },
      {
        id: 'store-hours',
        label: 'Horarios de funcionamento',
        token: '{{config path="general/store_information/hours"}}',
      },
      {
        id: 'store-country',
        label: 'Pais',
        token: '{{config path="general/store_information/country_id"}}',
      },
      {
        id: 'store-region',
        label: 'Regiao/estado',
        token: '{{config path="general/store_information/region_id"}}',
      },
      {
        id: 'store-postcode',
        label: 'Codigo Postal',
        token: '{{config path="general/store_information/postcode"}}',
      },
      {
        id: 'store-city',
        label: 'Cidade',
        token: '{{config path="general/store_information/city"}}',
      },
      {
        id: 'store-address-line1',
        label: 'Endereco',
        token: '{{config path="general/store_information/street_line1"}}',
      },
      {
        id: 'store-address-line2',
        label: 'Complemento',
        token: '{{config path="general/store_information/street_line2"}}',
      },
      {
        id: 'store-document',
        label: 'CPF/CNPJ',
        token: '{{config path="general/store_information/merchant_vat_number"}}',
      },
    ],
  },
]
