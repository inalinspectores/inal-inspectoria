-- Nueva tabla: documentos (EXPEDIENTE/SIFEGA/OTRO) asociados a cada EVENTO
create table if not exists evento_documento (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references evento(id) on delete cascade,
  carpeta_id uuid not null references carpeta(id) on delete cascade,
  tipo text not null check (tipo in ('EXPEDIENTE','SIFEGA','OTRO')),
  numero text not null,
  drive_folder_url text,
  fecha_alta timestamp with time zone default now()
);
create index if not exists evento_documento_evento_idx on evento_documento (evento_id);
create index if not exists evento_documento_carpeta_idx on evento_documento (carpeta_id);
create index if not exists evento_documento_numero_trgm on evento_documento using gin (numero gin_trgm_ops);

alter table evento_documento enable row level security;
create policy "Authenticated full access" on evento_documento
  for all using (auth.role() = 'authenticated');

-- Migrar datos existentes de evento.tipo/numero_expediente/drive_folder_url
insert into evento_documento (evento_id, carpeta_id, tipo, numero, drive_folder_url, fecha_alta)
select id, carpeta_id, tipo, numero_expediente, drive_folder_url, fecha_evento
from evento
where tipo is not null and numero_expediente is not null;

alter table evento add column if not exists nickname text;

alter table evento drop constraint if exists evento_tipo_check;
alter table evento drop column if exists tipo;
alter table evento drop column if exists numero_expediente;
alter table evento drop column if exists drive_folder_url;
