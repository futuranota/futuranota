/** @typedef {{ text: string, name: string, role: string }} Testimonial */

/** @type {Testimonial[]} */
export const TESTIMONIALS_DEFAULT = [
  {
    text: 'Antes tenía mi idea de negocio en como 5 apps distintas — notas, hojas de cálculo, screenshots. Futura Nota me organizó todo en un solo lugar y por fin pude ver el plan completo, no pedazos sueltos.',
    name: 'Camila R.',
    role: 'Fundadora de una marca de accesorios',
  },
  {
    text: 'The campaign status dashboard is what sold me. I used to have no idea if my launch efforts were actually working until weeks later. Now I see it in real time and adjust before it\'s too late.',
    name: 'Daniel M.',
    role: 'Early-stage founder',
  },
  {
    text: 'Llevaba meses con una idea guardada \'para después\'. Futura Nota me mostró que el mercado ya estaba listo para eso — ese fue el empujón que necesitaba para dejar de posponerlo y empezar.',
    name: 'Valentina G.',
    role: 'Emprendedora de servicios digitales',
  },
  {
    text: 'I almost built a product nobody was searching for. Futura Nota\'s market intelligence flagged that the trend was already fading before I wrote a single line of code. That alone saved me months.',
    name: 'Priya S.',
    role: 'Solopreneur',
  },
  {
    text: 'El organizador de archivos parece algo pequeño hasta que lo usas — dejé de perder tiempo buscando la última versión de mi plan de negocio. Todo está donde debe estar.',
    name: 'Andrés F.',
    role: 'Dueño de un taller de diseño',
  },
  {
    text: 'What I didn\'t expect was how much it pushed me to actually start. Seeing the data laid out made \'someday I\'ll launch my business\' turn into \'I\'m launching this month.\'',
    name: 'Jordan K.',
    role: 'Creator turned founder',
  },
  {
    text: 'No es solo una herramienta de organización, es la que finalmente me dio la confianza para emprender. Ver el mercado, la competencia y mi propio plan en un solo lugar quitó el miedo de lanzarme.',
    name: 'Mariana T.',
    role: 'Fundadora primeriza',
  },
];

/** Split testimonials into N roughly even columns. */
export function splitTestimonials(columns, items = TESTIMONIALS_DEFAULT) {
  const cols = Array.from({ length: columns }, () => /** @type {Testimonial[]} */ ([]));
  items.forEach((item, i) => {
    cols[i % columns].push(item);
  });
  return cols;
}

export function initialsFromName(name) {
  return name
    .replace(/\./g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}
