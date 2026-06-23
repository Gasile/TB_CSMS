SET check_function_bodies = false;
CREATE FUNCTION public.link_user_to_transaction() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- On ne tente la liaison QUE si un badge est présent ET que user_id est vide
    IF NEW."authorizationId" IS NOT NULL AND NEW."user_id" IS NULL THEN
        -- On cherche l'ID de l'utilisateur dans la VRAIE table "UserBadges"
        SELECT "user_id" INTO NEW."user_id"
        FROM "UserBadges"
        WHERE "authorization_id" = NEW."authorizationId"
        LIMIT 1;
    END IF;
    -- On autorise toujours PostgreSQL à enregistrer la ligne pour CitrineOS
    RETURN NEW;
END;
$$;
CREATE FUNCTION public.populate_station_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
        BEGIN
          SELECT "id" INTO NEW."stationId"
          FROM "ChargingStations"
          WHERE "ocppConnectionName" = NEW."ocppConnectionName" AND "tenantId" = NEW."tenantId";
          IF NEW."stationId" IS NULL THEN
            RAISE EXCEPTION 'No ChargingStation found with ocppConnectionName=% and tenantId=%',
                           NEW."ocppConnectionName", NEW."tenantId";
          END IF;
          RETURN NEW;
        END;
        $$;
CREATE TABLE public."AsyncJobStatuses" (
    "jobId" character varying(255) NOT NULL,
    "jobName" character varying(255) NOT NULL,
    "tenantPartnerId" integer NOT NULL,
    "finishedAt" timestamp with time zone,
    "stoppedAt" timestamp with time zone,
    "stopScheduled" boolean DEFAULT false NOT NULL,
    "isFailed" boolean DEFAULT false NOT NULL,
    "paginationParams" json NOT NULL,
    "totalObjects" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);
CREATE TABLE public."Authorizations" (
    id integer NOT NULL,
    "allowedConnectorTypes" character varying(255)[],
    "disallowedEvseIdPrefixes" character varying(255)[],
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL,
    "concurrentTransaction" boolean DEFAULT false,
    "realTimeAuth" character varying(255) DEFAULT 'Never'::character varying NOT NULL,
    "realTimeAuthUrl" character varying(255),
    "idToken" public.citext NOT NULL,
    "idTokenType" character varying(255),
    "additionalInfo" jsonb,
    status character varying(255) DEFAULT 'Accepted'::character varying NOT NULL,
    "cacheExpiryDateTime" timestamp with time zone,
    "chargingPriority" integer,
    language1 character varying(255),
    language2 character varying(255),
    "personalMessage" json,
    "customData" jsonb,
    "groupAuthorizationId" integer,
    "tenantPartnerId" integer,
    "realTimeAuthLastAttempt" jsonb,
    "realTimeAuthTimeout" integer,
    "tariffId" integer,
    "isPrepaid" boolean DEFAULT false NOT NULL,
    "prepaidBalance" numeric,
    badge_name text DEFAULT '-'::text NOT NULL
);
CREATE SEQUENCE public."Authorizations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."Authorizations_id_seq" OWNED BY public."Authorizations".id;
CREATE TABLE public."Boots" (
    id character varying(255) NOT NULL,
    "lastBootTime" timestamp with time zone,
    "heartbeatInterval" integer,
    "bootRetryInterval" integer,
    status character varying(255),
    "statusInfo" json,
    "getBaseReportOnPending" boolean,
    "variablesRejectedOnLastBoot" json,
    "bootWithRejectedVariables" boolean,
    "changeConfigurationsOnPending" boolean,
    "getConfigurationsOnPending" boolean,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL
);
CREATE TABLE public."Certificates" (
    id integer NOT NULL,
    "serialNumber" bigint,
    "issuerName" character varying(255),
    "organizationName" character varying(255),
    "commonName" character varying(255),
    "keyLength" integer,
    "validBefore" timestamp with time zone,
    "signatureAlgorithm" character varying(255),
    "countryName" character varying(255),
    "isCA" boolean,
    "pathLen" integer,
    "certificateFileId" character varying(255),
    "privateKeyFileId" character varying(255),
    "signedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL,
    "certificateFileHash" character varying(255)
);
CREATE SEQUENCE public."Certificates_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."Certificates_id_seq" OWNED BY public."Certificates".id;
CREATE TABLE public."ChangeConfigurations" (
    id integer NOT NULL,
    "ocppConnectionName" character varying(255) NOT NULL,
    key character varying(50) NOT NULL,
    value character varying(500),
    readonly boolean,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL
);
CREATE SEQUENCE public."ChangeConfigurations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."ChangeConfigurations_id_seq" OWNED BY public."ChangeConfigurations".id;
CREATE TABLE public."ChargingNeeds" (
    id integer NOT NULL,
    "acChargingParameters" jsonb,
    "dcChargingParameters" jsonb,
    "departureTime" timestamp with time zone,
    "requestedEnergyTransfer" character varying(255),
    "maxScheduleTuples" integer,
    "evseId" integer,
    "transactionDatabaseId" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL
);
CREATE SEQUENCE public."ChargingNeeds_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."ChargingNeeds_id_seq" OWNED BY public."ChargingNeeds".id;
CREATE TABLE public."ChargingProfiles" (
    "databaseId" integer NOT NULL,
    "ocppConnectionName" character varying(255),
    id integer,
    "chargingProfileKind" character varying(255),
    "chargingProfilePurpose" character varying(255),
    "recurrencyKind" character varying(255),
    "stackLevel" integer,
    "validFrom" timestamp with time zone,
    "validTo" timestamp with time zone,
    "evseId" integer,
    "isActive" boolean DEFAULT false,
    "chargingLimitSource" character varying(255) DEFAULT 'CSO'::character varying,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "transactionDatabaseId" integer,
    "tenantId" integer DEFAULT 1 NOT NULL
);
CREATE SEQUENCE public."ChargingProfiles_databaseId_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."ChargingProfiles_databaseId_seq" OWNED BY public."ChargingProfiles"."databaseId";
CREATE TABLE public."ChargingSchedules" (
    "databaseId" integer NOT NULL,
    id integer,
    "ocppConnectionName" character varying(255),
    "chargingRateUnit" character varying(255),
    "chargingSchedulePeriod" jsonb,
    duration integer,
    "minChargingRate" numeric,
    "startSchedule" character varying(255),
    "timeBase" timestamp with time zone,
    "chargingProfileDatabaseId" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL
);
CREATE SEQUENCE public."ChargingSchedules_databaseId_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."ChargingSchedules_databaseId_seq" OWNED BY public."ChargingSchedules"."databaseId";
CREATE TABLE public."ChargingStationNetworkProfiles" (
    "ocppConnectionName" character varying(36) NOT NULL,
    "configurationSlot" integer,
    "setNetworkProfileId" integer NOT NULL,
    "websocketServerConfigId" character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL,
    "stationId" integer
);
CREATE TABLE public."ChargingStationSecurityInfos" (
    id integer NOT NULL,
    "ocppConnectionName" character varying(255),
    "publicKeyFileId" character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL,
    "stationId" integer
);
CREATE SEQUENCE public."ChargingStationSecurityInfos_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."ChargingStationSecurityInfos_id_seq" OWNED BY public."ChargingStationSecurityInfos".id;
CREATE TABLE public."ChargingStationSequences" (
    id integer NOT NULL,
    "ocppConnectionName" character varying(36) NOT NULL,
    type character varying(255) NOT NULL,
    value bigint DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL,
    "stationId" integer
);
CREATE SEQUENCE public."ChargingStationSequences_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."ChargingStationSequences_id_seq" OWNED BY public."ChargingStationSequences".id;
CREATE SEQUENCE public."ChargingStations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE TABLE public."ChargingStations" (
    "ocppConnectionName" character varying(36) NOT NULL,
    "isOnline" boolean,
    protocol character varying(255),
    "chargePointVendor" character varying(20),
    "chargePointModel" character varying(20),
    "chargePointSerialNumber" character varying(25),
    "chargeBoxSerialNumber" character varying(25),
    "firmwareVersion" character varying(50),
    iccid character varying(20),
    imsi character varying(20),
    "meterType" character varying(25),
    "meterSerialNumber" character varying(25),
    "locationId" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL,
    coordinates public.geometry(Point),
    "floorLevel" character varying(255),
    "parkingRestrictions" jsonb,
    capabilities jsonb,
    "use16StatusNotification0" boolean DEFAULT true NOT NULL,
    "latestOcppMessageTimestamp" timestamp with time zone,
    id integer DEFAULT nextval('public."ChargingStations_id_seq"'::regclass) NOT NULL
);
CREATE TABLE public."ComponentVariables" (
    "componentId" integer NOT NULL,
    "variableId" integer NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL
);
CREATE TABLE public."Components" (
    id integer NOT NULL,
    name character varying(255),
    instance character varying(255),
    "evseDatabaseId" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL
);
CREATE SEQUENCE public."Components_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."Components_id_seq" OWNED BY public."Components".id;
CREATE TABLE public."CompositeSchedules" (
    id integer NOT NULL,
    "ocppConnectionName" character varying(255),
    "evseId" integer,
    duration integer,
    "scheduleStart" timestamp with time zone,
    "chargingRateUnit" character varying(255),
    "chargingSchedulePeriod" jsonb,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL
);
CREATE SEQUENCE public."CompositeSchedules_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."CompositeSchedules_id_seq" OWNED BY public."CompositeSchedules".id;
CREATE TABLE public."Connectors" (
    id integer NOT NULL,
    "ocppConnectionName" character varying(255) NOT NULL,
    "connectorId" integer,
    status character varying(255) DEFAULT 'Unknown'::character varying,
    "errorCode" character varying(255) DEFAULT 'NoError'::character varying,
    "timestamp" timestamp with time zone,
    info character varying(255),
    "vendorId" character varying(255),
    "vendorErrorCode" character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL,
    "evseId" integer,
    "evseTypeConnectorId" integer,
    type character varying(255),
    format character varying(255),
    "powerType" character varying(255),
    "maximumAmperage" integer,
    "maximumVoltage" integer,
    "maximumPowerWatts" integer,
    "termsAndConditionsUrl" character varying(255),
    "tariffId" integer,
    "stationId" integer
);
CREATE SEQUENCE public."Connectors_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."Connectors_id_seq" OWNED BY public."Connectors".id;
CREATE TABLE public."DeleteCertificateAttempts" (
    id integer NOT NULL,
    "ocppConnectionName" character varying(36) NOT NULL,
    "hashAlgorithm" character varying(255) NOT NULL,
    "issuerNameHash" character varying(255),
    "issuerKeyHash" character varying(255),
    "serialNumber" character varying(255),
    status character varying(255),
    "tenantId" integer NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "stationId" integer
);
CREATE SEQUENCE public."DeleteCertificateAttempts_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."DeleteCertificateAttempts_id_seq" OWNED BY public."DeleteCertificateAttempts".id;
CREATE TABLE public."EventData" (
    id integer NOT NULL,
    "ocppConnectionName" character varying(255),
    "eventId" integer,
    trigger character varying(255),
    cause integer,
    "timestamp" timestamp with time zone,
    "actualValue" character varying(255),
    "techCode" character varying(255),
    "techInfo" character varying(255),
    cleared boolean,
    "transactionId" character varying(255),
    "variableMonitoringId" integer,
    "eventNotificationType" character varying(255),
    "variableId" integer,
    "componentId" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL,
    "stationId" integer
);
CREATE SEQUENCE public."EventData_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."EventData_id_seq" OWNED BY public."EventData".id;
CREATE TABLE public."EvseTypes" (
    "databaseId" integer NOT NULL,
    id integer,
    "connectorId" integer,
    "tenantId" integer NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);
