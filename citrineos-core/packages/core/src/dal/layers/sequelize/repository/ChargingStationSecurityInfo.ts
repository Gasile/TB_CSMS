// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
import { SequelizeRepository } from './Base.js';
import { ChargingStationSecurityInfo } from '../model/ChargingStationSecurityInfo.js';
import type { ILogObj } from 'tslog';
import { Logger } from 'tslog';
import { Sequelize } from 'sequelize-typescript';
import type { BootstrapConfig } from '@citrineos/base';
import type { IChargingStationSecurityInfoRepository } from '../../../interfaces/repositories.js';

export class SequelizeChargingStationSecurityInfoRepository
  extends SequelizeRepository<ChargingStationSecurityInfo>
  implements IChargingStationSecurityInfoRepository
{
  constructor(config: BootstrapConfig, logger?: Logger<ILogObj>, sequelizeInstance?: Sequelize) {
    super(config, ChargingStationSecurityInfo.MODEL_NAME, logger, sequelizeInstance);
  }

  async readChargingStationPublicKeyFileId(
    tenantId: number,
    ocppConnectionName: string,
  ): Promise<string> {
    const existingInfo = await this.readOnlyOneByQuery(tenantId, {
      where: { ocppConnectionName: ocppConnectionName },
    });
    return existingInfo ? existingInfo.publicKeyFileId : '';
  }

  async readOrCreateChargingStationInfo(
    tenantId: number,
    ocppConnectionName: string,
    publicKeyFileId: string,
  ): Promise<void> {
    await this.readOrCreateByQuery(tenantId, {
      where: {
        tenantId,
        ocppConnectionName: ocppConnectionName,
      },
      defaults: {
        publicKeyFileId,
      },
    });
  }
}
