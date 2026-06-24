// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
export class UpsertTariffRequest {
  id!: number;
  currency!: string;

  pricePerKwh!: number;
  pricePerMin?: number;
  pricePerSession?: number;
  taxRate?: number;

  authorizationAmount?: number;
  paymentFee?: number;

  // OCPP 2.1 TariffType fields
  tariffId?: string;
  validFrom?: string;
  description?: any[];
  energy?: any;
  chargingTime?: any;
  idleTime?: any;
  fixedFee?: any;
  reservationTime?: any;
  reservationFixed?: any;
  minCost?: any;
  maxCost?: any;
}
