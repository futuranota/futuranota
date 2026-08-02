GINA TOOLS - FASE 1: ESCUCHAR & HACER SCOPE
Objetivo: Herramientas para que Gina entienda el panorama completo (big to small)
Contexto: Gina es un Dashboard Assistant que puede ver TODOS los folders y documents de la compañía. NO está limitada a un folder/document específico.
Base: Modelo de Schedules & Status (SCHEDULE_AND_STATUS.md)


## ARQUITECTURA NUEVA

OLD (Document-centric):
User abre Document X
Presiona [Call Asistente]
Gina ve SOLO Document X
NEW (Company-wide dashboard):
User va a "Assistance" section
Presiona "Talk to Assistance"
Gina ve TODOS los Folders + Documents
Gina tiene "control del dashboard"


## TOOLS QUE GINA NECESITA



### TOOL 1: get_all_company_folders()
Qué hace: Traer TODOS los folders de la compañía del user actual.
Retorna:
[
  {
    "id": "folder_1",
    "name": "Marketing",
    "departmentId": "dept_1",
    "scheduleStartAt": "2026-08-01",
    "scheduleFinishAt": "2026-08-07",
    "hasSchedule": true,
    "folderStatus": "in_progress",
    "childDocuments": 5,
    "childCompleted": 2
  },
  {
    "id": "folder_2",
    "name": "Design",
    "scheduleStartAt": null,
    "scheduleFinishAt": null,
    "hasSchedule": false,
    "folderStatus": "not_started",
    "childDocuments": 3,
    "childCompleted": 0
  }
]
Para qué sirve:
Gina ve el panorama general
Sabe cuántos projects hay
Cuáles tienen schedule, cuáles no


### TOOL 2: get_all_company_documents()
Qué hace: Traer TODOS los documents (files) de la compañía.
Retorna:
[
  {
    "id": "doc_1",
    "title": "Blog Post",
    "parentFolderId": "folder_1",
    "parentFolderName": "Marketing",
    "anchorAt": "2026-08-01T08:00:00Z",
    "anchorFinishAt": "2026-08-01T15:00:00Z",
    "status": "not_started",
    "completed": false,
    "isInsideFrame": true,
    "isPastDue": false,
    "isToday": true
  },
  {
    "id": "doc_2",
    "title": "Research",
    "parentFolderId": "folder_2",
    "parentFolderName": "Design",
    "anchorAt": null,
    "anchorFinishAt": null,
    "status": "reserved",
    "completed": false,
    "isInsideFrame": false,
    "isPastDue": false,
    "isToday": false
  }
]
Para qué sirve:
Gina ve TODO lo que existe
Con fechas, status, contexto


### TOOL 3: get_documents_by_date_range(startDate, endDate)
Qué hace: Filtrar documents en un rango de fechas específico.
Parámetros:
startDate: "2026-08-01" (ISO)
endDate: "2026-08-07"
Retorna:
{
  "range": "Aug 1 - Aug 7",
  "totalDocuments": 12,
  "breakdown": {
    "today": 3,
    "tomorrow": 4,
    "laterThisWeek": 5
  },
  "documents": [
    {
      "date": "2026-08-01",
      "title": "Blog Post",
      "status": "not_started",
      "folder": "Marketing"
    }
  ]
}
Para qué sirve:
User pregunta: "Qué tengo para mañana?"
Gina usa esto para traer dates específicas


### TOOL 4: get_incomplete_documents()
Qué hace: Traer TODOS los documents que NO están completados.
Retorna:
{
  "pastDue": [
    {
      "id": "doc_1",
      "title": "Email campaign",
      "folder": "Marketing",
      "dueDate": "2026-07-31",
      "daysOverdue": 1,
      "status": "in_progress"
    }
  ],
  "upcoming": [
    {
      "id": "doc_2",
      "title": "Blog Post",
      "folder": "Marketing",
      "dueDate": "2026-08-02",
      "daysUntilDue": 1,
      "status": "not_started"
    }
  ],
  "reserved": [
    {
      "id": "doc_3",
      "title": "Long-term research",
      "folder": "Design",
      "dueDate": "2026-12-01",
      "status": "reserved"
    }
  ]
}
Para qué sirve:
User pregunta: "Gina, qué no completé?"
Gina categoriza automáticamente