CREATE SEQUENCE public."EvseTypes_databaseId_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."EvseTypes_databaseId_seq" OWNED BY public."EvseTypes"."databaseId";
CREATE TABLE public."Evses" (
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL,
    "ocppConnectionName" character varying(36),
    "evseTypeId" integer,
    "evseId" character varying(255),
    "physicalReference" character varying(255),
    removed boolean,
    id integer NOT NULL,
    "stationId" integer
);
CREATE SEQUENCE public."Evses_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."Evses_id_seq" OWNED BY public."Evses".id;
CREATE TABLE public."InstallCertificateAttempts" (
    id integer NOT NULL,
    "ocppConnectionName" character varying(36) NOT NULL,
    "certificateType" character varying(255) NOT NULL,
    "certificateId" integer,
    status character varying(255),
    "tenantId" integer NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "stationId" integer
);
CREATE SEQUENCE public."InstallCertificateAttempts_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."InstallCertificateAttempts_id_seq" OWNED BY public."InstallCertificateAttempts".id;
CREATE TABLE public."InstalledCertificates" (
    id integer NOT NULL,
    "ocppConnectionName" character varying(36) NOT NULL,
    "hashAlgorithm" character varying(255) NOT NULL,
    "issuerNameHash" character varying(255) NOT NULL,
    "issuerKeyHash" character varying(255) NOT NULL,
    "serialNumber" character varying(255) NOT NULL,
    "certificateType" character varying(255) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL,
    "certificateId" integer,
    "stationId" integer
);
CREATE SEQUENCE public."InstalledCertificates_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."InstalledCertificates_id_seq" OWNED BY public."InstalledCertificates".id;
CREATE TABLE public."LatestStatusNotifications" (
    id integer NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "ocppConnectionName" character varying(36),
    "statusNotificationId" integer,
    "tenantId" integer DEFAULT 1 NOT NULL,
    "stationId" integer
);
CREATE SEQUENCE public."LatestStatusNotifications_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."LatestStatusNotifications_id_seq" OWNED BY public."LatestStatusNotifications".id;
CREATE TABLE public."LocalListAuthorizations" (
    id integer NOT NULL,
    "allowedConnectorTypes" character varying(255)[],
    "disallowedEvseIdPrefixes" character varying(255)[],
    "authorizationId" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL,
    "groupAuthorizationId" integer,
    "idToken" character varying(255) NOT NULL,
    "idTokenType" character varying(255),
    "additionalInfo" jsonb,
    status character varying(255) DEFAULT 'Accepted'::character varying NOT NULL,
    "cacheExpiryDateTime" timestamp with time zone,
    "chargingPriority" integer,
    language1 character varying(255),
    language2 character varying(255),
    "personalMessage" json,
    "customData" jsonb
);
CREATE SEQUENCE public."LocalListAuthorizations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."LocalListAuthorizations_id_seq" OWNED BY public."LocalListAuthorizations".id;
CREATE TABLE public."LocalListVersionAuthorizations" (
    "localListVersionId" integer NOT NULL,
    "authorizationId" integer NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL
);
CREATE TABLE public."LocalListVersions" (
    id integer NOT NULL,
    "ocppConnectionName" character varying(255),
    "versionNumber" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL
);
CREATE SEQUENCE public."LocalListVersions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."LocalListVersions_id_seq" OWNED BY public."LocalListVersions".id;
CREATE TABLE public."Locations" (
    id integer NOT NULL,
    name character varying(255),
    address character varying(255),
    city character varying(255),
    "postalCode" character varying(255),
    state character varying(255),
    country character varying(255),
    coordinates public.geometry(Point),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL,
    "publishUpstream" boolean DEFAULT true,
    "timeZone" character varying(255) DEFAULT 'UTC'::character varying,
    "parkingType" character varying(255),
    facilities jsonb,
    "openingHours" jsonb
);
CREATE SEQUENCE public."Locations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."Locations_id_seq" OWNED BY public."Locations".id;
CREATE TABLE public."MessageInfos" (
    "databaseId" integer NOT NULL,
    "ocppConnectionName" character varying(255),
    id integer,
    priority character varying(255),
    state character varying(255),
    "startDateTime" timestamp with time zone,
    "endDateTime" timestamp with time zone,
    "transactionId" character varying(255),
    message json,
    active boolean,
    "displayComponentId" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL
);
CREATE SEQUENCE public."MessageInfos_databaseId_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."MessageInfos_databaseId_seq" OWNED BY public."MessageInfos"."databaseId";
CREATE TABLE public."MeterValues" (
    id integer NOT NULL,
    "transactionEventId" integer,
    "transactionDatabaseId" integer,
    "stopTransactionDatabaseId" integer,
    "sampledValue" json,
    "timestamp" timestamp with time zone,
    "connectorId" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL,
    "customData" jsonb,
    "tariffId" integer,
    "transactionId" character varying(255)
);
CREATE SEQUENCE public."MeterValues_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."MeterValues_id_seq" OWNED BY public."MeterValues".id;
CREATE TABLE public."OCPPMessages" (
    id integer NOT NULL,
    "ocppConnectionName" character varying(255),
    "correlationId" character varying(255),
    origin character varying(255),
    protocol character varying(255),
    action character varying(255),
    message jsonb,
    "timestamp" timestamp with time zone,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL,
    state character varying(255),
    "requestMessageId" integer,
    "stationId" integer
);
CREATE SEQUENCE public."OCPPMessages_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."OCPPMessages_id_seq" OWNED BY public."OCPPMessages".id;
CREATE TABLE public."Reservations" (
    "databaseId" integer NOT NULL,
    id integer,
    "ocppConnectionName" character varying(255),
    "expiryDateTime" timestamp with time zone,
    "connectorType" character varying(255),
    "reserveStatus" character varying(255),
    "isActive" boolean DEFAULT false,
    "terminatedByTransaction" character varying(255),
    "idToken" jsonb,
    "groupIdToken" jsonb,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "evseId" integer,
    "tenantId" integer DEFAULT 1 NOT NULL
);
CREATE SEQUENCE public."Reservations_databaseId_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."Reservations_databaseId_seq" OWNED BY public."Reservations"."databaseId";
CREATE TABLE public."SalesTariffs" (
    "databaseId" integer NOT NULL,
    id integer,
    "numEPriceLevels" integer,
    "salesTariffDescription" character varying(255),
    "salesTariffEntry" jsonb,
    "chargingScheduleDatabaseId" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL
);
CREATE SEQUENCE public."SalesTariffs_databaseId_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."SalesTariffs_databaseId_seq" OWNED BY public."SalesTariffs"."databaseId";
CREATE TABLE public."SecurityEvents" (
    id integer NOT NULL,
    "ocppConnectionName" character varying(255),
    type character varying(255),
    "timestamp" timestamp with time zone,
    "techInfo" character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL
);
CREATE SEQUENCE public."SecurityEvents_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."SecurityEvents_id_seq" OWNED BY public."SecurityEvents".id;
CREATE TABLE public."SendLocalListAuthorizations" (
    "sendLocalListId" integer NOT NULL,
    "authorizationId" integer NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL
);
CREATE TABLE public."SendLocalLists" (
    id integer NOT NULL,
    "ocppConnectionName" character varying(255),
    "correlationId" character varying(255),
    "versionNumber" integer,
    "updateType" character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL
);
CREATE SEQUENCE public."SendLocalLists_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."SendLocalLists_id_seq" OWNED BY public."SendLocalLists".id;
CREATE TABLE public."SequelizeMeta" (
    name character varying(255) NOT NULL
);
CREATE TABLE public."ServerNetworkProfiles" (
    id character varying(255) NOT NULL,
    host character varying(255),
    port integer,
    "pingInterval" integer,
    "messageTimeout" integer,
    "securityProfile" integer,
    "allowUnknownChargingStations" boolean,
    "tlsKeyFilePath" character varying(255),
    "tlsCertificateChainFilePath" character varying(255),
    "mtlsCertificateAuthorityKeyFilePath" character varying(255),
    "rootCACertificateFilePath" character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer,
    "dynamicTenantResolution" boolean DEFAULT false NOT NULL,
    "tenantPathMapping" jsonb,
    protocols character varying(255)[]
);
COMMENT ON COLUMN public."ServerNetworkProfiles"."dynamicTenantResolution" IS 'Enable dynamic tenant resolution at WebSocket upgrade time';
COMMENT ON COLUMN public."ServerNetworkProfiles"."tenantPathMapping" IS 'Mapping of URL path segments to tenant IDs';
CREATE TABLE public."SetNetworkProfiles" (
    id integer NOT NULL,
    "ocppConnectionName" character varying(255),
    "correlationId" character varying(255),
    "websocketServerConfigId" character varying(255),
    "configurationSlot" integer,
    "ocppVersion" character varying(255),
    "ocppTransport" character varying(255),
    "ocppCsmsUrl" character varying(255),
    "messageTimeout" integer,
    "securityProfile" integer,
    "ocppInterface" character varying(255),
    apn character varying(255),
    vpn character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL,
    "stationId" integer
);
CREATE SEQUENCE public."SetNetworkProfiles_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."SetNetworkProfiles_id_seq" OWNED BY public."SetNetworkProfiles".id;
CREATE TABLE public."StartTransactions" (
    id integer NOT NULL,
    "ocppConnectionName" character varying(255),
    "meterStart" integer,
    "timestamp" timestamp with time zone,
    "reservationId" integer,
    "transactionDatabaseId" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "idTokenDatabaseId" integer,
    "connectorDatabaseId" integer,
    "tenantId" integer DEFAULT 1 NOT NULL
);
CREATE SEQUENCE public."StartTransactions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."StartTransactions_id_seq" OWNED BY public."StartTransactions".id;
CREATE TABLE public."StatusNotifications" (
    id integer NOT NULL,
    "timestamp" timestamp with time zone,
    "connectorStatus" character varying(255),
    "evseId" integer,
    "connectorId" integer,
    "errorCode" character varying(255),
    info character varying(255),
    "vendorId" character varying(255),
    "vendorErrorCode" character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "ocppConnectionName" character varying(36),
    "tenantId" integer DEFAULT 1 NOT NULL,
    "stationId" integer
);
CREATE SEQUENCE public."StatusNotifications_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."StatusNotifications_id_seq" OWNED BY public."StatusNotifications".id;
CREATE TABLE public."StopTransactions" (
    id integer NOT NULL,
    "ocppConnectionName" character varying(255),
    "transactionDatabaseId" integer,
    "meterStop" integer,
    "timestamp" timestamp with time zone,
    reason character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL,
    "idTokenValue" character varying(255),
    "idTokenType" character varying(255)
);
CREATE SEQUENCE public."StopTransactions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."StopTransactions_id_seq" OWNED BY public."StopTransactions".id;
CREATE TABLE public."Subscriptions" (
    id integer NOT NULL,
    "ocppConnectionName" character varying(255),
    "onConnect" boolean DEFAULT false,
    "onClose" boolean DEFAULT false,
    "onMessage" boolean DEFAULT false,
    "sentMessage" boolean DEFAULT false,
    "messageRegexFilter" character varying(255),
    url character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL
);
CREATE SEQUENCE public."Subscriptions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."Subscriptions_id_seq" OWNED BY public."Subscriptions".id;
CREATE TABLE public."Tariffs" (
    id integer NOT NULL,
    currency character(3) NOT NULL,
    "pricePerKwh" numeric NOT NULL,
    "pricePerMin" numeric,
    "pricePerSession" numeric,
    "authorizationAmount" numeric,
    "paymentFee" numeric,
    "taxRate" numeric,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL,
    "tariffAltText" character varying(255),
    "tariffId" character varying(255),
    "validFrom" timestamp with time zone,
    description jsonb,
    energy jsonb,
    "chargingTime" jsonb,
    "idleTime" jsonb,
    "fixedFee" jsonb,
    "reservationTime" jsonb,
    "reservationFixed" jsonb,
    "minCost" jsonb,
    "maxCost" jsonb
);
CREATE SEQUENCE public."Tariffs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."Tariffs_id_seq" OWNED BY public."Tariffs".id;
CREATE TABLE public."TenantPartners" (
    id integer NOT NULL,
    "partyId" character varying(255) NOT NULL,
    "countryCode" character varying(255) NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL,
    "partnerProfileOCPI" jsonb,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);
