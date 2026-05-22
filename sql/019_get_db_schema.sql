create or replace function get_db_schema()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  with table_list as (
    select table_name, table_type
    from information_schema.tables
    where table_schema = 'public'
      and table_name not like '_prisma%'
    order by table_name
  ),
  table_columns as (
    select
      t.table_name,
      json_agg(
        json_build_object(
          'column_name', c.column_name,
          'data_type', c.data_type,
          'is_nullable', c.is_nullable,
          'column_default', c.column_default,
          'character_maximum_length', c.character_maximum_length
        ) order by c.ordinal_position
      ) as columns
    from table_list t
    join information_schema.columns c on c.table_schema = 'public' and c.table_name = t.table_name
    group by t.table_name
  )
  select json_agg(
    json_build_object(
      'table_name', tl.table_name,
      'columns', coalesce(tc.columns, '[]'::json)
    ) order by tl.table_name
  ) into result
  from table_list tl
  left join table_columns tc on tc.table_name = tl.table_name;

  return coalesce(result, '[]'::json);
end;
$$;
