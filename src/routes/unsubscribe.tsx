import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { PublicLayout } from '@/components/site/PublicLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Loader2, MailX } from 'lucide-react'

type State =
  | { status: 'loading' }
  | { status: 'valid' }
  | { status: 'already' }
  | { status: 'invalid' }
  | { status: 'success' }
  | { status: 'error'; message: string }

export const Route = createFileRoute('/unsubscribe')({
  head: () => ({
    meta: [
      { title: 'Cancelar suscripción — Academia Ceapsi RD' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: UnsubscribePage,
})

function UnsubscribePage() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [submitting, setSubmitting] = useState(false)
  const token =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('token')
      : null

  useEffect(() => {
    if (!token) {
      setState({ status: 'invalid' })
      return
    }
    ;(async () => {
      try {
        const res = await fetch(
          `/email/unsubscribe?token=${encodeURIComponent(token)}`,
        )
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          setState({ status: 'invalid' })
          return
        }
        if (json.valid) setState({ status: 'valid' })
        else if (json.reason === 'already_unsubscribed')
          setState({ status: 'already' })
        else setState({ status: 'invalid' })
      } catch (err) {
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Error de red',
        })
      }
    })()
  }, [token])

  const confirm = async () => {
    if (!token) return
    setSubmitting(true)
    try {
      const res = await fetch('/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && (json.success || json.reason === 'already_unsubscribed')) {
        setState({ status: 'success' })
      } else {
        setState({
          status: 'error',
          message: json?.error || 'No pudimos procesar la cancelación.',
        })
      }
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Error de red',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PublicLayout>
      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-lg">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
              {state.status === 'loading' && (
                <>
                  <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                  <p className="text-muted-foreground">Verificando enlace…</p>
                </>
              )}

              {state.status === 'valid' && (
                <>
                  <MailX className="h-12 w-12 text-primary" />
                  <h1 className="text-2xl font-bold">Cancelar suscripción</h1>
                  <p className="text-muted-foreground">
                    ¿Deseas dejar de recibir correos de Academia Ceapsi RD?
                  </p>
                  <Button onClick={confirm} disabled={submitting} className="mt-2">
                    {submitting ? 'Procesando…' : 'Confirmar cancelación'}
                  </Button>
                </>
              )}

              {state.status === 'already' && (
                <>
                  <CheckCircle2 className="h-12 w-12 text-primary" />
                  <h1 className="text-2xl font-bold">Ya estabas dado de baja</h1>
                  <p className="text-muted-foreground">
                    Este correo ya no está suscrito a nuestras comunicaciones.
                  </p>
                </>
              )}

              {state.status === 'success' && (
                <>
                  <CheckCircle2 className="h-12 w-12 text-primary" />
                  <h1 className="text-2xl font-bold">Suscripción cancelada</h1>
                  <p className="text-muted-foreground">
                    No recibirás más correos de esta dirección.
                  </p>
                </>
              )}

              {state.status === 'invalid' && (
                <>
                  <XCircle className="h-12 w-12 text-destructive" />
                  <h1 className="text-2xl font-bold">Enlace no válido</h1>
                  <p className="text-muted-foreground">
                    El enlace ha caducado o no es válido. Si sigues recibiendo correos que no deseas, escríbenos a{' '}
                    <a
                      className="text-primary underline"
                      href="mailto:info@academiaceapsi.com"
                    >
                      info@academiaceapsi.com
                    </a>
                    .
                  </p>
                </>
              )}

              {state.status === 'error' && (
                <>
                  <XCircle className="h-12 w-12 text-destructive" />
                  <h1 className="text-2xl font-bold">Ocurrió un error</h1>
                  <p className="text-muted-foreground">{state.message}</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </PublicLayout>
  )
}
