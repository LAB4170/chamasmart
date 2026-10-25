-- ChamaSmart: wipe ALL data and start again from an empty database.
--
-- WHAT THIS DESTROYS: every user, chama, contribution, document, payment record, case,
-- invoice, legal order and the whole activity log. It cannot be undone. Take a backup first.
-- WHAT IT KEEPS: nothing in the database. The app rebuilds the tables, plans, roles and
-- permissions itself the next time it starts (Flyway runs V0 on an empty schema).
--
-- HOW TO RUN (replace NAME with the database name, shown by: SELECT current_database();)
--   psql "<connection string>" -v confirm_db=NAME -f scripts/reset-database.sql
-- The script refuses to run unless confirm_db matches the database you are connected to.
--
-- AFTER IT RUNS: restart the backend, register your account, then make it the administrator
-- (see docs/RUNBOOK.md, "Starting again from empty").

\set ON_ERROR_STOP on
SELECT current_database() AS db, (:'confirm_db' = current_database()) AS matches \gset
\if :matches
  \echo Wiping database :db ...
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA public;
  GRANT ALL ON SCHEMA public TO CURRENT_USER;
  GRANT ALL ON SCHEMA public TO public;
  \echo Done. Restart the backend so it rebuilds the tables.
\else
  \echo Refusing to run: confirm_db does not match the connected database (:db).
  SELECT 1/0 AS stopped_by_safety_check;
\endif
