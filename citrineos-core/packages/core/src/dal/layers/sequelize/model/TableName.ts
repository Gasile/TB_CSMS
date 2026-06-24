// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
export const TableName = {
  SecurityEvents: 'SecurityEvents',
} as const;

export type TableName = (typeof TableName)[keyof typeof TableName];
