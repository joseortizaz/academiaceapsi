import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout, PageHeader } from "@/components/site/PublicLayout";
import {
  LEGAL_ADDRESS,
  LEGAL_ENTITY_NAME,
  PRIVACY_EMAIL,
  PRIVACY_LAST_UPDATED,
  PRIVACY_PHONE,
  SITE_URL,
} from "@/lib/site";

const sections = [
  ["responsable", "Responsable del tratamiento"],
  ["datos", "Datos que recopilamos"],
  ["finalidades", "Finalidades"],
  ["base-legal", "Base legal y consentimiento"],
  ["compartimos", "Con quién compartimos los datos"],
  ["transferencias", "Transferencias internacionales"],
  ["conservacion", "Conservación y bloqueo"],
  ["seguridad", "Seguridad y secreto"],
  ["derechos", "Sus derechos"],
  ["menores", "Menores de edad"],
  ["cookies", "Cookies y tecnologías similares"],
  ["cambios", "Cambios a este aviso"],
] as const;

export const Route = createFileRoute("/privacidad")({
  head: () => ({
    meta: [
      { title: "Aviso de Privacidad | Academia Ceapsi RD" },
      {
        name: "description",
        content: "Conoce cómo Academia Ceapsi RD recopila, utiliza, protege y conserva tus datos personales conforme a la Ley 172-13 de la República Dominicana.",
      },
      { property: "og:title", content: "Aviso de Privacidad | Academia Ceapsi RD" },
      {
        property: "og:description",
        content: "Información sobre el tratamiento y la protección de datos personales en Academia Ceapsi RD.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/privacidad` },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/privacidad` }],
  }),
  component: Privacidad,
});

function Privacidad() {
  return (
    <PublicLayout>
      <PageHeader
        eyebrow="Ley 172-13 · República Dominicana"
        title="Aviso de Privacidad"
        subtitle="Cómo recopilamos, utilizamos, protegemos y conservamos sus datos personales."
      />

      <div className="container mx-auto grid max-w-6xl gap-10 px-4 py-10 md:grid-cols-[15rem_minmax(0,1fr)] md:py-16">
        <aside className="md:sticky md:top-24 md:self-start">
          <nav aria-label="Índice del aviso" className="rounded-lg border border-border bg-card p-5">
            <p className="mb-3 text-sm font-semibold text-foreground">Contenido</p>
            <ol className="space-y-2 text-sm text-muted-foreground">
              {sections.map(([id, title], index) => (
                <li key={id}>
                  <a href={`#${id}`} className="transition-colors hover:text-primary">
                    {index + 1}. {title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="min-w-0 space-y-10 text-base leading-7 text-muted-foreground">
          <p>
            Este Aviso de Privacidad explica el tratamiento de datos personales realizado por {LEGAL_ENTITY_NAME} conforme a la Ley núm. 172-13 sobre Protección Integral de los Datos Personales de la República Dominicana.
          </p>

          <LegalSection id="responsable" number="1" title="Responsable del tratamiento">
            <p>El responsable del tratamiento es <strong>{LEGAL_ENTITY_NAME}</strong>.</p>
            <ul>
              <li><strong>Domicilio:</strong> {LEGAL_ADDRESS}.</li>
              <li><strong>Correo:</strong> <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.</li>
              <li><strong>Teléfono:</strong> <a href="tel:+18097845106">{PRIVACY_PHONE}</a>.</li>
            </ul>
            <p>Estos son nuestros medios de contacto para los fines del artículo 5.3 de la Ley 172-13.</p>
          </LegalSection>

          <LegalSection id="datos" number="2" title="Datos que recopilamos">
            <p>Según la forma en que utilice el portal, podemos recopilar:</p>
            <ul>
              <li><strong>Registro y cuenta:</strong> nombre, apellido, correo, teléfono, contraseña cifrada e inicio de sesión con Google, si se utiliza.</li>
              <li><strong>Perfil:</strong> foto, país, ciudad, biografía, especialidad y LinkedIn; en el caso de docentes, información profesional adicional.</li>
              <li><strong>Inscripción:</strong> nombre completo, documento de identidad, correo y teléfono de contacto y área profesional.</li>
              <li><strong>Solicitudes de curso:</strong> nombre, correo, teléfono, tipo y número de documento, nivel de estudios, provincia y programa de interés.</li>
              <li><strong>Formulario de contacto:</strong> datos de contacto, asunto y contenido del mensaje.</li>
              <li><strong>Pagos:</strong> comprobante de pago cargado.</li>
              <li><strong>Actividad académica:</strong> avance, evaluaciones y entregas, calificaciones y certificados.</li>
              <li><strong>Contenido publicado:</strong> reseñas y comentarios.</li>
              <li><strong>Clases virtuales:</strong> grabaciones y participación en sesiones de Zoom cuando la sesión se graba.</li>
              <li><strong>Auditoría y seguridad:</strong> fecha y hora, dirección IP, tipo de dispositivo y navegador, inicios de sesión y acciones realizadas en el portal.</li>
            </ul>
            <p><strong>No solicitamos datos sensibles</strong> como información de salud, religión, orientación sexual, afiliación política u otros datos de naturaleza similar. Le pedimos no incluirlos en campos de texto libre.</p>
          </LegalSection>

          <LegalSection id="finalidades" number="3" title="Finalidades">
            <p>Tratamos sus datos para:</p>
            <ul>
              <li>Crear y administrar su cuenta.</li>
              <li>Gestionar inscripciones, pagos, evaluaciones y certificación.</li>
              <li>Verificar la autenticidad de certificados.</li>
              <li>Enviar comunicaciones operativas y académicas por correo electrónico o WhatsApp.</li>
              <li>Responder solicitudes y mensajes.</li>
              <li>Publicar reseñas moderadas y perfiles de docentes.</li>
              <li>Proteger el portal, prevenir fraude y mantener trazabilidad mediante auditoría.</li>
              <li>Mejorar el servicio y cumplir obligaciones legales, contables y contractuales.</li>
            </ul>
            <p>No vendemos datos personales ni los usamos con fines distintos a los indicados sin obtener un nuevo consentimiento, conforme al artículo 5.8.</p>
          </LegalSection>

          <LegalSection id="base-legal" number="4" title="Base legal y consentimiento">
            <p>El tratamiento se basa en el consentimiento libre, expreso y consciente otorgado al registrarse o enviar formularios, conforme al artículo 5.4, y en la relación contractual o académica necesaria para prestar el servicio, conforme al artículo 27.4.</p>
            <p>Puede revocar su consentimiento en cualquier momento. La revocación no tiene efectos retroactivos sobre tratamientos realizados legítimamente antes de recibirla.</p>
          </LegalSection>

          <LegalSection id="compartimos" number="5" title="Con quién compartimos y encargados del tratamiento">
            <p>Podemos utilizar proveedores que tratan datos por nuestra cuenta: infraestructura y base de datos (Lovable Cloud / Supabase), videoconferencias (Zoom), contabilidad y facturación (Balance Activo), inicio de sesión con Google, servicios de mensajería y correo, y el servicio de inteligencia artificial utilizado por docentes y administradores para generar contenido educativo. <strong>No se envían datos de estudiantes al servicio de inteligencia artificial.</strong></p>
            <p>Son públicos el nombre y perfil profesional de los docentes, así como las reseñas aprobadas, que muestran el nombre visible del estudiante. También podemos comunicar datos a las autoridades cuando la ley lo exija.</p>
            <p>Los proveedores solo tratan los datos por cuenta nuestra y bajo deber de confidencialidad.</p>
          </LegalSection>

          <LegalSection id="transferencias" number="6" title="Transferencias internacionales">
            <p>Algunos proveedores pueden almacenar o procesar datos fuera de la República Dominicana. Al aceptar este aviso, usted autoriza estas transferencias internacionales, necesarias para prestar el servicio, bajo medidas de seguridad adecuadas, conforme al artículo 80.</p>
          </LegalSection>

          <LegalSection id="conservacion" number="7" title="Conservación y bloqueo">
            <p>Conservamos los datos de cuenta y académicos mientras la cuenta permanezca activa y durante el plazo legal o contractual necesario. Los certificados y registros académicos y contables pueden conservarse por su valor probatorio y por obligaciones legales.</p>
            <ul>
              <li>Los registros de auditoría de cambios y acciones administrativas se conservan durante 24 meses.</li>
              <li>Los registros de acceso y actividad de aprendizaje se conservan durante 12 meses.</li>
            </ul>
            <p>Después se eliminan o anonimizan. La supresión no procede cuando existe una obligación legal o contractual de conservación; en ese caso, los datos se bloquean, conforme a los artículos 8 y 15.</p>
          </LegalSection>

          <LegalSection id="seguridad" number="8" title="Seguridad y secreto">
            <p>Aplicamos medidas técnicas y organizativas, entre ellas cifrado en tránsito, contraseñas cifradas, control de acceso por roles y políticas de seguridad a nivel de fila, archivos privados en almacenamiento restringido y auditoría de acciones.</p>
            <p>El personal con acceso está sujeto a deber de confidencialidad. Cuando corresponda, informaremos a las personas afectadas sobre incidentes de seguridad, de acuerdo con los artículos 5.5 y 5.6.</p>
          </LegalSection>

          <LegalSection id="derechos" number="9" title="Sus derechos">
            <p>Puede ejercer gratuitamente sus derechos de acceso —con respuesta en 5 días hábiles—, rectificación, actualización y supresión —en 10 días hábiles y, cuando corresponda, notificación al cesionario en 5 días hábiles—, oposición y revocación del consentimiento, conforme a los artículos 8, 9 y 10. Los sucesores pueden ejercer estos derechos respecto de personas fallecidas.</p>
            <p>Para ejercerlos, escriba a <a href={`mailto:${PRIVACY_EMAIL}?subject=Derechos%20sobre%20datos%20personales`}>{PRIVACY_EMAIL}</a> con el asunto <strong>“Derechos sobre datos personales”</strong>, identifíquese y describa claramente su solicitud. Los usuarios también pueden editar la información disponible desde su perfil en el portal.</p>
            <p>Si su solicitud no es atendida, puede acudir a la acción de hábeas data ante el juez competente, conforme a los artículos 17 al 21.</p>
          </LegalSection>

          <LegalSection id="menores" number="10" title="Menores de edad">
            <p>Nuestros servicios están dirigidos a personas mayores de 18 años. Si detectamos datos de un menor sin autorización de su representante legal, los eliminaremos, conforme al artículo 79.</p>
          </LegalSection>

          <LegalSection id="cookies" number="11" title="Cookies y tecnologías similares">
            <p>Solo utilizamos almacenamiento técnico necesario para mantener la sesión iniciada. No utilizamos cookies publicitarias ni tecnologías de seguimiento de terceros.</p>
          </LegalSection>

          <LegalSection id="cambios" number="12" title="Cambios a este aviso">
            <p>Publicaremos cualquier nueva versión en esta página con su fecha de actualización. Si el cambio es sustancial, lo notificaremos a través del portal o por correo electrónico.</p>
          </LegalSection>

          <p className="border-t border-border pt-6 text-sm font-semibold text-foreground">
            Fecha de última actualización: {PRIVACY_LAST_UPDATED}.
          </p>
        </article>
      </div>
    </PublicLayout>
  );
}

function LegalSection({ id, number, title, children }: { id: string; number: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4 [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
      <h2 className="text-2xl font-bold text-foreground">{number}. {title}</h2>
      {children}
    </section>
  );
}