### TOOL 5: get_documents_by_status(status)
Qué hace: Filtrar documents por status específico.
Parámetros:
status: "in_progress" | "not_started" | "reserved" | "past_due" | "submitted" | "completed"
Retorna:
{
  "status": "in_progress",
  "total": 5,
  "documents": [
    {
      "id": "doc_1",
      "title": "Blog Post",
      "folder": "Marketing",
      "startedAt": "2026-08-01T10:30:00Z",
      "dueAt": "2026-08-01T15:00:00Z",
      "timeElapsed": "2 hours"
    }
  ]
}
Para qué sirve:
User: "Qué está en progreso ahora?"
Gina trae solo documentos en esa fase


### TOOL 6: get_folder_children_summary(folderId)
Qué hace: Traer resumen de un folder específico (sus documents + status agregado).
Parámetros:
folderId: "folder_1"
Retorna:
{
  "folderId": "folder_1",
  "folderName": "Marketing",
  "hasSchedule": true,
  "schedule": {
    "start": "2026-08-01",
    "finish": "2026-08-07",
    "daysRemaining": 5
  },
  "documents": [
    {
      "title": "Blog Post",
      "status": "in_progress",
      "dueDate": "2026-08-01",
      "isPastDue": false
    }
  ],
  "aggregated": {
    "total": 5,
    "completed": 1,
    "inProgress": 2,
    "notStarted": 2,
    "pastDue": 0
  }
}
Para qué sirve:
User: "Gina, cómo está el proyecto Marketing?"
Gina da un resumen detallado de ese folder


### TOOL 7: get_today_scope()
Qué hace: Resumen del DÍA DE HOY - qué debe hacerse.
Retorna:
{
  "date": "2026-08-01",
  "totalDocumentsToday": 6,
  "breakdown": {
    "notStarted": 2,
    "inProgress": 3,
    "submitted": 1
  },
  "byFolder": [
    {
      "folder": "Marketing",
      "documents": 4,
      "status": "in_progress"
    },
    {
      "folder": "Design",
      "documents": 2,
      "status": "not_started"
    }
  ],
  "nextDeadline": {
    "title": "Blog Post",
    "folder": "Marketing",
    "time": "15:00"
  }
}
Para qué sirve:
User: "Gina, qué tengo para hoy?"
Gina da panorama completo del día


### TOOL 8: get_week_scope(weekOffset)
Qué hace: Resumen de UNA SEMANA (this week, next week, etc).
Parámetros:
weekOffset: 0 (this week)
           1 (next week)
           -1 (last week)
Retorna:
{
  "week": "Aug 1 - Aug 7",
  "totalDocuments": 25,
  "byDay": {
    "Monday": { "count": 5, "status": "in_progress" },
    "Tuesday": { "count": 4, "status": "not_started" }
  },
  "byFolder": [
    { "folder": "Marketing", "documents": 12 },
    { "folder": "Design", "documents": 8 }
  ],
  "pastDueFromLastWeek": 3
}
Para qué sirve:
User: "Gina, qué tengo esta semana?"
Gina visualiza la semana completa


### TOOL 9: get_past_due_documents()
Qué hace: Traer TODOS los documents que están VENCIDOS (status != completed Y fecha < hoy).
Retorna:
{
  "totalPastDue": 4,
  "documents": [
    {
      "title": "Email campaign",
      "folder": "Marketing",
      "dueDate": "2026-07-31",
      "daysOverdue": 1,
      "status": "in_progress"
    },
    {
      "title": "Research",
      "folder": "Design",
      "dueDate": "2026-07-28",
      "daysOverdue": 4,
      "status": "not_started"
    }
  ]
}
Para qué sirve:
User: "Gina, qué no completé?"
Gina trae SOLO los vencidos


### TOOL 10: get_schedule_conflicts()
Qué hace: Detectar documents que tienen SOLAPE de horarios.
Retorna:
{
  "conflicts": [
    {
      "date": "2026-08-01",
      "documents": [
        {
          "title": "Blog Post",
          "time": "8:00 AM - 3:00 PM",
          "folder": "Marketing"
        },
        {
          "title": "Moodboard",
          "time": "10:00 AM - 1:00 PM",
          "folder": "Design"
        }
      ],
      "overlapTime": "10:00 AM - 1:00 PM",
      "severity": "medium"
    }
  ]
}
Para qué sirve:
User: "Gina, hay conflictos?"
Gina detecta solapes (premium feature)


