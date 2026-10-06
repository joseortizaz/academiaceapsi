import React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { textoAviso, type DatosAvisoMora, type TipoAvisoMora } from '../mora-textos'

interface Props extends Partial<DatosAvisoMora> {
  tipo?: TipoAvisoMora
  enlace?: string
}

const datos = (p: Props): DatosAvisoMora => ({
  nombre: p.nombre ?? '',
  monto: Number(p.monto ?? 0),
  vencimiento: p.vencimiento ?? '2026-01-30',
  saldoVencido: p.saldoVencido,
  contacto: p.contacto ?? 'admin@ceapsird.com',
  proxima: p.proxima ?? null,
})

const Email = (props: Props) => {
  const tipo = props.tipo ?? 'previo'
  const t = textoAviso(tipo, datos(props))
  const nombre = props.nombre?.split(' ')[0] || ''
  const grave = tipo === 'aviso3' || tipo === 'aviso4'

  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>{t.corto}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>Academia Ceapsi RD</Heading>
          </Section>
          <Section style={content}>
            <Heading as="h2" style={{ ...h2, color: grave ? '#b91c1c' : '#0f172a' }}>
              {t.asunto}
            </Heading>
            <Text style={paragraph}>{nombre ? `Hola, ${nombre}.` : 'Hola.'}</Text>
            {t.parrafos.map((p, i) => (
              <Text key={i} style={paragraph}>
                {p}
              </Text>
            ))}
            {props.enlace && (
              <Section style={{ margin: '24px 0 8px' }}>
                <Button href={props.enlace} style={button}>
                  Ver mi estado de cuenta
                </Button>
              </Section>
            )}
            <Hr style={hr} />
            <Text style={footer}>Academia Ceapsi RD · Centro de Aprendizaje y Cambio Ceapsi, SRL</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => textoAviso((data.tipo ?? 'previo') as TipoAvisoMora, datos(data as Props)).asunto,
  displayName: 'Aviso de pago / mora',
  previewData: {
    tipo: 'aviso3',
    nombre: 'María García',
    monto: 2000,
    vencimiento: '2026-11-30',
    saldoVencido: 2000,
    contacto: 'admin@ceapsird.com',
    proxima: { monto: 2000, vencimiento: '2026-12-30' },
    enlace: 'https://academiaceapsi.com/estudiante/facturacion',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  color: '#0f172a',
  margin: 0,
  padding: 0,
}
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto', padding: '24px' }
const header: React.CSSProperties = { padding: '20px 24px', backgroundColor: '#0f172a', borderRadius: '10px 10px 0 0' }
const h1: React.CSSProperties = { color: '#ffffff', fontSize: '20px', margin: 0, fontWeight: 700, letterSpacing: '-0.01em' }
const content: React.CSSProperties = {
  padding: '28px 24px',
  border: '1px solid #e2e8f0',
  borderTop: 'none',
  borderRadius: '0 0 10px 10px',
}
const h2: React.CSSProperties = { fontSize: '20px', margin: '0 0 12px' }
const paragraph: React.CSSProperties = { fontSize: '15px', lineHeight: '24px', color: '#334155', margin: '12px 0' }
const button: React.CSSProperties = {
  backgroundColor: '#0f172a',
  color: '#ffffff',
  padding: '12px 20px',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
}
const hr: React.CSSProperties = { borderColor: '#e2e8f0', margin: '24px 0 12px' }
const footer: React.CSSProperties = { fontSize: '12px', color: '#94a3b8', textAlign: 'center' as const }
