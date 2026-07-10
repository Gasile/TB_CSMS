alter table "public"."ChargingStations" alter column "allocated_limit" drop not null;
alter table "public"."ChargingStations" add column "allocated_limit" numeric;
