-- ==========================================
-- 1. MODIFICATION DES TABLES CITRINEOS
-- ==========================================
-- Ajout de la colonne personnalisée dans Transactions
ALTER TABLE public."Transactions" ADD COLUMN "user_id" integer;

-- Ajout de la colonne personnalisée dans Authorizations (repérée dans ton code)
ALTER TABLE public."Authorizations" ADD COLUMN "badge_name" text DEFAULT '-'::text NOT NULL;


-- ==========================================
-- 2. CRÉATION DE TES TABLES PERSONNELLES
-- ==========================================
-- Séquence et Table Users
CREATE SEQUENCE public."Users_id_seq" START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE TABLE public."Users" (
    id integer DEFAULT nextval('public."Users_id_seq"'::regclass) NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    role text DEFAULT 'User'::text NOT NULL,
    reset_token text,
    reset_token_expires timestamp with time zone
);

-- Séquence et Table UserBadges
CREATE SEQUENCE public."UserBadges_id_seq" START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE TABLE public."UserBadges" (
    id integer DEFAULT nextval('public."UserBadges_id_seq"'::regclass) NOT NULL,
    user_id integer NOT NULL,
    authorization_id integer NOT NULL
);


-- ==========================================
-- 3. CLÉS PRIMAIRES ET CONTRAINTES D'UNICITÉ
-- ==========================================
ALTER TABLE ONLY public."Users" ADD CONSTRAINT "Users_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."Users" ADD CONSTRAINT "Users_email_key" UNIQUE (email);

ALTER TABLE ONLY public."UserBadges" ADD CONSTRAINT "UserBadges_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."UserBadges" ADD CONSTRAINT "UserBadges_authorization_id_key" UNIQUE (authorization_id);


-- ==========================================
-- 4. CRÉATION DES RELATIONS (CLÉS ÉTRANGÈRES)
-- ==========================================
ALTER TABLE ONLY public."Transactions" ADD CONSTRAINT "Transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."Users"(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public."UserBadges" ADD CONSTRAINT "UserBadges_authorization_id_fkey" FOREIGN KEY (authorization_id) REFERENCES public."Authorizations"(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public."UserBadges" ADD CONSTRAINT "UserBadges_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."Users"(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


-- ==========================================
-- 5. CRÉATION DE TES VUES STATISTIQUES
-- ==========================================
CREATE VIEW public.user_charging_summary AS
 SELECT u.id AS user_id,
    COALESCE(sum(t."totalKwh"), (0)::numeric) AS total_energy_kwh,
    COALESCE(sum(
        CASE
            WHEN (t."startTime" >= (now() - '7 days'::interval)) THEN t."totalKwh"
            ELSE (0)::numeric
        END), (0)::numeric) AS last_7_days_energy_kwh
   FROM (public."Users" u
     LEFT JOIN public."Transactions" t ON ((u.id = t.user_id)))
  GROUP BY u.id;

CREATE VIEW public.user_daily_charging AS
 SELECT user_id,
    date("startTime") AS charge_date,
    COALESCE(sum("totalKwh"), (0)::numeric) AS daily_kwh
   FROM public."Transactions"
  WHERE ("startTime" IS NOT NULL)
  GROUP BY user_id, (date("startTime"));


-- ==========================================
-- 6. CRÉATION DE TON AUTOMATISATION (TRIGGER)
-- ==========================================
CREATE FUNCTION public.link_user_to_transaction() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW."authorizationId" IS NOT NULL AND NEW."user_id" IS NULL THEN
        SELECT "user_id" INTO NEW."user_id"
        FROM "UserBadges"
        WHERE "authorization_id" = NEW."authorizationId"
        LIMIT 1;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_link_user_to_transaction BEFORE INSERT OR UPDATE ON public."Transactions" FOR EACH ROW EXECUTE FUNCTION public.link_user_to_transaction();