CREATE SEQUENCE public."TenantPartners_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."TenantPartners_id_seq" OWNED BY public."TenantPartners".id;
CREATE TABLE public."Tenants" (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "partyId" character varying(255),
    "countryCode" character varying(255),
    url character varying(255),
    "serverProfileOCPI" jsonb,
    "isUserTenant" boolean DEFAULT false NOT NULL,
    "maxChargingStations" integer
);
COMMENT ON COLUMN public."Tenants"."isUserTenant" IS 'Indicates if this tenant is a user tenant';
COMMENT ON COLUMN public."Tenants"."maxChargingStations" IS 'Maximum number of charging stations allowed for this tenant';
CREATE SEQUENCE public."Tenants_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."Tenants_id_seq" OWNED BY public."Tenants".id;
CREATE TABLE public."TransactionEvents" (
    id integer NOT NULL,
    "ocppConnectionName" character varying(255),
    "eventType" character varying(255),
    "timestamp" timestamp with time zone,
    "triggerReason" character varying(255),
    "seqNo" integer,
    offline boolean DEFAULT false,
    "numberOfPhasesUsed" integer,
    "cableMaxCurrent" numeric,
    "reservationId" integer,
    "transactionInfo" json,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "transactionDatabaseId" integer,
    "evseId" integer,
    "tenantId" integer DEFAULT 1 NOT NULL,
    "idTokenValue" character varying(255),
    "idTokenType" character varying(255)
);
CREATE SEQUENCE public."TransactionEvents_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."TransactionEvents_id_seq" OWNED BY public."TransactionEvents".id;
CREATE TABLE public."Transactions" (
    id integer NOT NULL,
    "ocppConnectionName" character varying(255),
    "transactionId" character varying(255),
    "isActive" boolean,
    "chargingState" character varying(255),
    "timeSpentCharging" bigint,
    "totalKwh" numeric,
    "stoppedReason" character varying(255),
    "remoteStartId" integer,
    "totalCost" numeric,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL,
    "locationId" integer,
    "evseId" integer,
    "connectorId" integer,
    "authorizationId" integer,
    "tariffId" integer,
    "startTime" timestamp with time zone,
    "endTime" timestamp with time zone,
    "customData" jsonb,
    "meterStart" numeric,
    "stationId" integer,
    "transactionLimit" jsonb,
    user_id integer
);
CREATE SEQUENCE public."Transactions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."Transactions_id_seq" OWNED BY public."Transactions".id;
CREATE TABLE public."UserBadges" (
    id integer NOT NULL,
    user_id integer NOT NULL,
    authorization_id integer NOT NULL
);
CREATE SEQUENCE public."UserBadges_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."UserBadges_id_seq" OWNED BY public."UserBadges".id;
CREATE TABLE public."Users" (
    id integer NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    role text DEFAULT 'User'::text NOT NULL,
    reset_token text,
    reset_token_expires timestamp with time zone
);
CREATE SEQUENCE public."Users_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."Users_id_seq" OWNED BY public."Users".id;
CREATE TABLE public."VariableAttributes" (
    id integer NOT NULL,
    "ocppConnectionName" character varying(255) NOT NULL,
    type character varying(255) DEFAULT 'Actual'::character varying,
    "dataType" character varying(255) DEFAULT 'string'::character varying,
    value character varying(4000),
    mutability character varying(255) DEFAULT 'ReadWrite'::character varying,
    persistent boolean DEFAULT false,
    constant boolean DEFAULT false,
    "generatedAt" timestamp with time zone,
    "variableId" integer,
    "componentId" integer,
    "evseDatabaseId" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "bootConfigId" character varying(255),
    "tenantId" integer DEFAULT 1 NOT NULL,
    "stationId" integer
);
CREATE SEQUENCE public."VariableAttributes_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."VariableAttributes_id_seq" OWNED BY public."VariableAttributes".id;
CREATE TABLE public."VariableCharacteristics" (
    id integer NOT NULL,
    unit character varying(255),
    "dataType" character varying(255),
    "minLimit" numeric,
    "maxLimit" numeric,
    "valuesList" character varying(4000),
    "supportsMonitoring" boolean,
    "variableId" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL
);
CREATE SEQUENCE public."VariableCharacteristics_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."VariableCharacteristics_id_seq" OWNED BY public."VariableCharacteristics".id;
CREATE TABLE public."VariableMonitoringStatuses" (
    id integer NOT NULL,
    status character varying(255),
    "statusInfo" json,
    "variableMonitoringId" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL
);
CREATE SEQUENCE public."VariableMonitoringStatuses_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."VariableMonitoringStatuses_id_seq" OWNED BY public."VariableMonitoringStatuses".id;
CREATE TABLE public."VariableMonitorings" (
    "databaseId" integer NOT NULL,
    "ocppConnectionName" character varying(255),
    id integer,
    transaction boolean,
    value integer,
    type character varying(255),
    severity integer,
    "variableId" integer,
    "componentId" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL,
    "eventNotificationType" character varying(255),
    "stationId" integer
);
CREATE SEQUENCE public."VariableMonitorings_databaseId_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."VariableMonitorings_databaseId_seq" OWNED BY public."VariableMonitorings"."databaseId";
CREATE TABLE public."VariableStatuses" (
    id integer NOT NULL,
    value character varying(4000),
    status character varying(255),
    "statusInfo" json,
    "variableAttributeId" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL
);
CREATE SEQUENCE public."VariableStatuses_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."VariableStatuses_id_seq" OWNED BY public."VariableStatuses".id;
CREATE TABLE public."Variables" (
    id integer NOT NULL,
    name character varying(255),
    instance character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "tenantId" integer DEFAULT 1 NOT NULL
);
CREATE SEQUENCE public."Variables_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public."Variables_id_seq" OWNED BY public."Variables".id;
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
ALTER TABLE ONLY public."Authorizations" ALTER COLUMN id SET DEFAULT nextval('public."Authorizations_id_seq"'::regclass);
ALTER TABLE ONLY public."Certificates" ALTER COLUMN id SET DEFAULT nextval('public."Certificates_id_seq"'::regclass);
ALTER TABLE ONLY public."ChangeConfigurations" ALTER COLUMN id SET DEFAULT nextval('public."ChangeConfigurations_id_seq"'::regclass);
ALTER TABLE ONLY public."ChargingNeeds" ALTER COLUMN id SET DEFAULT nextval('public."ChargingNeeds_id_seq"'::regclass);
ALTER TABLE ONLY public."ChargingProfiles" ALTER COLUMN "databaseId" SET DEFAULT nextval('public."ChargingProfiles_databaseId_seq"'::regclass);
ALTER TABLE ONLY public."ChargingSchedules" ALTER COLUMN "databaseId" SET DEFAULT nextval('public."ChargingSchedules_databaseId_seq"'::regclass);
ALTER TABLE ONLY public."ChargingStationSecurityInfos" ALTER COLUMN id SET DEFAULT nextval('public."ChargingStationSecurityInfos_id_seq"'::regclass);
ALTER TABLE ONLY public."ChargingStationSequences" ALTER COLUMN id SET DEFAULT nextval('public."ChargingStationSequences_id_seq"'::regclass);
ALTER TABLE ONLY public."Components" ALTER COLUMN id SET DEFAULT nextval('public."Components_id_seq"'::regclass);
ALTER TABLE ONLY public."CompositeSchedules" ALTER COLUMN id SET DEFAULT nextval('public."CompositeSchedules_id_seq"'::regclass);
ALTER TABLE ONLY public."Connectors" ALTER COLUMN id SET DEFAULT nextval('public."Connectors_id_seq"'::regclass);
ALTER TABLE ONLY public."DeleteCertificateAttempts" ALTER COLUMN id SET DEFAULT nextval('public."DeleteCertificateAttempts_id_seq"'::regclass);
ALTER TABLE ONLY public."EventData" ALTER COLUMN id SET DEFAULT nextval('public."EventData_id_seq"'::regclass);
ALTER TABLE ONLY public."EvseTypes" ALTER COLUMN "databaseId" SET DEFAULT nextval('public."EvseTypes_databaseId_seq"'::regclass);
ALTER TABLE ONLY public."Evses" ALTER COLUMN id SET DEFAULT nextval('public."Evses_id_seq"'::regclass);
ALTER TABLE ONLY public."InstallCertificateAttempts" ALTER COLUMN id SET DEFAULT nextval('public."InstallCertificateAttempts_id_seq"'::regclass);
ALTER TABLE ONLY public."InstalledCertificates" ALTER COLUMN id SET DEFAULT nextval('public."InstalledCertificates_id_seq"'::regclass);
ALTER TABLE ONLY public."LatestStatusNotifications" ALTER COLUMN id SET DEFAULT nextval('public."LatestStatusNotifications_id_seq"'::regclass);
ALTER TABLE ONLY public."LocalListAuthorizations" ALTER COLUMN id SET DEFAULT nextval('public."LocalListAuthorizations_id_seq"'::regclass);
ALTER TABLE ONLY public."LocalListVersions" ALTER COLUMN id SET DEFAULT nextval('public."LocalListVersions_id_seq"'::regclass);
ALTER TABLE ONLY public."Locations" ALTER COLUMN id SET DEFAULT nextval('public."Locations_id_seq"'::regclass);
ALTER TABLE ONLY public."MessageInfos" ALTER COLUMN "databaseId" SET DEFAULT nextval('public."MessageInfos_databaseId_seq"'::regclass);
ALTER TABLE ONLY public."MeterValues" ALTER COLUMN id SET DEFAULT nextval('public."MeterValues_id_seq"'::regclass);
ALTER TABLE ONLY public."OCPPMessages" ALTER COLUMN id SET DEFAULT nextval('public."OCPPMessages_id_seq"'::regclass);
ALTER TABLE ONLY public."Reservations" ALTER COLUMN "databaseId" SET DEFAULT nextval('public."Reservations_databaseId_seq"'::regclass);
ALTER TABLE ONLY public."SalesTariffs" ALTER COLUMN "databaseId" SET DEFAULT nextval('public."SalesTariffs_databaseId_seq"'::regclass);
ALTER TABLE ONLY public."SecurityEvents" ALTER COLUMN id SET DEFAULT nextval('public."SecurityEvents_id_seq"'::regclass);
ALTER TABLE ONLY public."SendLocalLists" ALTER COLUMN id SET DEFAULT nextval('public."SendLocalLists_id_seq"'::regclass);
ALTER TABLE ONLY public."SetNetworkProfiles" ALTER COLUMN id SET DEFAULT nextval('public."SetNetworkProfiles_id_seq"'::regclass);
ALTER TABLE ONLY public."StartTransactions" ALTER COLUMN id SET DEFAULT nextval('public."StartTransactions_id_seq"'::regclass);
ALTER TABLE ONLY public."StatusNotifications" ALTER COLUMN id SET DEFAULT nextval('public."StatusNotifications_id_seq"'::regclass);
ALTER TABLE ONLY public."StopTransactions" ALTER COLUMN id SET DEFAULT nextval('public."StopTransactions_id_seq"'::regclass);
ALTER TABLE ONLY public."Subscriptions" ALTER COLUMN id SET DEFAULT nextval('public."Subscriptions_id_seq"'::regclass);
ALTER TABLE ONLY public."Tariffs" ALTER COLUMN id SET DEFAULT nextval('public."Tariffs_id_seq"'::regclass);
ALTER TABLE ONLY public."TenantPartners" ALTER COLUMN id SET DEFAULT nextval('public."TenantPartners_id_seq"'::regclass);
ALTER TABLE ONLY public."Tenants" ALTER COLUMN id SET DEFAULT nextval('public."Tenants_id_seq"'::regclass);
ALTER TABLE ONLY public."TransactionEvents" ALTER COLUMN id SET DEFAULT nextval('public."TransactionEvents_id_seq"'::regclass);
ALTER TABLE ONLY public."Transactions" ALTER COLUMN id SET DEFAULT nextval('public."Transactions_id_seq"'::regclass);
ALTER TABLE ONLY public."UserBadges" ALTER COLUMN id SET DEFAULT nextval('public."UserBadges_id_seq"'::regclass);
ALTER TABLE ONLY public."Users" ALTER COLUMN id SET DEFAULT nextval('public."Users_id_seq"'::regclass);
ALTER TABLE ONLY public."VariableAttributes" ALTER COLUMN id SET DEFAULT nextval('public."VariableAttributes_id_seq"'::regclass);
ALTER TABLE ONLY public."VariableCharacteristics" ALTER COLUMN id SET DEFAULT nextval('public."VariableCharacteristics_id_seq"'::regclass);
ALTER TABLE ONLY public."VariableMonitoringStatuses" ALTER COLUMN id SET DEFAULT nextval('public."VariableMonitoringStatuses_id_seq"'::regclass);
ALTER TABLE ONLY public."VariableMonitorings" ALTER COLUMN "databaseId" SET DEFAULT nextval('public."VariableMonitorings_databaseId_seq"'::regclass);
ALTER TABLE ONLY public."VariableStatuses" ALTER COLUMN id SET DEFAULT nextval('public."VariableStatuses_id_seq"'::regclass);
ALTER TABLE ONLY public."Variables" ALTER COLUMN id SET DEFAULT nextval('public."Variables_id_seq"'::regclass);
ALTER TABLE ONLY public."AsyncJobStatuses"
    ADD CONSTRAINT "AsyncJobStatuses_pkey" PRIMARY KEY ("jobId");
