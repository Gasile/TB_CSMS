CREATE TABLE "UnknownBadges" (
    "id_token" TEXT PRIMARY KEY,
    "station_id" TEXT,
    "last_seen" TIMESTAMP WITH TIME ZONE DEFAULT now(),
    "attempt_count" INTEGER DEFAULT 1
);
