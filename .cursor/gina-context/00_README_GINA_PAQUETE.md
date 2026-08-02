# PAQUETE GINA PARA CURSOR - Guía de Lectura

**Qué:** Todo lo que Cursor necesita para implementar Gina  
**Cómo usar:** Lee en el orden numerado (01, 02, 03, 04)  
**Resultado:** Cursor entiende completamente a Gina antes de programar

---

## 📋 ARCHIVOS EN ORDEN DE LECTURA

### **01. ESTRUCTURA_WEBAPP.md** (Lee PRIMERO)
```
QUÉ: Mapa organizacional de Futura Nota
POR QUÉ: Gina debe entender la jerarquía
         Empresa → Depto → Categoría → Folder → Document

IMPORTANTE: 
- NO confundir Folder con Document
- NO confundir Categoría con Departamento
- Entiende la jerarquía completa o Gina dirá tonterías
```

**Tiempo:** 10 minutos

---

### **02. SCHEDULE_AND_STATUS.md** (Lee SEGUNDO)
```
QUÉ: Cómo funcionan schedules y status en Futura Nota
POR QUÉ: Gina calcula qué está vencido, qué es hoy

IMPORTANTE:
- User puede cambiar status manualmente
- Pero la FECHA dice si está vencido
- Past due = status != completed AND fecha < hoy
- Gina detecta contradicciones
```

**Tiempo:** 10 minutos

---

### **03. GINA_TOOLS_LISTENING_SCOPE.md** (Lee TERCERO)
```
QUÉ: Los 12 tools que Gina usará + cuándo llamarlos
POR QUÉ: Cursor sabe exactamente qué implementar

IMPORTANTE:
- Family de query → tools correctos
- "Qué tengo hoy?" → get_today_scope()
- "Qué no completé?" → get_incomplete_documents()
- "Hay conflictos?" → get_schedule_conflicts()
- NO llamar todos los 12 tools en cada request
```

**Tiempo:** 15 minutos

---

### **04. SKILL_gina-assistant-futura-nota.md** (Lee CUARTO)
```
QUÉ: La identidad, reglas y comportamiento de Gina
POR QUÉ: Cursor lo pone en el system prompt de Groq

IMPORTANTE:
- Este es el "cerebro" de Gina
- Incluye: quién es, qué puede, voz/tono, reglas, edge cases
- SIN esto, Groq responde genérico (ChatGPT)
- CON esto, Groq suena como Gina
```

**Tiempo:** 20 minutos

---

### **05. VISUAL_HIERARCHY_NAVIGATION.md** (Lee con el skill / referencia visual)
```
QUÉ: Cómo se ve Corpus → Depto → Categoría → Folder en el sidebar
POR QUÉ: Gina debe narrar la ruta completa, no solo el folder

IMPORTANTE:
- Regla de oro: Departamento / Categoría / Folder
- NUNCA "solo Trends" si hay jerarquía
- Mismo nombre de folder en dos rutas → preguntar cuál
- Tools deben devolver category + department + folder + document
```

**Tiempo:** 8 minutos

---

### **06. TIME_SCOPE_AND_LIVE_CORPUS.md** (Tiempo + corpus vivo)
```
QUÉ: Semántica hoy/mañana/hasta/dentro de N + LIVE CORPUS ONLY
POR QUÉ: Evitar deptos fantasma y "calendario"; grounding en inventory

IMPORTANTE:
- Solo nombres del WORKSPACE INVENTORY
- hoy = resto del día; para mañana ≠ hasta mañana
- status ≠ completed en scope de hoy
```

**Tiempo:** 8 minutos

---

### **06. TIME_SCOPE_AND_LIVE_CORPUS.md** (Canon tiempo + corpus vivo)
```
QUÉ: Semántica hoy/mañana/hasta/dentro de N + LIVE CORPUS ONLY
POR QUÉ: Evitar departamentos fantasma y "calendario" inventado

IMPORTANTE:
- Solo nombres del inventario real
- Qué hay para hoy = status ≠ completed + scope de hoy
- para mañana ≠ hasta mañana ≠ dentro de N días
```

**Tiempo:** 8 minutos

---

