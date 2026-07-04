import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
  Link,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  nombre?: string
  tipoFormacion?: string
  programa?: string
  modalidad?: string
}

const MODALIDAD_LABEL: Record<string, string> = {
  presencial: 'Presencial',
  online_vivo: 'Online en vivo',
  online_asincronico: 'Online asincrónico',
}

const Email = ({ nombre, tipoFormacion, programa, modalidad }: Props) => {
  const displayName = nombre?.split(' ')[0] || 'Hola'
  const tipoLabel = tipoFormacion === 'diplomado' ? 'Diplomado' : 'Curso'
  const modalidadLabel = modalidad ? MODALIDAD_LABEL[modalidad] || modalidad : null

  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>Hemos recibido tu solicitud en Academia Ceapsi RD</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>Academia Ceapsi RD</Heading>
          </Section>

          <Section style={content}>
            <Heading as="h2" style={h2}>
              ¡Gracias, {displayName}!
            </Heading>
            <Text style={paragraph}>
              Hemos recibido correctamente tu solicitud de información. Un asesor
              académico se pondrá en contacto contigo en menos de 24 horas hábiles
              para orientarte sobre el proceso de inscripción, fechas de inicio y
              formas de pago.
            </Text>

            {(programa || modalidadLabel) && (
              <Section style={detailsBox}>
                {programa && (
                  <Text style={detailRow}>
                    <strong style={label}>{tipoLabel}:</strong> {programa}
                  </Text>
                )}
                {modalidadLabel && (
                  <Text style={detailRow}>
                    <strong style={label}>Modalidad de interés:</strong> {modalidadLabel}
                  </Text>
                )}
              </Section>
            )}

            <Text style={paragraph}>
              Si tienes alguna consulta urgente, puedes escribirnos a{' '}
              <Link href="mailto:info@academiaceapsi.com" style={link}>
                info@academiaceapsi.com
              </Link>{' '}
              o visitarnos en{' '}
              <Link href="https://academiaceapsi.com" style={link}>
                academiaceapsi.com
              </Link>
              .
            </Text>

            <Hr style={hr} />
            <Text style={footer}>
              Academia Ceapsi RD · Formación en psicología, educación y ciencias del comportamiento.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: 'Hemos recibido tu solicitud — Academia Ceapsi RD',
  displayName: 'Confirmación de solicitud de curso/diplomado',
  previewData: {
    nombre: 'María García',
    tipoFormacion: 'diplomado',
    programa: 'Diplomado en Terapia del Lenguaje',
    modalidad: 'online_vivo',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  color: '#0f172a',
  margin: 0,
  padding: 0,
}
const container: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '24px',
}
const header: React.CSSProperties = {
  padding: '20px 24px',
  backgroundColor: '#0f172a',
  borderRadius: '10px 10px 0 0',
}
const h1: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '20px',
  margin: 0,
  fontWeight: 700,
  letterSpacing: '-0.01em',
}
const content: React.CSSProperties = {
  padding: '28px 24px',
  border: '1px solid #e2e8f0',
  borderTop: 'none',
  borderRadius: '0 0 10px 10px',
}
const h2: React.CSSProperties = {
  fontSize: '22px',
  margin: '0 0 12px',
  color: '#0f172a',
}
const paragraph: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '24px',
  color: '#334155',
  margin: '12px 0',
}
const detailsBox: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '14px 16px',
  margin: '16px 0',
}
const detailRow: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#0f172a',
  margin: '4px 0',
}
const label: React.CSSProperties = { color: '#475569' }
const link: React.CSSProperties = { color: '#2563eb', textDecoration: 'underline' }
const hr: React.CSSProperties = { borderColor: '#e2e8f0', margin: '24px 0 12px' }
const footer: React.CSSProperties = {
  fontSize: '12px',
  color: '#94a3b8',
  textAlign: 'center' as const,
}
