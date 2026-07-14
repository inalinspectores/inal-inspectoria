-- Nuevos tipos de EVENTO permitidos
alter table evento drop constraint if exists evento_tipo_evento_check;
alter table evento add constraint evento_tipo_evento_check check (
  tipo_evento in (
    'INSPECCION_PRESENCIAL',
    'INSPECCION_VIRTUAL',
    'SUBSANACION',
    'DOCUMENTACION_ADICIONAL',
    'CLAUSURA_PREVENTIVA',
    'CLAUSURA_DEFINITIVA',
    'OTRO'
  )
);

-- Link a carpeta de Google Drive asociada al EVENTO (en lugar de archivos individuales, por ahora)
alter table evento add column if not exists drive_folder_url text;

-- NOTA: si el "drop constraint" falla porque el nombre es distinto, buscar el nombre
-- real en Supabase: Table Editor > evento > columna tipo_evento > constraints,
-- o correr: select conname from pg_constraint where conrelid = 'evento'::regclass;