## 🎯 ORDEN CORRECTO

```
START
  ↓
01_ESTRUCTURA_WEBAPP.md
  (Gina entiende la casa)
  ↓
02_SCHEDULE_AND_STATUS.md
  (Gina entiende el tiempo)
  ↓
03_GINA_TOOLS_LISTENING_SCOPE.md
  (Gina sabe qué herramientas)
  ↓
04_SKILL_gina-assistant-futura-nota.md
  (Gina sabe cómo actuar)
  ↓
05_VISUAL_HIERARCHY_NAVIGATION.md
  (Gina narra como se ve el sidebar)
  ↓
06_TIME_SCOPE_AND_LIVE_CORPUS.md
  (tiempo hoy/mañana + solo corpus vivo)
  ↓
07_AWARENESS_LEARN_CURSOR_TOOLS.md
  (LEARN vs CURSOR vs TOOLS)
  ↓
LISTO → Implementar plan en Cursor
```

---

## ✅ CHECKLIST PARA CURSOR

Cuando Cursor termine de leer, debe poder responder esto:

- [ ] ¿Cuál es la jerarquía completa? (empresa → depto → categoría → folder → document)
- [ ] ¿Qué es un Corpus? ¿Un Brand?
- [ ] ¿Cómo se calcula si algo está vencido?
- [ ] ¿Cuándo se crea `not_started` automáticamente?
- [ ] ¿Qué es `in_progress` y cuándo ocurre?
- [ ] ¿Cuáles son los 12 tools?
- [ ] ¿"Qué tengo hoy" → qué tool?
- [ ] ¿"Qué no completé" → qué tool?
- [ ] ¿Quién es Gina?
- [ ] ¿Qué NUNCA debe hacer Gina?
- [ ] ¿Cómo suena Gina (voz/tono)?
- [ ] ¿Edge cases principales?
- [ ] ¿Cómo narrar Depto / Categoría / Folder (nunca solo el folder)?
- [ ] ¿Qué hace Gina si hay dos folders llamados "Trends"?

Si Cursor puede responder todo, está listo.

---

## 🚀 IMPLEMENTACIÓN (DESPUÉS de leer)

Una vez que Cursor entienda a Gina, implementa en este orden:

1. **UI Assistance** - Botón en LeftPanel
2. **GinaChatOverlay** - Dashboard flotante
3. **Tools 1-12** - Funciones de lectura (ginaTools.js)
4. **API Gina Chat** - Groq handler (usa system prompt del SKILL)
5. **Wire todo** - Conectar UI + Tools + API
6. **Focus → open** - Abrir documents desde Gina

---

## ⚠️ SI FALTAN DOCUMENTOS

| Documento | Si NO lo lees | Pasa esto |
|---|---|---|
| 01_ESTRUCTURA | Confundes folder con document | ❌ Gina dice cosas raras |
| 02_SCHEDULE_AND_STATUS | No detectas vencidos | ❌ No sabe qué está atrasado |
| 03_GINA_TOOLS | No sabes qué tools usar | ❌ Implementas los 12 o ninguno |
| 04_SKILL | Groq sin contexto | ❌ Responde genérico (ChatGPT) |

**No saltear documentos.**

---

## 📝 NOTAS

- Todos los archivos están listos en `/mnt/user-data/outputs/`
- Puedes adjuntarlos directamente a Cursor
- O copiarlos a una carpeta `/.cursor/gina-context/` en el repo
- El orden 01, 02, 03, 04 es OBLIGATORIO

---

## 🎁 QUÉ INCLUYE ESTE PAQUETE

✅ Estructura de la webapp (cómo está organizado todo)
✅ Modelo de datos (schedules, status, ciclos)
✅ 12 tools con mapeo (family → tools)
✅ Identidad de Gina (quién es, cómo actúa)
✅ Reglas claras (qué SÍ y qué NO)
✅ Patrones de respuesta (cómo suena)
✅ Edge cases (qué pasa en situaciones raras)
✅ Este README (guía de lectura)

---

**Listo para pasarle a Cursor. Total: ~45 minutos de lectura.**

**Resultado: Cursor implementa Gina Fase 1 con identidad clara, no genérico.**
