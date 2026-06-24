// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
import fs from 'fs';
import path from 'path';
import type { ConfigStore, SystemConfig } from '@citrineos/base';
import type { ILogObj } from 'tslog';
import { Logger } from 'tslog';

export class LocalStorage implements ConfigStore {
  protected readonly _logger: Logger<ILogObj>;
  private defaultFilePath: string;
  private configFileName: string;
  private configDir: string | undefined;

  constructor(
    defaultFilePath: string,
    configFileName: string,
    configDir?: string,
    logger?: Logger<ILogObj>,
  ) {
    this.defaultFilePath = defaultFilePath;
    this.configFileName = configFileName;
    this.configDir = configDir;
    this._logger = logger
      ? logger.getSubLogger({ name: this.constructor.name })
      : new Logger<ILogObj>({ name: this.constructor.name });
  }

  async saveFile(fileName: string, content: Buffer, filePath?: string): Promise<string> {
    const relativePath = path.join(filePath ? filePath : this.defaultFilePath, fileName);
    // path.resolve so an absolute filePath/defaultFilePath is honored as-is;
    // path.join would treat it as relative and re-anchor under cwd.
    const absoluteFilePath = path.resolve(process.cwd(), relativePath);
    this._logger.debug(`Saving file to ${absoluteFilePath}`);
    fs.writeFileSync(absoluteFilePath, content, 'utf-8');
    return filePath ? relativePath : fileName;
  }

  async getFile(id: string, filePath?: string): Promise<string | undefined> {
    const absoluteFilePath = path.resolve(
      process.cwd(),
      filePath ? filePath : this.defaultFilePath,
      id,
    );
    this._logger.debug(`Getting file from ${absoluteFilePath}`);
    if (!fs.existsSync(absoluteFilePath)) {
      return;
    }
    return fs.readFileSync(absoluteFilePath, 'utf-8');
  }

  async fetchConfig(): Promise<SystemConfig | null> {
    try {
      const configString = await this.getFile(this.configFileName, this.configDir);
      if (!configString) return null;
      return JSON.parse(configString) as SystemConfig;
    } catch (error) {
      this._logger.error('Error fetching config from local storage:', error);
      return null;
    }
  }

  async saveConfig(config: SystemConfig): Promise<void> {
    try {
      await this.saveFile(
        this.configFileName,
        Buffer.from(JSON.stringify(config, null, 2)),
        this.configDir,
      );
      this._logger.info('Config saved locally.');
    } catch (error) {
      this._logger.error('Error saving config to local storage:', error);
    }
  }
}
