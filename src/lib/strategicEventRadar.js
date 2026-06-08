/**
 * Strategic event radar — humanizes multiple calendar events in a ±15 / +45 day window.
 */
import { parseDate } from "./dates.js";
import { startOfCalendarDay } from "../temporal.js";

export const RADAR_PAST_DAYS = 15;
export const RADAR_FUTURE_DAYS = 45;

/**
 * Whole calendar days from selected date → event date (positive = future).
 * @param {Date|string|null|undefined} fechaEvento
 * @param {Date|string|null|undefined} fechaSeleccionada
 */
export function diferenciaEnDias(fechaEvento, fechaSeleccionada) {
  const eventDay = startOfCalendarDay(parseDate(fechaEvento));
  const selectedDay = startOfCalendarDay(parseDate(fechaSeleccionada));
  if (!eventDay || !selectedDay) return null;
  const ms = eventDay.getTime() - selectedDay.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/**
 * @param {Array<{ title?: string, nombre?: string, date?: string, fecha?: Date|string }>} events
 * @returns {Array<{ nombre: string, fecha: Date }>}
 */
export function normalizeEventsForRadar(events) {
  return (events ?? [])
    .map((evento) => {
      const fecha = parseDate(evento.fecha ?? evento.date);
      const nombre = evento.nombre || evento.title || "Evento";
      if (!fecha) return null;
      return { nombre, fecha };
    })
    .filter(Boolean);
}

/**
 * Humanize multiple events in a radar of up to 45 days forward (and 15 days back).
 * @param {Date|string|null|undefined} fechaSeleccionada
 * @param {Array<{ nombre?: string, title?: string, fecha?: Date|string, date?: string }>} eventosEnRango
 */
export function generarRadarEstrategico(fechaSeleccionada, eventosEnRango) {
  const normalized = normalizeEventsForRadar(eventosEnRango);

  if (!normalized.length) {
    return "Radar despejado. Tienes vía libre en esta ventana de tiempo.";
  }

  const zonas = {
    hoy: [],
    inminente: [],
    cercano: [],
    horizonte: [],
    pasado: [],
  };

  normalized.forEach((evento) => {
    const dias = diferenciaEnDias(evento.fecha, fechaSeleccionada);
    if (dias == null) return;

    if (dias === 0) zonas.hoy.push(evento.nombre);
    else if (dias > 0 && dias <= 7) zonas.inminente.push(`${evento.nombre} (en ${dias} días)`);
    else if (dias > 7 && dias <= 15) zonas.cercano.push(`${evento.nombre} (en ${dias} días)`);
    else if (dias > 15 && dias <= RADAR_FUTURE_DAYS) {
      zonas.horizonte.push(`${evento.nombre} (en ${dias} días)`);
    } else if (dias < 0 && dias >= -RADAR_PAST_DAYS) {
      zonas.pasado.push(`${evento.nombre} (hace ${Math.abs(dias)} días)`);
    }
  });

  const fragmentos = [];

  if (zonas.hoy.length > 0) {
    fragmentos.push(`¡Ojo! Hoy es ${zonas.hoy.join(" y ")}`);
  }
  if (zonas.inminente.length > 0) {
    fragmentos.push(`tienes ${zonas.inminente.join(", ")} respirándote en la nuca`);
  }
  if (zonas.cercano.length > 0) {
    fragmentos.push(`pronto llegará ${zonas.cercano.join(" y ")}`);
  }
  if (zonas.horizonte.length > 0) {
    fragmentos.push(`a mediano plazo prepárate para ${zonas.horizonte.join(", ")}`);
  }
  if (zonas.pasado.length > 0) {
    fragmentos.push(`acabamos de dejar atrás ${zonas.pasado.join(" y ")}`);
  }

  if (!fragmentos.length) {
    return "Radar despejado. Tienes vía libre en esta ventana de tiempo.";
  }

  let textoFinal = fragmentos.join("; además, ");
  textoFinal = textoFinal.charAt(0).toUpperCase() + textoFinal.slice(1);

  return `Radar de mercado: ${textoFinal}.`;
}
