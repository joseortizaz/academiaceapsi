import * as React from 'react'
import { render } from 'react-email'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'Academia Ceapsi RD'
const SENDER_DOMAIN = 'notify.academiaceapsi.com'
const FROM_DOMAIN = 'academiaceapsi.com'
const TEMPLATE_NAME = 'course-request-confirmation'

const schema = z.object({
  nombre_completo: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(160),
  codigo_pais: z.string().min(1).max(10),
  telefono: z
    .string()
    .trim()
    .min(7)
    .max(20)
    .regex(/^[0-9()+\-\s]+$/),
  tipo_documento: z.enum(['cedula', 'pasaporte']),
  numero_documento: z
    .string()
    .trim()
    .min(5)
    .max(30)
    .regex(/^[A-Za-z0-9-]+$/),
  nivel_estudios: z.string().min(1).max(80),
  provincia: z.string().min(1).max(80),
  tipo_formacion: z.enum(['curso', 'diplomado']),
  programa: z.string().min(1).max(200),
  modalidad: z.enum(['presencial', 'online_vivo', 'online_asincronico']),
})

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export const Route = createFileRoute('/api/public/course-request')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !supabaseServiceKey) {
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        let body: unknown
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400 })
        }

        const parsed = schema.safeParse(body)
        if (!parsed.success) {
          return Response.json(
            { error: 'Validation failed', issues: parsed.error.issues },
            { status: 400 },
          )
        }
        const data = parsed.data
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // 1. Insert course request
        const { error: insertError } = await supabase
          .from('course_requests')
          .insert(data)
        if (insertError) {
          console.error('Failed to insert course_request', insertError)
          return Response.json({ error: 'Failed to save request' }, { status: 500 })
        }

        // 2. Try to send confirmation email — but do NOT fail the whole request
        // if email delivery has an issue; the record is already saved.
        try {
          const recipient = data.email.toLowerCase()

          // Suppression check
          const { data: suppressed } = await supabase
            .from('suppressed_emails')
            .select('id')
            .eq('email', recipient)
            .maybeSingle()

          if (suppressed) {
            return Response.json({ success: true, emailSent: false, reason: 'suppressed' })
          }

          // Unsubscribe token (reuse or create)
          let unsubscribeToken: string
          const { data: existingToken } = await supabase
            .from('email_unsubscribe_tokens')
            .select('token, used_at')
            .eq('email', recipient)
            .maybeSingle()

          if (existingToken && !existingToken.used_at) {
            unsubscribeToken = existingToken.token
          } else if (!existingToken) {
            unsubscribeToken = generateToken()
            await supabase
              .from('email_unsubscribe_tokens')
              .upsert(
                { token: unsubscribeToken, email: recipient },
                { onConflict: 'email', ignoreDuplicates: true },
              )
            const { data: stored } = await supabase
              .from('email_unsubscribe_tokens')
              .select('token')
              .eq('email', recipient)
              .maybeSingle()
            if (stored) unsubscribeToken = stored.token
          } else {
            return Response.json({ success: true, emailSent: false, reason: 'suppressed' })
          }

          const template = TEMPLATES[TEMPLATE_NAME]
          if (!template) throw new Error('Template not registered')

          const templateData = {
            nombre: data.nombre_completo,
            tipoFormacion: data.tipo_formacion,
            programa: data.programa,
            modalidad: data.modalidad,
          }
          const element = React.createElement(template.component, templateData)
          const html = await render(element)
          const plainText = await render(element, { plainText: true })
          const subject =
            typeof template.subject === 'function'
              ? template.subject(templateData)
              : template.subject

          const messageId = crypto.randomUUID()

          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: TEMPLATE_NAME,
            recipient_email: recipient,
            status: 'pending',
          })

          const { error: enqueueError } = await supabase.rpc('enqueue_email', {
            queue_name: 'transactional_emails',
            payload: {
              message_id: messageId,
              to: recipient,
              from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
              sender_domain: SENDER_DOMAIN,
              subject,
              html,
              text: plainText,
              purpose: 'transactional',
              label: TEMPLATE_NAME,
              idempotency_key: `course-request-${messageId}`,
              unsubscribe_token: unsubscribeToken,
              queued_at: new Date().toISOString(),
            },
          })

          if (enqueueError) {
            console.error('Failed to enqueue confirmation email', enqueueError)
            await supabase.from('email_send_log').insert({
              message_id: messageId,
              template_name: TEMPLATE_NAME,
              recipient_email: recipient,
              status: 'failed',
              error_message: 'Failed to enqueue email',
            })
            return Response.json({ success: true, emailSent: false })
          }

          return Response.json({ success: true, emailSent: true })
        } catch (err) {
          console.error('Confirmation email error (request still saved)', err)
          return Response.json({ success: true, emailSent: false })
        }
      },
    },
  },
})
