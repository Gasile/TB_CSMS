// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0

import { EventEmitter } from 'events';

export interface CrudEvent<T> {
  created: [T[]];
  updated: [T[]];
  deleted: [T[]];
}

/**
 * Represents a generic CRUD repository.
 *
 * @template T - The type of the values stored in the repository.
 */
export abstract class CrudRepository<T> extends EventEmitter {
  constructor() {
    super();
  }

  /**
   * Creates a new entry in the database with the specified value.
   */
  public async create(tenantId: number, value: T, namespace?: string): Promise<T> {
    const result = await this._create(tenantId, value, namespace);
    this.emit('created', [result]);
    return result;
  }

  /**
   * Attempts to read a value from storage based on the given query, or throws if more than one value is found.
   */
  public async readOnlyOneByQuery(
    tenantId: number,
    query: object,
    namespace?: string,
  ): Promise<T | undefined> {
    const results = await this.readAllByQuery(tenantId, query, namespace);
    if (results.length > 1) {
      throw new Error(`More than one value found for query: ${JSON.stringify(query)}`);
    }
    return results[0];
  }

  /**
   * Reads a value from storage or creates it if none exists.
   */
  public async readOrCreateByQuery(
    tenantId: number,
    query: object,
    namespace?: string,
  ): Promise<[T, boolean]> {
    const result = await this._readOrCreateByQuery(tenantId, query, namespace);
    if (result[1]) {
      this.emit('created', [result[0]]);
    }
    return result;
  }

  /**
   * Updates the value associated with the given key.
   */
  public async updateByKey(
    tenantId: number,
    value: Partial<T>,
    key: string,
    namespace?: string,
  ): Promise<T | undefined> {
    const result = await this._updateByKey(tenantId, value, key, namespace);
    this.emit('updated', result ? [result] : []);
    return result;
  }

  /**
   * Updates all values matching the given query.
   */
  public async updateAllByQuery(
    tenantId: number,
    value: Partial<T>,
    query: object,
    namespace?: string,
  ): Promise<T[]> {
    const result = await this._updateAllByQuery(tenantId, value, query, namespace);
    this.emit('updated', result);
    return result;
  }

  /**
   * Deletes the entry with the given key.
   */
  public async deleteByKey(
    tenantId: number,
    key: string,
    namespace?: string,
  ): Promise<T | undefined> {
    const result = await this._deleteByKey(tenantId, key, namespace);
    this.emit('deleted', result ? [result] : []);
    return result;
  }

  /**
   * Deletes all values associated with a query from the specified namespace.
   */
  public async deleteAllByQuery(tenantId: number, query: object, namespace?: string): Promise<T[]> {
    const result = await this._deleteAllByQuery(tenantId, query, namespace);
    this.emit('deleted', result);
    return result;
  }

  abstract readByKey(
    tenantId: number,
    key: string | number,
    namespace?: string,
  ): Promise<T | undefined>;

  abstract readAllByQuery(tenantId: number, query: object, namespace?: string): Promise<T[]>;

  abstract readNextValue(
    tenantId: number,
    columnName: string,
    query?: object,
    startValue?: number,
    namespace?: string,
  ): Promise<number>;

  abstract existsByKey(tenantId: number, key: string, namespace?: string): Promise<boolean>;

  abstract existByQuery(tenantId: number, query: object, namespace?: string): Promise<number>;

  protected abstract _create(tenantId: number, value: T, namespace?: string): Promise<T>;

  protected abstract _readOrCreateByQuery(
    tenantId: number,
    query: object,
    namespace?: string,
  ): Promise<[T, boolean]>;

  protected abstract _updateByKey(
    tenantId: number,
    value: Partial<T>,
    key: string,
    namespace?: string,
  ): Promise<T | undefined>;

  protected abstract _updateAllByQuery(
    tenantId: number,
    value: Partial<T>,
    query: object,
    namespace?: string,
  ): Promise<T[]>;

  protected abstract _deleteByKey(
    tenantId: number,
    key: string,
    namespace?: string,
  ): Promise<T | undefined>;

  protected abstract _deleteAllByQuery(
    tenantId: number,
    query: object,
    namespace?: string,
  ): Promise<T[]>;
}