### TOOL 11: get_document_detail(documentId)
Qué hace: Traer DETALLES COMPLETOS de un document específico.
Parámetros:
documentId: "doc_1"
Retorna:
{
  "id": "doc_1",
  "title": "Blog Post",
  "folder": {
    "id": "folder_1",
    "name": "Marketing",
    "hasSchedule": true,
    "frameStart": "2026-08-01",
    "frameFinish": "2026-08-07"
  },
  "schedule": {
    "date": "2026-08-01",
    "startTime": "08:00",
    "finishTime": "15:00",
    "isToday": true,
    "isPastDue": false,
    "isInsideFrame": true
  },
  "status": "in_progress",
  "completed": false,
  "body": "[contenido del documento]",
  "createdAt": "2026-07-25",
  "todos": [
    { "task": "Write intro", "done": true },
    { "task": "Add images", "done": false }
  ]
}
Para qué sirve:
User: "Gina, cuéntame sobre el Blog Post"
Gina da detalles completos


### TOOL 12: get_gina_scope(timeframe)
Qué hace: Gina hace un "scope" automático para un timeframe (el análisis completo).
Parámetros:
timeframe: "today" | "tomorrow" | "this_week" | "next_week" | "all"
Retorna:
{
  "scope": "today",
  "summary": "Tienes 6 documentos para hoy...",
  "analysis": {
    "pastDue": 1,
    "inProgress": 3,
    "notStarted": 2,
    "priority": "HIGH"
  },
  "recommendations": [
    "Termina Blog Post antes de las 3 PM",
    "Moodboard tiene solape con Research"
  ]
}
Para qué sirve:
Core del onboarding de Gina
Gina hace análisis inteligente


## CÓMO GINA USA
 ESTOS TOOLS
Escenario 1: "Gina, qué tengo para hoy?"
Gina calls:
1. get_today_scope()
   → Trae todo de hoy
Gina responde:
"Tienes 6 documentos para hoy:
- 2 sin empezar (Blog Post, Email)
- 3 en progreso (Research, Moodboard, Design)
- 1 vencido (Campaign)
¿Cuál quieres que prioricemos?"
Escenario 2: "Gina, qué no completé?"
Gina calls:
1. get_incomplete_documents()
   → Trae todos los incompletos
Gina responde:
"Tienes 8 incompletos:
VENCIDOS (2):
- Email campaign (1 día atrasado)
- Research (4 días atrasado)
PRÓXIMOS (4):
- Blog Post (2 días)
- Moodboard (5 días)
LARGO PLAZO (2):
- Long-term project (Diciembre)
¿Cuál atiendes primero?"
Escenario 3: "Gina, cómo está Marketing?"
Gina calls:
1. get_folder_children_summary('folder_1')
   → Trae resumen del folder
Gina responde:
"Marketing está 60% completo (3 de 5):
- Blog Post: In progress (due 3 PM)
- Email: Submitted
- Campaign: Past due (1 día)
¿Necesitas mover algo de horario?"
Escenario 4: "Gina, hay conflictos?"
Gina calls:
1. get_schedule_conflicts()
   → Detecta solapes
Gina responde:
"Encontré 1 conflicto:
Aug 1, 10 AM - 1 PM:
- Blog Post (Marketing) 8 AM - 3 PM
- Moodboard (Design) 10 AM - 1 PM
Solapan 3 horas. ¿Movemos algo?"


## FASE 1 DELIVERABLES

Lo que Gina puede hacer CON estos tools:
✅ Ver panorama completo (all folders + documents) ✅ Filtrar por fecha (today, tomorrow, this week, etc) ✅ Filtrar por status (incomplete, past due, in progress, etc) ✅ Hacer "scope" (análisis general) ✅ Detectar conflictos ✅ Responder preguntas de alto nivel
Lo que Gina NO puede hacer (Fase 2+): ❌ Crear reminders (To Do sync) ❌ Cambiar status ❌ Mover documentos ❌ Ejecutar acciones


## ORDEN DE IMPLEMENTACIÓN

1. get_all_company_folders()
2. get_all_company_documents()
3. get_documents_by_date_range()
4. get_incomplete_documents()
5. get_documents_by_status()
6. get_today_scope()
7. get_folder_children_summary()
8. get_week_scope()
9. get_past_due_documents()
10. get_schedule_conflicts()
11. get_document_detail()
12. get_gina_scope()


## UI/UX CHANGES

Navigation:
Documents
Departments
Agents
+ Assistance  ← NEW
Click "Assistance":
├─ Card: "Meet Gina"
├─ Button: "Talk to Assistance"
└─ Opens: Chat modal (floating, not in left panel)
Chat can now:
- See ALL folders
- See ALL documents
- Answer any question about scope
- Provide analysis & recommendations
Estos tools son la base. Gina "escucha" y "entiende" PRIMERO.
¿Está bien así? ¿O necesitas ajustes?
