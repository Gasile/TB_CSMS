// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
import type { ILogObj } from 'tslog';
import { Logger } from 'tslog';
import type { IMessage } from './Message.js';
import type { IMessageHandler } from './MessageHandler.js';
import { OcppError } from '@ocpp/rpc/message.js';
import type { OcppRequest, OcppResponse } from '@ocpp/internal-types.js';
import type { CallAction } from '@ocpp/rpc/message.js';
import type { IModule } from '@interfaces/modules/Module.js';
import type { HandlerProperties } from '@interfaces/messages/internal-types.js';

/**
 * Abstract class implementing {@link IMessageHandler}.
 */
export abstract class AbstractMessageHandler implements IMessageHandler {
  /**
   * Fields
   */

  protected _module?: IModule;
  protected _logger: Logger<ILogObj>;

  /**
   * Constructor
   *
   * @param config The system configuration.
   * @param logger [Optional] The logger to use.
   */
  constructor(logger?: Logger<ILogObj>, module?: IModule) {
    this._module = module;
    this._logger = logger
      ? logger.getSubLogger({ name: this.constructor.name })
      : new Logger<ILogObj>({ name: this.constructor.name });
  }

  /**
   * Getter & Setter
   */

  get module(): IModule | undefined {
    return this._module;
  }
  set module(value: IModule | undefined) {
    this._module = value;
  }

  /**
   * Methods
   */

  async handle(
    message: IMessage<OcppRequest | OcppResponse | OcppError>,
    props?: HandlerProperties,
  ): Promise<void> {
    await this._module?.handle(message, props);
  }

  /**
   * Abstract Methods
   */

  abstract subscribe(
    identifier: string,
    actions?: CallAction[],
    filter?: { [k: string]: string },
  ): Promise<boolean>;
  abstract unsubscribe(identifier: string): Promise<boolean>;
  abstract shutdown(): Promise<void>;
}