ALTER TABLE ONLY public."Authorizations"
    ADD CONSTRAINT "Authorizations_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."Boots"
    ADD CONSTRAINT "Boots_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."ChargingStationNetworkProfiles"
    ADD CONSTRAINT "CSNP_stationId_websocketServerConfigId_key" UNIQUE ("stationId", "websocketServerConfigId");
ALTER TABLE ONLY public."Certificates"
    ADD CONSTRAINT "Certificates_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."Certificates"
    ADD CONSTRAINT "Certificates_serialNumber_issuerName_key" UNIQUE ("serialNumber", "issuerName");
ALTER TABLE ONLY public."ChangeConfigurations"
    ADD CONSTRAINT "ChangeConfigurations_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."ChangeConfigurations"
    ADD CONSTRAINT "ChangeConfigurations_stationId_tenantId_key" UNIQUE ("ocppConnectionName", "tenantId", key);
ALTER TABLE ONLY public."ChargingNeeds"
    ADD CONSTRAINT "ChargingNeeds_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."ChargingProfiles"
    ADD CONSTRAINT "ChargingProfiles_pkey" PRIMARY KEY ("databaseId");
ALTER TABLE ONLY public."ChargingProfiles"
    ADD CONSTRAINT "ChargingProfiles_stationId_tenantId_id" UNIQUE ("ocppConnectionName", "tenantId", id);
