-- 1. Évolution de la table Transaction pour l'Idle Detection
ALTER TABLE "Transactions" 
ADD COLUMN is_legal BOOLEAN DEFAULT TRUE NOT NULL,
ADD COLUMN overtime_start_timestamp TIMESTAMP WITH TIME ZONE;

-- 2. Création de la table Power Blocks pour le Smart Charging
CREATE TABLE "PowerBlocks" (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    max_kw NUMERIC(6, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. Liaison des bornes de recharge à leur bloc de puissance respectif
ALTER TABLE "ChargingStations" 
ADD COLUMN power_block_id INTEGER REFERENCES "PowerBlocks"(id) ON DELETE SET NULL;
