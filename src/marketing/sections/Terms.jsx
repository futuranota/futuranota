const LAST_UPDATED = '2 de julio de 2026';

export function Terms({ compact = false }) {
  return (
    <article className={`section legal-page${compact ? ' legal-page--compact' : ''}`} data-screen-label="terms">
      <div className="container legal-page__wrap">
        <header className="legal-page__head">
          <p className="mono-sm faint legal-page__eyebrow">Legal</p>
          <h1 className="display legal-page__title">Términos y Condiciones de Uso</h1>
          <p className="mono-sm faint legal-page__updated">
            Última actualización: {LAST_UPDATED}
          </p>
        </header>

        <div className="legal-page__body">
          <section className="legal-page__section">
            <h2>1. Aceptación de los términos</h2>
            <p>
              Al crear una cuenta o usar Futura Nota (&ldquo;la Plataforma&rdquo;, &ldquo;el Servicio&rdquo;),
              aceptas estos Términos y Condiciones en su totalidad. Si no estás de acuerdo, no debes usar el Servicio.
            </p>
          </section>

          <section className="legal-page__section">
            <h2>2. Descripción del servicio</h2>
            <p>
              Futura Nota es una plataforma de organización de notas, planificación de negocio e inteligencia de
              mercado que utiliza inteligencia artificial para ayudarte a estructurar ideas, analizar información y
              generar contenido de apoyo a tu proceso de emprendimiento.
            </p>
            <p>
              Futura Nota es una herramienta de apoyo. No sustituye asesoría profesional legal, financiera, contable
              o de inversión. Cualquier decisión de negocio basada en el contenido generado por la Plataforma es
              responsabilidad exclusiva del usuario.
            </p>
          </section>

          <section className="legal-page__section">
            <h2>3. Cuentas de usuario</h2>
            <ul>
              <li>Debes proporcionar información veraz al registrarte.</li>
              <li>
                Puedes crear tu cuenta mediante correo electrónico o mediante inicio de sesión con Google (OAuth).
                Al usar Google OAuth, autorizas a Futura Nota a recibir la información básica de perfil que Google
                comparte según tu configuración de privacidad.
              </li>
              <li>
                Eres responsable de mantener la confidencialidad de tus credenciales de acceso y de toda actividad
                realizada bajo tu cuenta.
              </li>
              <li>Debes tener al menos 18 años para usar el Servicio.</li>
            </ul>
          </section>

          <section className="legal-page__section">
            <h2>4. Planes, precios y facturación</h2>
            <ul>
              <li>
                Futura Nota ofrece un plan gratuito con funcionalidad limitada y uno o más planes de pago
                (&ldquo;Pro&rdquo; u otros) con funcionalidad ampliada.
              </li>
              <li>
                Los pagos se procesan a través de Stripe. Al proporcionar tu método de pago, aceptas también los
                términos de servicio de Stripe.
              </li>
              <li>
                Las suscripciones se renuevan automáticamente según el ciclo de facturación elegido (mensual/anual),
                salvo que canceles antes de la fecha de renovación.
              </li>
            </ul>
            <h3>4.1 Política de no reembolso</h3>
            <p>
              Todos los pagos realizados a Futura Nota son finales y no reembolsables, incluyendo pagos parciales de
              un período de facturación ya iniciado, salvo que la ley aplicable exija lo contrario. Puedes cancelar tu
              suscripción en cualquier momento para evitar cargos futuros, pero no se emitirán reembolsos por el
              período ya facturado.
            </p>
          </section>

          <section className="legal-page__section">
            <h2>5. Uso aceptable</h2>
            <p>No puedes usar Futura Nota para:</p>
            <ul>
              <li>Actividades ilegales o que infrinjan derechos de terceros.</li>
              <li>Intentar acceder sin autorización a sistemas o datos de otros usuarios.</li>
              <li>Realizar ingeniería inversa, scraping masivo o uso automatizado no autorizado de la Plataforma.</li>
              <li>Subir contenido difamatorio, malicioso o que viole propiedad intelectual ajena.</li>
            </ul>
          </section>

          <section className="legal-page__section">
            <h2>6. Propiedad intelectual y tus datos</h2>
            <ul>
              <li>
                Tú conservas la propiedad total de tu contenido: las notas, planes de negocio, datos e información
                que subas o generes en Futura Nota siguen siendo tuyos.
              </li>
              <li>
                Futura Nota no reclama derechos de propiedad sobre tu contenido. Únicamente procesamos tu información
                para prestarte el Servicio (incluyendo el procesamiento vía IA descrito en la Sección 8).
              </li>
              <li>
                El software, diseño, marca y tecnología de Futura Nota son propiedad exclusiva de Futura Nota y no
                pueden copiarse ni redistribuirse sin autorización.
              </li>
            </ul>
          </section>

          <section className="legal-page__section">
            <h2>7. Contenido generado por IA</h2>
            <p>
              Futura Nota utiliza modelos de inteligencia artificial para generar análisis, sugerencias y contenido de
              apoyo. Ten en cuenta que:
            </p>
            <ul>
              <li>El contenido generado por IA puede contener errores, imprecisiones o estar desactualizado.</li>
              <li>
                No debes tratar el contenido generado por IA como asesoría profesional definitiva (legal, financiera,
                de inversión, etc.).
              </li>
              <li>Eres responsable de verificar la información antes de actuar sobre ella.</li>
            </ul>
          </section>

          <section className="legal-page__section">
            <h2>8. Procesamiento de datos por terceros (Groq API)</h2>
            <p>
              Para generar ciertas funciones de IA, Futura Nota envía parte de tu información (inputs que ingresas en
              la Plataforma) a Groq, un proveedor externo de procesamiento de inteligencia artificial, con el único fin
              de generar las respuestas y análisis que ves en la Plataforma.
            </p>
            <ul>
              <li>
                Groq procesa esta información según sus propias políticas de privacidad y seguridad, disponibles en su
                sitio web.
              </li>
              <li>
                Futura Nota no controla ni es responsable de las políticas internas de retención de datos de Groq,
                aunque selecciona proveedores que ofrecen garantías razonables de manejo seguro de datos.
              </li>
              <li>No se envía a Groq más información de la necesaria para generar la respuesta solicitada.</li>
            </ul>
          </section>

          <section className="legal-page__section">
            <h2>9. Privacidad de tus datos</h2>
            <ul>
              <li>
                Futura Nota no vende ni comparte tu información personal o de negocio con terceros, salvo lo
                estrictamente necesario para operar el Servicio (procesamiento de pagos vía Stripe, procesamiento de IA
                vía Groq, autenticación vía Google, envío de correos vía Resend).
              </li>
              <li>
                Tus datos se almacenan de forma privada y no son accesibles por otros usuarios de la Plataforma.
              </li>
              <li>
                Para más detalle sobre qué datos se recolectan y cómo se usan, consulta nuestra Política de Privacidad.
              </li>
            </ul>
          </section>

          <section className="legal-page__section">
            <h2>10. Limitación de responsabilidad</h2>
            <p>
              En la máxima medida permitida por la ley, Futura Nota no será responsable por daños indirectos,
              incidentales o consecuentes derivados del uso del Servicio, incluyendo pero no limitado a pérdidas de
              negocio, datos o ganancias, incluso si se advirtió sobre la posibilidad de dichos daños.
            </p>
            <p>
              El Servicio se ofrece &ldquo;tal cual&rdquo; (&ldquo;as is&rdquo;), sin garantías de disponibilidad
              ininterrumpida o libre de errores.
            </p>
          </section>

          <section className="legal-page__section">
            <h2>11. Terminación de cuenta</h2>
            <p>
              Podemos suspender o terminar tu acceso al Servicio si incumples estos Términos. Puedes eliminar tu
              cuenta en cualquier momento desde la configuración de tu perfil. La terminación no genera derecho a
              reembolso (ver Sección 4.1).
            </p>
          </section>

          <section className="legal-page__section">
            <h2>12. Cambios a estos términos</h2>
            <p>
              Podemos actualizar estos Términos ocasionalmente. Notificaremos cambios importantes por correo
              electrónico o mediante un aviso en la Plataforma. El uso continuado del Servicio tras el cambio implica
              tu aceptación de los nuevos términos.
            </p>
          </section>

          <section className="legal-page__section">
            <h2>13. Ley aplicable</h2>
            <p>
              Estos Términos se rigen por las leyes del Estado de Florida, Estados Unidos, sin dar efecto a sus
              disposiciones sobre conflicto de leyes. Cualquier disputa se resolverá en los tribunales competentes de
              Florida.
            </p>
          </section>

          <section className="legal-page__section">
            <h2>14. Contacto</h2>
            <p>
              Para preguntas sobre estos Términos, escríbenos a{' '}
              <a href="mailto:contacto@futuranota.com" className="legal-page__link">
                contacto@futuranota.com
              </a>
              .
            </p>
            <p className="legal-page__note faint">
              Futura Nota se reserva el derecho de actualizar estos Términos conforme evoluciona el Servicio. Para
              dudas sobre cualquier cláusula, contáctanos directamente.
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