ALTER TABLE ONLY public."ChargingSchedules"
    ADD CONSTRAINT "ChargingSchedules_id_stationId_key" UNIQUE (id, "ocppConnectionName");
ALTER TABLE ONLY public."ChargingSchedules"
    ADD CONSTRAINT "ChargingSchedules_pkey" PRIMARY KEY ("databaseId");
ALTER TABLE ONLY public."ChargingSchedules"
    ADD CONSTRAINT "ChargingSchedules_stationId_tenantId_id" UNIQUE ("ocppConnectionName", "tenantId", id);
ALTER TABLE ONLY public."ChargingStationNetworkProfiles"
    ADD CONSTRAINT "ChargingStationNetworkProfiles_configurationSlot_key" UNIQUE ("configurationSlot");
ALTER TABLE ONLY public."ChargingStationSecurityInfos"
    ADD CONSTRAINT "ChargingStationSecurityInfos_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."ChargingStationSecurityInfos"
    ADD CONSTRAINT "ChargingStationSecurityInfos_stationName_tenantId" UNIQUE ("ocppConnectionName", "tenantId");
ALTER TABLE ONLY public."ChargingStationSequences"
    ADD CONSTRAINT "ChargingStationSequences_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."ChargingStations"
    ADD CONSTRAINT "ChargingStations_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."ChargingStations"
    ADD CONSTRAINT "ChargingStations_stationName_tenantId_key" UNIQUE ("ocppConnectionName", "tenantId");
ALTER TABLE ONLY public."ComponentVariables"
    ADD CONSTRAINT "ComponentVariables_pkey" PRIMARY KEY ("componentId", "variableId");
ALTER TABLE ONLY public."Components"
    ADD CONSTRAINT "Components_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."CompositeSchedules"
    ADD CONSTRAINT "CompositeSchedules_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."Connectors"
    ADD CONSTRAINT "Connectors_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."DeleteCertificateAttempts"
    ADD CONSTRAINT "DeleteCertificateAttempts_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."EventData"
    ADD CONSTRAINT "EventData_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."EventData"
    ADD CONSTRAINT "EventData_stationName_tenantId_eventId" UNIQUE ("ocppConnectionName", "tenantId", "eventId");
ALTER TABLE ONLY public."EvseTypes"
    ADD CONSTRAINT "EvseTypes_pkey" PRIMARY KEY ("databaseId");
ALTER TABLE ONLY public."Evses"
    ADD CONSTRAINT "Evses_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."InstallCertificateAttempts"
    ADD CONSTRAINT "InstallCertificateAttempts_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."InstalledCertificates"
    ADD CONSTRAINT "InstalledCertificates_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."LatestStatusNotifications"
    ADD CONSTRAINT "LatestStatusNotifications_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."LocalListAuthorizations"
    ADD CONSTRAINT "LocalListAuthorizations_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."LocalListVersionAuthorizations"
    ADD CONSTRAINT "LocalListVersionAuthorizations_pkey" PRIMARY KEY ("localListVersionId", "authorizationId");
ALTER TABLE ONLY public."LocalListVersions"
    ADD CONSTRAINT "LocalListVersions_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."LocalListVersions"
    ADD CONSTRAINT "LocalListVersions_stationId_tenantId" UNIQUE ("ocppConnectionName", "tenantId");
ALTER TABLE ONLY public."Locations"
    ADD CONSTRAINT "Locations_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."MessageInfos"
    ADD CONSTRAINT "MessageInfos_pkey" PRIMARY KEY ("databaseId");
ALTER TABLE ONLY public."MessageInfos"
    ADD CONSTRAINT "MessageInfos_stationId_tenantId_id" UNIQUE ("ocppConnectionName", "tenantId", id);
ALTER TABLE ONLY public."MeterValues"
    ADD CONSTRAINT "MeterValues_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."OCPPMessages"
    ADD CONSTRAINT "OCPPMessages_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."Reservations"
    ADD CONSTRAINT "Reservations_pkey" PRIMARY KEY ("databaseId");
ALTER TABLE ONLY public."Reservations"
    ADD CONSTRAINT "Reservations_stationId_tenantId_id" UNIQUE ("ocppConnectionName", "tenantId", id);
ALTER TABLE ONLY public."SalesTariffs"
    ADD CONSTRAINT "SalesTariffs_id_chargingScheduleDatabaseId_key" UNIQUE (id, "chargingScheduleDatabaseId");
ALTER TABLE ONLY public."SalesTariffs"
    ADD CONSTRAINT "SalesTariffs_pkey" PRIMARY KEY ("databaseId");
ALTER TABLE ONLY public."SecurityEvents"
    ADD CONSTRAINT "SecurityEvents_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."SendLocalListAuthorizations"
    ADD CONSTRAINT "SendLocalListAuthorizations_pkey" PRIMARY KEY ("sendLocalListId", "authorizationId");
ALTER TABLE ONLY public."SendLocalLists"
    ADD CONSTRAINT "SendLocalLists_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."SequelizeMeta"
    ADD CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY (name);
ALTER TABLE ONLY public."ServerNetworkProfiles"
    ADD CONSTRAINT "ServerNetworkProfiles_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."SetNetworkProfiles"
    ADD CONSTRAINT "SetNetworkProfiles_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."StartTransactions"
    ADD CONSTRAINT "StartTransactions_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."StartTransactions"
    ADD CONSTRAINT "StartTransactions_transactionDatabaseId_key" UNIQUE ("transactionDatabaseId");
ALTER TABLE ONLY public."StatusNotifications"
    ADD CONSTRAINT "StatusNotifications_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."StopTransactions"
    ADD CONSTRAINT "StopTransactions_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."StopTransactions"
    ADD CONSTRAINT "StopTransactions_transactionDatabaseId_key" UNIQUE ("transactionDatabaseId");
ALTER TABLE ONLY public."Subscriptions"
    ADD CONSTRAINT "Subscriptions_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."Tariffs"
    ADD CONSTRAINT "Tariffs_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."TenantPartners"
    ADD CONSTRAINT "TenantPartners_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."Tenants"
    ADD CONSTRAINT "Tenants_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."TransactionEvents"
    ADD CONSTRAINT "TransactionEvents_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."Transactions"
    ADD CONSTRAINT "Transactions_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."UserBadges"
    ADD CONSTRAINT "UserBadges_authorization_id_key" UNIQUE (authorization_id);
ALTER TABLE ONLY public."UserBadges"
    ADD CONSTRAINT "UserBadges_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."Users"
    ADD CONSTRAINT "Users_email_key" UNIQUE (email);
ALTER TABLE ONLY public."Users"
    ADD CONSTRAINT "Users_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."VariableAttributes"
    ADD CONSTRAINT "VariableAttributes_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."VariableCharacteristics"
    ADD CONSTRAINT "VariableCharacteristics_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."VariableCharacteristics"
    ADD CONSTRAINT "VariableCharacteristics_variableId_key" UNIQUE ("variableId");
ALTER TABLE ONLY public."VariableMonitoringStatuses"
    ADD CONSTRAINT "VariableMonitoringStatuses_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."VariableMonitorings"
    ADD CONSTRAINT "VariableMonitorings_pkey" PRIMARY KEY ("databaseId");
ALTER TABLE ONLY public."VariableMonitorings"
    ADD CONSTRAINT "VariableMonitorings_stationName_tenantId_id" UNIQUE ("ocppConnectionName", "tenantId", id);
ALTER TABLE ONLY public."VariableStatuses"
    ADD CONSTRAINT "VariableStatuses_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."Variables"
    ADD CONSTRAINT "Variables_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."Components"
    ADD CONSTRAINT "components_tenantId_name_instance" UNIQUE ("tenantId", name, instance);
ALTER TABLE ONLY public."EvseTypes"
    ADD CONSTRAINT "evse_types_tenantId_id_connectorId" UNIQUE ("tenantId", id, "connectorId");
ALTER TABLE ONLY public."ChargingStationNetworkProfiles"
    ADD CONSTRAINT "stationId_configurationSlot" UNIQUE ("stationId", "configurationSlot");
ALTER TABLE ONLY public."Connectors"
    ADD CONSTRAINT "stationId_connectorId" UNIQUE ("stationId", "connectorId");
ALTER TABLE ONLY public."Evses"
    ADD CONSTRAINT "stationId_evseTypeId" UNIQUE ("stationId", "evseTypeId");
ALTER TABLE ONLY public."Transactions"
    ADD CONSTRAINT "stationId_transactionId" UNIQUE ("stationId", "transactionId");
ALTER TABLE ONLY public."ChargingStationSequences"
    ADD CONSTRAINT "stationId_type" UNIQUE ("stationId", type);
ALTER TABLE ONLY public."VariableAttributes"
    ADD CONSTRAINT "stationId_type_variableId_componentId" UNIQUE ("stationId", type, "variableId", "componentId");
ALTER TABLE ONLY public."Tariffs"
    ADD CONSTRAINT "tariffId_tenantId" UNIQUE ("tariffId", "tenantId");
ALTER TABLE ONLY public."Certificates"
    ADD CONSTRAINT "tenantId_certificateFileHash" UNIQUE ("tenantId", "certificateFileHash");
ALTER TABLE ONLY public."Certificates"
    ADD CONSTRAINT "tenantId_serialNumber_issuerName" UNIQUE ("tenantId", "serialNumber", "issuerName");
ALTER TABLE ONLY public."Variables"
    ADD CONSTRAINT "variables_tenantId_name_instance" UNIQUE ("tenantId", name, instance);
CREATE UNIQUE INDEX "components_tenantId_name" ON public."Components" USING btree ("tenantId", name) WHERE (instance IS NULL);
CREATE INDEX event_data_station_id ON public."EventData" USING btree ("ocppConnectionName");
CREATE UNIQUE INDEX "evse_types_tenantId_id" ON public."EvseTypes" USING btree ("tenantId", id) WHERE ("connectorId" IS NULL);
CREATE UNIQUE INDEX "idToken_type" ON public."Authorizations" USING btree ("tenantId", "idToken", "idTokenType");
CREATE INDEX idx_charging_stations_latest_ocpp_message_timestamp ON public."ChargingStations" USING btree ("latestOcppMessageTimestamp");
CREATE INDEX idx_ocpp_messages_request_message_id ON public."OCPPMessages" USING btree ("requestMessageId");
CREATE INDEX message_infos_station_id ON public."MessageInfos" USING btree ("ocppConnectionName");
CREATE INDEX o_c_p_p_messages_correlation_id ON public."OCPPMessages" USING btree ("correlationId");
CREATE INDEX o_c_p_p_messages_station_id ON public."OCPPMessages" USING btree ("ocppConnectionName");
CREATE INDEX security_events_station_id ON public."SecurityEvents" USING btree ("ocppConnectionName");
CREATE UNIQUE INDEX "set_network_profiles_stationPkId_correlationId" ON public."SetNetworkProfiles" USING btree ("stationId", "correlationId");
CREATE INDEX subscriptions_station_id ON public."Subscriptions" USING btree ("ocppConnectionName");
CREATE UNIQUE INDEX "variable_attributes_stationId" ON public."VariableAttributes" USING btree ("stationId") WHERE ((type IS NULL) AND ("variableId" IS NULL) AND ("componentId" IS NULL));
CREATE UNIQUE INDEX "variable_attributes_stationId_componentId" ON public."VariableAttributes" USING btree ("stationId", "componentId") WHERE ((type IS NULL) AND ("variableId" IS NULL));
CREATE UNIQUE INDEX "variable_attributes_stationId_type" ON public."VariableAttributes" USING btree ("stationId", type) WHERE (("variableId" IS NULL) AND ("componentId" IS NULL));
CREATE UNIQUE INDEX "variable_attributes_stationId_type_componentId" ON public."VariableAttributes" USING btree ("stationId", type, "componentId") WHERE ("variableId" IS NULL);
CREATE UNIQUE INDEX "variable_attributes_stationId_type_variableId" ON public."VariableAttributes" USING btree ("stationId", type, "variableId") WHERE ("componentId" IS NULL);
CREATE UNIQUE INDEX "variable_attributes_stationId_variableId" ON public."VariableAttributes" USING btree ("stationId", "variableId") WHERE ((type IS NULL) AND ("componentId" IS NULL));
CREATE UNIQUE INDEX "variable_attributes_stationId_variableId_componentId" ON public."VariableAttributes" USING btree ("stationId", "variableId", "componentId") WHERE (type IS NULL);
CREATE INDEX variable_monitorings_station_id ON public."VariableMonitorings" USING btree ("ocppConnectionName");
CREATE UNIQUE INDEX "variables_tenantId_name" ON public."Variables" USING btree ("tenantId", name) WHERE (instance IS NULL);
CREATE TRIGGER trigger_link_user_to_transaction BEFORE INSERT OR UPDATE ON public."Transactions" FOR EACH ROW EXECUTE FUNCTION public.link_user_to_transaction();
CREATE TRIGGER trigger_populate_chargingstationnetworkprofiles_station_id BEFORE INSERT OR UPDATE ON public."ChargingStationNetworkProfiles" FOR EACH ROW WHEN ((new."stationId" IS NULL)) EXECUTE FUNCTION public.populate_station_id();
CREATE TRIGGER trigger_populate_chargingstationsecurityinfos_station_id BEFORE INSERT OR UPDATE ON public."ChargingStationSecurityInfos" FOR EACH ROW WHEN ((new."stationId" IS NULL)) EXECUTE FUNCTION public.populate_station_id();
CREATE TRIGGER trigger_populate_chargingstationsequences_station_id BEFORE INSERT OR UPDATE ON public."ChargingStationSequences" FOR EACH ROW WHEN ((new."stationId" IS NULL)) EXECUTE FUNCTION public.populate_station_id();
CREATE TRIGGER trigger_populate_connectors_station_id BEFORE INSERT OR UPDATE ON public."Connectors" FOR EACH ROW WHEN ((new."stationId" IS NULL)) EXECUTE FUNCTION public.populate_station_id();
CREATE TRIGGER trigger_populate_deletecertificateattempts_station_id BEFORE INSERT OR UPDATE ON public."DeleteCertificateAttempts" FOR EACH ROW WHEN ((new."stationId" IS NULL)) EXECUTE FUNCTION public.populate_station_id();
CREATE TRIGGER trigger_populate_eventdata_station_id BEFORE INSERT OR UPDATE ON public."EventData" FOR EACH ROW WHEN ((new."stationId" IS NULL)) EXECUTE FUNCTION public.populate_station_id();
CREATE TRIGGER trigger_populate_evses_station_id BEFORE INSERT OR UPDATE ON public."Evses" FOR EACH ROW WHEN ((new."stationId" IS NULL)) EXECUTE FUNCTION public.populate_station_id();
CREATE TRIGGER trigger_populate_installcertificateattempts_station_id BEFORE INSERT OR UPDATE ON public."InstallCertificateAttempts" FOR EACH ROW WHEN ((new."stationId" IS NULL)) EXECUTE FUNCTION public.populate_station_id();
CREATE TRIGGER trigger_populate_installedcertificates_station_id BEFORE INSERT OR UPDATE ON public."InstalledCertificates" FOR EACH ROW WHEN ((new."stationId" IS NULL)) EXECUTE FUNCTION public.populate_station_id();
CREATE TRIGGER trigger_populate_lateststatusnotifications_station_id BEFORE INSERT OR UPDATE ON public."LatestStatusNotifications" FOR EACH ROW WHEN ((new."stationId" IS NULL)) EXECUTE FUNCTION public.populate_station_id();
CREATE TRIGGER trigger_populate_ocppmessages_station_id BEFORE INSERT OR UPDATE ON public."OCPPMessages" FOR EACH ROW WHEN ((new."stationId" IS NULL)) EXECUTE FUNCTION public.populate_station_id();
CREATE TRIGGER trigger_populate_setnetworkprofiles_station_id BEFORE INSERT OR UPDATE ON public."SetNetworkProfiles" FOR EACH ROW WHEN ((new."stationId" IS NULL)) EXECUTE FUNCTION public.populate_station_id();
CREATE TRIGGER trigger_populate_statusnotifications_station_id BEFORE INSERT OR UPDATE ON public."StatusNotifications" FOR EACH ROW WHEN ((new."stationId" IS NULL)) EXECUTE FUNCTION public.populate_station_id();
CREATE TRIGGER trigger_populate_transactions_station_id BEFORE INSERT OR UPDATE ON public."Transactions" FOR EACH ROW WHEN ((new."stationId" IS NULL)) EXECUTE FUNCTION public.populate_station_id();
CREATE TRIGGER trigger_populate_variableattributes_station_id BEFORE INSERT OR UPDATE ON public."VariableAttributes" FOR EACH ROW WHEN ((new."stationId" IS NULL)) EXECUTE FUNCTION public.populate_station_id();
CREATE TRIGGER trigger_populate_variablemonitorings_station_id BEFORE INSERT OR UPDATE ON public."VariableMonitorings" FOR EACH ROW WHEN ((new."stationId" IS NULL)) EXECUTE FUNCTION public.populate_station_id();
ALTER TABLE ONLY public."AsyncJobStatuses"
    ADD CONSTRAINT "AsyncJobStatuses_tenantPartnerId_fkey" FOREIGN KEY ("tenantPartnerId") REFERENCES public."TenantPartners"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."Authorizations"
    ADD CONSTRAINT "Authorizations_groupAuthorizationId_fkey" FOREIGN KEY ("groupAuthorizationId") REFERENCES public."Authorizations"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."Authorizations"
    ADD CONSTRAINT "Authorizations_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES public."Tariffs"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."Authorizations"
    ADD CONSTRAINT "Authorizations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."Authorizations"
    ADD CONSTRAINT "Authorizations_tenantPartnerId_fkey" FOREIGN KEY ("tenantPartnerId") REFERENCES public."TenantPartners"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."Boots"
    ADD CONSTRAINT "Boots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."Certificates"
    ADD CONSTRAINT "Certificates_signedBy_fkey" FOREIGN KEY ("signedBy") REFERENCES public."Certificates"(id) ON UPDATE CASCADE;
ALTER TABLE ONLY public."Certificates"
    ADD CONSTRAINT "Certificates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."ChangeConfigurations"
    ADD CONSTRAINT "ChangeConfigurations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."ChargingNeeds"
    ADD CONSTRAINT "ChargingNeeds_evseId_fkey" FOREIGN KEY ("evseId") REFERENCES public."Evses"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."ChargingNeeds"
    ADD CONSTRAINT "ChargingNeeds_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."ChargingNeeds"
    ADD CONSTRAINT "ChargingNeeds_transactionDatabaseId_fkey" FOREIGN KEY ("transactionDatabaseId") REFERENCES public."Transactions"(id) ON UPDATE CASCADE;
ALTER TABLE ONLY public."ChargingProfiles"
    ADD CONSTRAINT "ChargingProfiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."ChargingProfiles"
    ADD CONSTRAINT "ChargingProfiles_transactionDatabaseId_fkey" FOREIGN KEY ("transactionDatabaseId") REFERENCES public."Transactions"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."ChargingSchedules"
    ADD CONSTRAINT "ChargingSchedules_chargingProfileDatabaseId_fkey" FOREIGN KEY ("chargingProfileDatabaseId") REFERENCES public."ChargingProfiles"("databaseId") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."ChargingSchedules"
    ADD CONSTRAINT "ChargingSchedules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."ChargingStationNetworkProfiles"
    ADD CONSTRAINT "ChargingStationNetworkProfiles_setNetworkProfileId_fkey" FOREIGN KEY ("setNetworkProfileId") REFERENCES public."SetNetworkProfiles"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."ChargingStationNetworkProfiles"
    ADD CONSTRAINT "ChargingStationNetworkProfiles_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES public."ChargingStations"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."ChargingStationNetworkProfiles"
    ADD CONSTRAINT "ChargingStationNetworkProfiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."ChargingStationNetworkProfiles"
    ADD CONSTRAINT "ChargingStationNetworkProfiles_websocketServerConfigId_fkey" FOREIGN KEY ("websocketServerConfigId") REFERENCES public."ServerNetworkProfiles"(id) ON UPDATE CASCADE;
ALTER TABLE ONLY public."ChargingStationSecurityInfos"
    ADD CONSTRAINT "ChargingStationSecurityInfos_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES public."ChargingStations"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."ChargingStationSecurityInfos"
    ADD CONSTRAINT "ChargingStationSecurityInfos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."ChargingStationSequences"
    ADD CONSTRAINT "ChargingStationSequences_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES public."ChargingStations"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."ChargingStationSequences"
    ADD CONSTRAINT "ChargingStationSequences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."ChargingStations"
    ADD CONSTRAINT "ChargingStations_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES public."Locations"(id) ON UPDATE CASCADE;
ALTER TABLE ONLY public."ChargingStations"
    ADD CONSTRAINT "ChargingStations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."ComponentVariables"
    ADD CONSTRAINT "ComponentVariables_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES public."Components"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."ComponentVariables"
    ADD CONSTRAINT "ComponentVariables_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."ComponentVariables"
    ADD CONSTRAINT "ComponentVariables_variableId_fkey" FOREIGN KEY ("variableId") REFERENCES public."Variables"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."Components"
    ADD CONSTRAINT "Components_evseTypeId_fkey" FOREIGN KEY ("evseDatabaseId") REFERENCES public."EvseTypes"("databaseId") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."Components"
    ADD CONSTRAINT "Components_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."CompositeSchedules"
    ADD CONSTRAINT "CompositeSchedules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."Connectors"
    ADD CONSTRAINT "Connectors_evseId_fkey" FOREIGN KEY ("evseId") REFERENCES public."Evses"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."Connectors"
    ADD CONSTRAINT "Connectors_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES public."ChargingStations"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."Connectors"
    ADD CONSTRAINT "Connectors_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES public."Tariffs"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."Connectors"
    ADD CONSTRAINT "Connectors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."DeleteCertificateAttempts"
    ADD CONSTRAINT "DeleteCertificateAttempts_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES public."ChargingStations"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."DeleteCertificateAttempts"
    ADD CONSTRAINT "DeleteCertificateAttempts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."EventData"
    ADD CONSTRAINT "EventData_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES public."Components"(id) ON UPDATE CASCADE;
ALTER TABLE ONLY public."EventData"
    ADD CONSTRAINT "EventData_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES public."ChargingStations"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."EventData"
    ADD CONSTRAINT "EventData_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."EventData"
    ADD CONSTRAINT "EventData_variableId_fkey" FOREIGN KEY ("variableId") REFERENCES public."Variables"(id) ON UPDATE CASCADE;
ALTER TABLE ONLY public."EvseTypes"
    ADD CONSTRAINT "EvseTypes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."Evses"
    ADD CONSTRAINT "Evses_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES public."ChargingStations"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."Evses"
    ADD CONSTRAINT "Evses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."InstallCertificateAttempts"
    ADD CONSTRAINT "InstallCertificateAttempts_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES public."Certificates"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."InstallCertificateAttempts"
    ADD CONSTRAINT "InstallCertificateAttempts_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES public."ChargingStations"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."InstallCertificateAttempts"
    ADD CONSTRAINT "InstallCertificateAttempts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."InstalledCertificates"
    ADD CONSTRAINT "InstalledCertificates_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES public."Certificates"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."InstalledCertificates"
    ADD CONSTRAINT "InstalledCertificates_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES public."ChargingStations"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."InstalledCertificates"
    ADD CONSTRAINT "InstalledCertificates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."LatestStatusNotifications"
    ADD CONSTRAINT "LatestStatusNotifications_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES public."ChargingStations"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."LatestStatusNotifications"
    ADD CONSTRAINT "LatestStatusNotifications_statusNotificationId_fkey" FOREIGN KEY ("statusNotificationId") REFERENCES public."StatusNotifications"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."LatestStatusNotifications"
    ADD CONSTRAINT "LatestStatusNotifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."LocalListAuthorizations"
    ADD CONSTRAINT "LocalListAuthorizations_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES public."Authorizations"(id) ON UPDATE CASCADE;
ALTER TABLE ONLY public."LocalListAuthorizations"
    ADD CONSTRAINT "LocalListAuthorizations_groupAuthorizationId_fkey" FOREIGN KEY ("groupAuthorizationId") REFERENCES public."Authorizations"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."LocalListAuthorizations"
    ADD CONSTRAINT "LocalListAuthorizations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."LocalListVersionAuthorizations"
    ADD CONSTRAINT "LocalListVersionAuthorizations_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES public."LocalListAuthorizations"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."LocalListVersionAuthorizations"
    ADD CONSTRAINT "LocalListVersionAuthorizations_localListVersionId_fkey" FOREIGN KEY ("localListVersionId") REFERENCES public."LocalListVersions"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."LocalListVersionAuthorizations"
    ADD CONSTRAINT "LocalListVersionAuthorizations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."LocalListVersions"
    ADD CONSTRAINT "LocalListVersions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."Locations"
    ADD CONSTRAINT "Locations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."MessageInfos"
    ADD CONSTRAINT "MessageInfos_displayComponentId_fkey" FOREIGN KEY ("displayComponentId") REFERENCES public."Components"(id) ON UPDATE CASCADE;
ALTER TABLE ONLY public."MessageInfos"
    ADD CONSTRAINT "MessageInfos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."MeterValues"
    ADD CONSTRAINT "MeterValues_stopTransactionDatabaseId_fkey" FOREIGN KEY ("stopTransactionDatabaseId") REFERENCES public."StopTransactions"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."MeterValues"
    ADD CONSTRAINT "MeterValues_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES public."Tariffs"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."MeterValues"
    ADD CONSTRAINT "MeterValues_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."MeterValues"
    ADD CONSTRAINT "MeterValues_transactionDatabaseId_fkey" FOREIGN KEY ("transactionDatabaseId") REFERENCES public."Transactions"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."MeterValues"
    ADD CONSTRAINT "MeterValues_transactionEventId_fkey" FOREIGN KEY ("transactionEventId") REFERENCES public."TransactionEvents"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."OCPPMessages"
    ADD CONSTRAINT "OCPPMessages_requestMessageId_fkey" FOREIGN KEY ("requestMessageId") REFERENCES public."OCPPMessages"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."OCPPMessages"
    ADD CONSTRAINT "OCPPMessages_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES public."ChargingStations"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."OCPPMessages"
    ADD CONSTRAINT "OCPPMessages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."Reservations"
    ADD CONSTRAINT "Reservations_evseTypeId_fkey" FOREIGN KEY ("evseId") REFERENCES public."EvseTypes"("databaseId") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."Reservations"
    ADD CONSTRAINT "Reservations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."SalesTariffs"
    ADD CONSTRAINT "SalesTariffs_chargingScheduleDatabaseId_fkey" FOREIGN KEY ("chargingScheduleDatabaseId") REFERENCES public."ChargingSchedules"("databaseId") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."SalesTariffs"
    ADD CONSTRAINT "SalesTariffs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."SecurityEvents"
    ADD CONSTRAINT "SecurityEvents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."SendLocalListAuthorizations"
    ADD CONSTRAINT "SendLocalListAuthorizations_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES public."LocalListAuthorizations"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."SendLocalListAuthorizations"
    ADD CONSTRAINT "SendLocalListAuthorizations_sendLocalListId_fkey" FOREIGN KEY ("sendLocalListId") REFERENCES public."SendLocalLists"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."SendLocalListAuthorizations"
    ADD CONSTRAINT "SendLocalListAuthorizations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."SendLocalLists"
    ADD CONSTRAINT "SendLocalLists_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."ServerNetworkProfiles"
    ADD CONSTRAINT "ServerNetworkProfiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."SetNetworkProfiles"
    ADD CONSTRAINT "SetNetworkProfiles_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES public."ChargingStations"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."SetNetworkProfiles"
    ADD CONSTRAINT "SetNetworkProfiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."SetNetworkProfiles"
    ADD CONSTRAINT "SetNetworkProfiles_websocketServerConfigId_fkey" FOREIGN KEY ("websocketServerConfigId") REFERENCES public."ServerNetworkProfiles"(id) ON UPDATE CASCADE;
ALTER TABLE ONLY public."StartTransactions"
    ADD CONSTRAINT "StartTransactions_connectorDatabaseId_fkey" FOREIGN KEY ("connectorDatabaseId") REFERENCES public."Connectors"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."StartTransactions"
    ADD CONSTRAINT "StartTransactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."StartTransactions"
    ADD CONSTRAINT "StartTransactions_transactionDatabaseId_fkey" FOREIGN KEY ("transactionDatabaseId") REFERENCES public."Transactions"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."StatusNotifications"
    ADD CONSTRAINT "StatusNotifications_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES public."ChargingStations"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."StatusNotifications"
    ADD CONSTRAINT "StatusNotifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."StopTransactions"
    ADD CONSTRAINT "StopTransactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."StopTransactions"
    ADD CONSTRAINT "StopTransactions_transactionDatabaseId_fkey" FOREIGN KEY ("transactionDatabaseId") REFERENCES public."Transactions"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."Subscriptions"
    ADD CONSTRAINT "Subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."Tariffs"
    ADD CONSTRAINT "Tariffs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."TenantPartners"
    ADD CONSTRAINT "TenantPartners_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."TransactionEvents"
    ADD CONSTRAINT "TransactionEvents_evseTypeId_fkey" FOREIGN KEY ("evseId") REFERENCES public."EvseTypes"("databaseId") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."TransactionEvents"
    ADD CONSTRAINT "TransactionEvents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."TransactionEvents"
    ADD CONSTRAINT "TransactionEvents_transactionDatabaseId_fkey" FOREIGN KEY ("transactionDatabaseId") REFERENCES public."Transactions"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."Transactions"
    ADD CONSTRAINT "Transactions_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES public."Authorizations"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."Transactions"
    ADD CONSTRAINT "Transactions_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES public."Connectors"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."Transactions"
    ADD CONSTRAINT "Transactions_evseId_fkey" FOREIGN KEY ("evseId") REFERENCES public."Evses"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."Transactions"
    ADD CONSTRAINT "Transactions_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES public."Locations"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."Transactions"
    ADD CONSTRAINT "Transactions_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES public."ChargingStations"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."Transactions"
    ADD CONSTRAINT "Transactions_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES public."Tariffs"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."Transactions"
    ADD CONSTRAINT "Transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."Transactions"
    ADD CONSTRAINT "Transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."Users"(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public."UserBadges"
    ADD CONSTRAINT "UserBadges_authorization_id_fkey" FOREIGN KEY (authorization_id) REFERENCES public."Authorizations"(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public."UserBadges"
    ADD CONSTRAINT "UserBadges_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."Users"(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public."VariableAttributes"
    ADD CONSTRAINT "VariableAttributes_bootConfigId_fkey" FOREIGN KEY ("bootConfigId") REFERENCES public."Boots"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."VariableAttributes"
    ADD CONSTRAINT "VariableAttributes_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES public."Components"(id) ON UPDATE CASCADE;
ALTER TABLE ONLY public."VariableAttributes"
    ADD CONSTRAINT "VariableAttributes_evseTypeId_fkey" FOREIGN KEY ("evseDatabaseId") REFERENCES public."EvseTypes"("databaseId") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."VariableAttributes"
    ADD CONSTRAINT "VariableAttributes_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES public."ChargingStations"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."VariableAttributes"
    ADD CONSTRAINT "VariableAttributes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."VariableAttributes"
    ADD CONSTRAINT "VariableAttributes_variableId_fkey" FOREIGN KEY ("variableId") REFERENCES public."Variables"(id) ON UPDATE CASCADE;
ALTER TABLE ONLY public."VariableCharacteristics"
    ADD CONSTRAINT "VariableCharacteristics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."VariableCharacteristics"
    ADD CONSTRAINT "VariableCharacteristics_variableId_fkey" FOREIGN KEY ("variableId") REFERENCES public."Variables"(id) ON UPDATE CASCADE;
ALTER TABLE ONLY public."VariableMonitoringStatuses"
    ADD CONSTRAINT "VariableMonitoringStatuses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."VariableMonitoringStatuses"
    ADD CONSTRAINT "VariableMonitoringStatuses_variableMonitoringId_fkey" FOREIGN KEY ("variableMonitoringId") REFERENCES public."VariableMonitorings"("databaseId") ON UPDATE CASCADE;
ALTER TABLE ONLY public."VariableMonitorings"
    ADD CONSTRAINT "VariableMonitorings_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES public."Components"(id) ON UPDATE CASCADE;
ALTER TABLE ONLY public."VariableMonitorings"
    ADD CONSTRAINT "VariableMonitorings_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES public."ChargingStations"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."VariableMonitorings"
    ADD CONSTRAINT "VariableMonitorings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."VariableMonitorings"
    ADD CONSTRAINT "VariableMonitorings_variableId_fkey" FOREIGN KEY ("variableId") REFERENCES public."Variables"(id) ON UPDATE CASCADE;
ALTER TABLE ONLY public."VariableStatuses"
    ADD CONSTRAINT "VariableStatuses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."VariableStatuses"
    ADD CONSTRAINT "VariableStatuses_variableAttributeId_fkey" FOREIGN KEY ("variableAttributeId") REFERENCES public."VariableAttributes"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."Variables"
    ADD CONSTRAINT "Variables_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenants"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
